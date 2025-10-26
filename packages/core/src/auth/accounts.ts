import { z } from 'zod';
import { and, emailTokens, eq, gt, isNull, sql, users, withSystem, type Tx } from '@orqivanta/db';
import { config } from '../config';
import { AppError, validation } from '../errors';
import { randomToken, sha256 } from '../lib/crypto';
import { rateLimit } from '../lib/rate-limit';
import { parse, zEmail, zName, zPassword } from '../lib/validate';
import { queueEmail } from '../mail/send';
import type { Locale } from '../mail/templates';
import { hashPassword, verifyPassword } from './password';
import { createSession, revokeOtherSessions } from './sessions';
import { issueTwoFactorChallenge } from './two-factor';

const AVATAR_COLORS = ['verdigris', 'amber', 'plum', 'slate', 'clay', 'moss', 'ocean', 'rose'];
export const pickAvatarColor = (seed: string) =>
  AVATAR_COLORS[[...seed].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length]!;

const asLocale = (l: string | null | undefined): Locale => (l === 'ru' ? 'ru' : 'en');

async function issueEmailToken(tx: Tx, userId: string, purpose: 'verify_email' | 'reset_password') {
  const token = randomToken();
  const ttl = purpose === 'verify_email' ? config.verifyEmailHours * 3600_000 : config.resetPasswordMinutes * 60_000;
  // Only the newest link of each kind stays valid.
  await tx
    .update(emailTokens)
    .set({ usedAt: new Date() })
    .where(and(eq(emailTokens.userId, userId), eq(emailTokens.purpose, purpose), isNull(emailTokens.usedAt)));
  await tx.insert(emailTokens).values({ userId, purpose, tokenHash: sha256(token), expiresAt: new Date(Date.now() + ttl) });
  return token;
}

export const registerSchema = z.object({
  name: zName('Name'),
  email: zEmail,
  password: zPassword,
  locale: z.enum(['en', 'ru']).optional(),
  timeZone: z.string().max(64).optional(),
  /** Where to continue after verification, e.g. an invitation link. Must be a relative path. */
  next: z.string().max(300).regex(/^\/(?!\/)/).optional(),
});

/**
 * Creates an account and emails a confirmation link. The response is identical whether
 * or not the email is already registered; an existing owner gets a "you already have an
 * account" email instead, so registration can't be used to discover accounts.
 */
export async function register(input: unknown, meta: { ip?: string | null } = {}) {
  const data = parse(registerSchema, input);
  await rateLimit(`register:ip:${meta.ip ?? 'unknown'}`, 10, 3600);
  await rateLimit(`register:email:${data.email}`, 3, 3600);
  const passwordHash = await hashPassword(data.password);
  await withSystem(async (tx) => {
    const [existing] = await tx.select().from(users).where(sql`lower(${users.email}) = ${data.email}`).limit(1);
    if (existing) {
      await queueEmail(tx, {
        to: existing.email,
        locale: asLocale(existing.locale),
        template: 'account_exists',
        data: {
          name: existing.name,
          signInUrl: `${config.appUrl}/sign-in`,
          resetUrl: `${config.appUrl}/forgot-password`,
        },
      });
      return;
    }
    const [user] = await tx
      .insert(users)
      .values({
        name: data.name,
        email: data.email,
        passwordHash,
        avatarColor: pickAvatarColor(data.email),
        locale: data.locale ?? 'en',
        timeZone: data.timeZone && isValidTimeZone(data.timeZone) ? data.timeZone : 'UTC',
      })
      .returning();
    const token = await issueEmailToken(tx, user!.id, 'verify_email');
    const next = data.next ? `&next=${encodeURIComponent(data.next)}` : '';
    await queueEmail(tx, {
      to: user!.email,
      locale: asLocale(user!.locale),
      template: 'verify_email',
      data: { name: user!.name, url: `${config.appUrl}/verify-email?token=${token}${next}` },
    });
  });
  return { email: data.email };
}

export function isValidTimeZone(tz: string) {
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Consumes a verification link and signs the user in. */
export async function verifyEmail(token: string, meta: { userAgent?: string | null; ip?: string | null } = {}) {
  if (!token || token.length > 100) throw new AppError('PRECONDITION', 'This link is invalid or has expired.');
  const userId = await withSystem(async (tx) => {
    const [row] = await tx
      .update(emailTokens)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(emailTokens.tokenHash, sha256(token)),
          eq(emailTokens.purpose, 'verify_email'),
          isNull(emailTokens.usedAt),
          gt(emailTokens.expiresAt, sql`now()`),
        ),
      )
      .returning({ userId: emailTokens.userId });
    if (!row) return null;
    await tx
      .update(users)
      .set({ emailVerifiedAt: sql`coalesce(${users.emailVerifiedAt}, now())`, updatedAt: new Date() })
      .where(eq(users.id, row.userId));
    return row.userId;
  });
  if (!userId) throw new AppError('PRECONDITION', 'This link is invalid or has expired.');
  return createSession(userId, meta);
}

export async function resendVerification(email: string) {
  const parsed = zEmail.safeParse(email);
  if (!parsed.success) return;
  await rateLimit(`verify-resend:${parsed.data}`, 3, 3600);
  await withSystem(async (tx) => {
    const [user] = await tx.select().from(users).where(sql`lower(${users.email}) = ${parsed.data}`).limit(1);
    if (!user || user.emailVerifiedAt) return;
    const token = await issueEmailToken(tx, user.id, 'verify_email');
    await queueEmail(tx, {
      to: user.email,
      locale: asLocale(user.locale),
      template: 'verify_email',
      data: { name: user.name, url: `${config.appUrl}/verify-email?token=${token}` },
    });
  });
}

export const signInSchema = z.object({
  email: zEmail,
  password: z.string().min(1, 'Enter your password.').max(200),
});

export type SignInResult =
  | { status: 'ok'; token: string; expiresAt: Date; userId: string; lastActiveOrgId: string | null }
  | { status: 'unverified'; email: string }
  | { status: 'two_factor'; challenge: string };

/** Signs in with email and password. Wrong email and wrong password give the same error. */
export async function signIn(
  input: unknown,
  meta: { userAgent?: string | null; ip?: string | null } = {},
): Promise<SignInResult> {
  const data = parse(signInSchema, input);
  await rateLimit(`signin:ip:${meta.ip ?? 'unknown'}`, 30, 900);
  await rateLimit(`signin:email:${data.email}`, 8, 900);
  const [user] = await withSystem((tx) =>
    tx.select().from(users).where(sql`lower(${users.email}) = ${data.email}`).limit(1),
  );
  const ok = await verifyPassword(user?.passwordHash ?? null, data.password);
  if (!user || !ok) {
    throw validation({ password: 'That email and password combination didn’t work.' }, 'Sign-in failed.');
  }
  if (!user.emailVerifiedAt) {
    await resendVerification(user.email).catch(() => undefined);
    return { status: 'unverified', email: user.email };
  }
  if (user.totpEnabledAt) return { status: 'two_factor', challenge: await issueTwoFactorChallenge(user.id) };
  const session = await createSession(user.id, meta);
  return { status: 'ok', ...session, userId: user.id, lastActiveOrgId: user.lastActiveOrgId };
}

/** Always succeeds from the caller's point of view; sends a link only if the account exists. */
export async function requestPasswordReset(input: unknown, meta: { ip?: string | null } = {}) {
  const { email } = parse(z.object({ email: zEmail }), input);
  await rateLimit(`reset:ip:${meta.ip ?? 'unknown'}`, 10, 3600);
  await rateLimit(`reset:email:${email}`, 3, 3600);
  await withSystem(async (tx) => {
    const [user] = await tx.select().from(users).where(sql`lower(${users.email}) = ${email}`).limit(1);
    if (!user || user.isDemo) return;
    const token = await issueEmailToken(tx, user.id, 'reset_password');
    await queueEmail(tx, {
      to: user.email,
      locale: asLocale(user.locale),
      template: 'reset_password',
      data: { name: user.name, url: `${config.appUrl}/reset-password?token=${token}` },
    });
  });
}

export async function checkResetToken(token: string): Promise<boolean> {
  if (!token || token.length > 100) return false;
  const [row] = await withSystem((tx) =>
    tx
      .select({ id: emailTokens.id })
      .from(emailTokens)
      .where(
        and(
          eq(emailTokens.tokenHash, sha256(token)),
          eq(emailTokens.purpose, 'reset_password'),
          isNull(emailTokens.usedAt),
          gt(emailTokens.expiresAt, sql`now()`),
        ),
      ),
  );
  return Boolean(row);
}

/** Sets a new password from a reset link, signs out every other session, and signs in. */
export async function resetPassword(
  input: unknown,
  meta: { userAgent?: string | null; ip?: string | null } = {},
) {
  const data = parse(z.object({ token: z.string().min(10).max(100), password: zPassword }), input);
  const passwordHash = await hashPassword(data.password);
  const userId = await withSystem(async (tx) => {
    const [row] = await tx
      .update(emailTokens)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(emailTokens.tokenHash, sha256(data.token)),
          eq(emailTokens.purpose, 'reset_password'),
          isNull(emailTokens.usedAt),
          gt(emailTokens.expiresAt, sql`now()`),
        ),
      )
      .returning({ userId: emailTokens.userId });
    if (!row) return null;
    // A working reset link proves control of the inbox, so it also verifies the email.
    const [user] = await tx
      .update(users)
      .set({ passwordHash, emailVerifiedAt: sql`coalesce(${users.emailVerifiedAt}, now())`, updatedAt: new Date() })
      .where(eq(users.id, row.userId))
      .returning();
    await queueEmail(tx, { to: user!.email, locale: asLocale(user!.locale), template: 'password_changed', data: { name: user!.name } });
    return row.userId;
  });
  if (!userId) throw new AppError('PRECONDITION', 'This reset link is invalid or has expired. Request a new one.');
  await revokeOtherSessions(userId, null);
  // A reset link proves the inbox, not the second factor: with two-factor on, sign in normally next.
  const [u] = await withSystem((tx) => tx.select({ totpEnabledAt: users.totpEnabledAt }).from(users).where(eq(users.id, userId)));
  if (u?.totpEnabledAt) return null;
  return createSession(userId, meta);
}

export async function changePassword(
  userId: string,
  currentSessionId: string,
  input: unknown,
) {
  const data = parse(z.object({ currentPassword: z.string().min(1, 'Enter your current password.'), newPassword: zPassword }), input);
  await rateLimit(`change-password:${userId}`, 5, 900);
  const [user] = await withSystem((tx) => tx.select().from(users).where(eq(users.id, userId)));
  if (!user) throw new AppError('UNAUTHENTICATED', 'Please sign in again.');
  if (user.isDemo) throw new AppError('PRECONDITION', 'Demo accounts can’t change their password.');
  if (!(await verifyPassword(user.passwordHash, data.currentPassword))) {
    throw validation({ currentPassword: 'That isn’t your current password.' });
  }
  const passwordHash = await hashPassword(data.newPassword);
  await withSystem(async (tx) => {
    await tx.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, userId));
    await queueEmail(tx, { to: user.email, locale: asLocale(user.locale), template: 'password_changed', data: { name: user.name } });
  });
  await revokeOtherSessions(userId, currentSessionId);
}

export const profileSchema = z.object({
  name: zName('Name'),
  timeZone: z.string().max(64).refine(isValidTimeZone, 'Choose a valid time zone.'),
  locale: z.enum(['en', 'ru']),
  dateFormat: z.enum(['d MMM yyyy', 'MMM d, yyyy', 'dd.MM.yyyy', 'yyyy-MM-dd']),
  theme: z.enum(['system', 'light', 'dark']),
  avatarColor: z.enum(AVATAR_COLORS as [string, ...string[]]).optional(),
});

export async function updateProfile(userId: string, input: unknown) {
  const data = parse(profileSchema, input);
  const [user] = await withSystem((tx) =>
    tx.update(users).set({ ...data, updatedAt: new Date() }).where(eq(users.id, userId)).returning(),
  );
  return user;
}

export async function setPreference(userId: string, input: unknown) {
  const data = parse(profileSchema.pick({ theme: true, locale: true }).partial(), input);
  await withSystem((tx) => tx.update(users).set({ ...data, updatedAt: new Date() }).where(eq(users.id, userId)));
}
