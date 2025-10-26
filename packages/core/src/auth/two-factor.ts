import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { and, emailTokens, eq, gt, isNull, sql, users, withSystem } from '@orqivanta/db';
import { AppError, validation } from '../errors';
import { randomToken, sha256 } from '../lib/crypto';
import { rateLimit } from '../lib/rate-limit';
import { parse } from '../lib/validate';
import { verifyPassword } from './password';
import { createSession } from './sessions';

/*
 * Two-factor sign-in with an authenticator app (TOTP, RFC 6238: SHA-1, 6 digits, 30-second steps)
 * plus ten single-use recovery codes. Implemented on node:crypto, so no outside service is involved.
 */

const STEP_SECONDS = 30;
const CHALLENGE_MINUTES = 10;
const RECOVERY_CODE_COUNT = 10;
const ISSUER = 'Orqivanta';
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buf: Buffer) {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(s: string) {
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of s.replace(/=+$/, '').toUpperCase()) {
    const i = B32.indexOf(ch);
    if (i < 0) continue;
    value = (value << 5) | i;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** The 6-digit code for one 30-second step. Exported for tests. */
export function totpCode(secret: string, step: number) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const mac = createHmac('sha1', base32Decode(secret)).update(counter).digest();
  const offset = mac[mac.length - 1]! & 15;
  const n = (mac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return n.toString().padStart(6, '0');
}

export const currentTotpStep = (now = Date.now()) => Math.floor(now / 1000 / STEP_SECONDS);

/** Returns the matching step (allowing one step of clock drift either way), or null. */
function matchTotp(secret: string, code: string, lastStep: number | null) {
  const now = currentTotpStep();
  for (const step of [now, now - 1, now + 1]) {
    if (lastStep !== null && step <= lastStep) continue;
    const expected = Buffer.from(totpCode(secret, step));
    const given = Buffer.from(code);
    if (given.length === expected.length && timingSafeEqual(given, expected)) return step;
  }
  return null;
}

function newRecoveryCodes() {
  return Array.from({ length: RECOVERY_CODE_COUNT }, () => {
    const raw = base32Encode(randomBytes(7)).slice(0, 10).toLowerCase();
    return `${raw.slice(0, 5)}-${raw.slice(5)}`;
  });
}

const normalizeRecovery = (code: string) => code.toLowerCase().replace(/[^a-z2-7]/g, '');
const hashRecovery = (code: string) => sha256(`recovery:${normalizeRecovery(code)}`);

const zCode = z.string().trim().max(40);

async function loadUser(userId: string) {
  const [user] = await withSystem((tx) => tx.select().from(users).where(eq(users.id, userId)).limit(1));
  if (!user) throw new AppError('NOT_FOUND', 'Account not found.');
  return user;
}

export async function twoFactorStatus(userId: string) {
  const user = await loadUser(userId);
  return { enabled: Boolean(user.totpEnabledAt), enabledAt: user.totpEnabledAt, recoveryCodesLeft: user.recoveryCodeHashes.length };
}

/** Starts setup: stores a fresh secret (not active yet) and returns what the authenticator app needs. */
export async function beginTwoFactorSetup(userId: string) {
  const user = await loadUser(userId);
  if (user.isDemo) throw new AppError('FORBIDDEN', 'Demo accounts are shared, so two-factor sign-in is turned off for them.');
  if (user.totpEnabledAt) throw new AppError('CONFLICT', 'Two-factor sign-in is already on.');
  const secret = base32Encode(randomBytes(20));
  await withSystem((tx) => tx.update(users).set({ totpSecret: secret, totpLastStep: null }).where(eq(users.id, userId)));
  const label = encodeURIComponent(`${ISSUER}:${user.email}`);
  const otpauthUrl = `otpauth://totp/${label}?secret=${secret}&issuer=${ISSUER}&algorithm=SHA1&digits=6&period=${STEP_SECONDS}`;
  return { secret, otpauthUrl };
}

/** Turns two-factor on once the person proves their app shows the right code. Returns recovery codes once. */
export async function confirmTwoFactorSetup(userId: string, input: unknown) {
  const { code } = parse(z.object({ code: zCode }), input);
  await rateLimit(`2fa-setup:${userId}`, 10, 900);
  const user = await loadUser(userId);
  if (user.totpEnabledAt) throw new AppError('CONFLICT', 'Two-factor sign-in is already on.');
  if (!user.totpSecret) throw new AppError('CONFLICT', 'Start the setup again.');
  const step = matchTotp(user.totpSecret, code.replace(/\s/g, ''), null);
  if (step === null) throw validation({ code: 'That code didn’t match. Check the time on your phone and try the newest code.' });
  const codes = newRecoveryCodes();
  await withSystem((tx) =>
    tx
      .update(users)
      .set({ totpEnabledAt: new Date(), totpLastStep: step, recoveryCodeHashes: codes.map(hashRecovery) })
      .where(eq(users.id, userId)),
  );
  return { recoveryCodes: codes };
}

async function requirePassword(user: { passwordHash: string | null }, password: string) {
  if (!(await verifyPassword(user.passwordHash, password))) throw validation({ password: 'That password isn’t right.' });
}

export async function disableTwoFactor(userId: string, input: unknown) {
  const { password } = parse(z.object({ password: z.string().min(1, 'Enter your password.').max(200) }), input);
  await rateLimit(`2fa-change:${userId}`, 5, 900);
  const user = await loadUser(userId);
  await requirePassword(user, password);
  await withSystem((tx) =>
    tx
      .update(users)
      .set({ totpSecret: null, totpEnabledAt: null, totpLastStep: null, recoveryCodeHashes: [] })
      .where(eq(users.id, userId)),
  );
  return true;
}

export async function regenerateRecoveryCodes(userId: string, input: unknown) {
  const { password } = parse(z.object({ password: z.string().min(1, 'Enter your password.').max(200) }), input);
  await rateLimit(`2fa-change:${userId}`, 5, 900);
  const user = await loadUser(userId);
  if (!user.totpEnabledAt) throw new AppError('CONFLICT', 'Two-factor sign-in is off.');
  await requirePassword(user, password);
  const codes = newRecoveryCodes();
  await withSystem((tx) => tx.update(users).set({ recoveryCodeHashes: codes.map(hashRecovery) }).where(eq(users.id, userId)));
  return { recoveryCodes: codes };
}

/** Called by signIn after the password checks out: a short-lived, single-use ticket for the code step. */
export async function issueTwoFactorChallenge(userId: string) {
  const token = randomToken();
  await withSystem(async (tx) => {
    await tx
      .update(emailTokens)
      .set({ usedAt: new Date() })
      .where(and(eq(emailTokens.userId, userId), eq(emailTokens.purpose, 'mfa_challenge'), isNull(emailTokens.usedAt)));
    await tx.insert(emailTokens).values({
      userId,
      purpose: 'mfa_challenge',
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() + CHALLENGE_MINUTES * 60_000),
    });
  });
  return token;
}

/** Second sign-in step: an authenticator code or a recovery code. */
export async function completeTwoFactorSignIn(
  input: unknown,
  meta: { userAgent?: string | null; ip?: string | null } = {},
) {
  const data = parse(z.object({ challenge: z.string().min(10).max(100), code: zCode.min(1, 'Enter the code.') }), input);
  const expired = () => new AppError('CONFLICT', 'This sign-in took too long. Enter your password again.');
  const [ticket] = await withSystem((tx) =>
    tx
      .select()
      .from(emailTokens)
      .where(
        and(
          eq(emailTokens.tokenHash, sha256(data.challenge)),
          eq(emailTokens.purpose, 'mfa_challenge'),
          isNull(emailTokens.usedAt),
          gt(emailTokens.expiresAt, sql`now()`),
        ),
      ),
  );
  if (!ticket) throw expired();
  await rateLimit(`2fa-signin:${ticket.userId}`, 8, 900);
  const user = await loadUser(ticket.userId);
  if (!user.totpEnabledAt || !user.totpSecret) throw expired();

  const digits = data.code.replace(/\s/g, '');
  let update: Partial<typeof users.$inferInsert> | null = null;
  if (/^\d{6}$/.test(digits)) {
    const step = matchTotp(user.totpSecret, digits, user.totpLastStep);
    if (step !== null) update = { totpLastStep: step };
  } else {
    const hash = hashRecovery(data.code);
    if (normalizeRecovery(data.code).length === 10 && user.recoveryCodeHashes.includes(hash)) {
      update = { recoveryCodeHashes: user.recoveryCodeHashes.filter((h) => h !== hash) };
    }
  }
  if (!update) throw validation({ code: 'That code didn’t work. Try the newest code from your app, or a recovery code.' });

  await withSystem(async (tx) => {
    await tx.update(users).set(update).where(eq(users.id, user.id));
    await tx.update(emailTokens).set({ usedAt: new Date() }).where(eq(emailTokens.id, ticket.id));
  });
  const session = await createSession(user.id, meta);
  return { ...session, userId: user.id, lastActiveOrgId: user.lastActiveOrgId, recoveryCodesLeft: update.recoveryCodeHashes?.length ?? null };
}
