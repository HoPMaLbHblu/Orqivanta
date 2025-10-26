'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  AppError,
  checkResetToken,
  completeTwoFactorSignIn,
  config,
  createSession,
  register,
  requestPasswordReset,
  resendVerification,
  resetPassword,
  revokeSessionByToken,
  SESSION_COOKIE,
  setPreference,
  signIn,
  validateSession,
  verifyEmail,
} from '@orqivanta/core';
import { eq, users, withSystem } from '@orqivanta/db';
import { DEMO_PERSONAS } from '@orqivanta/core/demo';
import { run } from '@/lib/action';
import { homePathFor, safeNext } from '@/lib/routes';
import { clearSessionCookie, getSession, requestMeta, setSessionCookie } from '@/lib/session';
import { isLocale, LOCALE_COOKIE, THEME_COOKIE } from '@/i18n/config';

export async function signInAction(input: { email: string; password: string; next?: string }) {
  return run(async () => {
    const meta = await requestMeta();
    const res = await signIn({ email: input.email, password: input.password }, meta);
    if (res.status === 'unverified') return { status: 'unverified' as const, email: res.email };
    if (res.status === 'two_factor') return { status: 'two_factor' as const, challenge: res.challenge };
    await setSessionCookie(res.token, res.expiresAt);
    const to = safeNext(input.next) ?? (await homePathFor({ id: res.userId, lastActiveOrgId: res.lastActiveOrgId }));
    return { status: 'ok' as const, to };
  });
}

export async function twoFactorSignInAction(input: { challenge: string; code: string; next?: string }) {
  return run(async () => {
    const meta = await requestMeta();
    const res = await completeTwoFactorSignIn({ challenge: input.challenge, code: input.code }, meta);
    await setSessionCookie(res.token, res.expiresAt);
    const to = safeNext(input.next) ?? (await homePathFor({ id: res.userId, lastActiveOrgId: res.lastActiveOrgId }));
    return { to, recoveryCodesLeft: res.recoveryCodesLeft };
  });
}

export async function signUpAction(input: { name: string; email: string; password: string; next?: string; timeZone?: string }) {
  return run(async () => {
    const meta = await requestMeta();
    const locale = (await cookies()).get(LOCALE_COOKIE)?.value;
    return register({ ...input, next: safeNext(input.next) ?? undefined, locale: isLocale(locale) ? locale : undefined }, meta);
  });
}

export async function resendVerificationAction(email: string) {
  return run(async () => {
    await resendVerification(email);
    return true;
  });
}

/** Verification links are one-time; consuming one signs the person in. */
export async function verifyEmailAction(token: string, next?: string) {
  return run(async () => {
    const meta = await requestMeta();
    const session = await verifyEmail(token, meta);
    await setSessionCookie(session.token, session.expiresAt);
    const current = await validateSession(session.token);
    return { to: safeNext(next) ?? (current ? await homePathFor(current.user) : '/onboarding') };
  });
}

export async function forgotPasswordAction(email: string) {
  return run(async () => {
    const meta = await requestMeta();
    await requestPasswordReset({ email }, meta);
    return true;
  });
}

export async function checkResetTokenAction(token: string) {
  return checkResetToken(token);
}

export async function resetPasswordAction(input: { token: string; password: string }) {
  return run(async () => {
    const meta = await requestMeta();
    const session = await resetPassword(input, meta);
    if (!session) return { to: '/sign-in' };
    await setSessionCookie(session.token, session.expiresAt);
    const current = await validateSession(session.token);
    return { to: current ? await homePathFor(current.user) : '/sign-in' };
  });
}

export async function signOutAction() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token) await revokeSessionByToken(token);
  await clearSessionCookie();
  redirect('/sign-in');
}

/** Saves language and theme: on the account when signed in, otherwise in a cookie. */
export async function setPreferenceAction(input: { locale?: string; theme?: string }) {
  return run(async () => {
    const session = await getSession();
    const jar = await cookies();
    if (input.locale && isLocale(input.locale)) jar.set(LOCALE_COOKIE, input.locale, { path: '/', maxAge: 31536000, sameSite: 'lax' });
    if (input.theme && ['system', 'light', 'dark'].includes(input.theme)) jar.set(THEME_COOKIE, input.theme, { path: '/', maxAge: 31536000, sameSite: 'lax' });
    if (session) await setPreference(session.user.id, input);
    return true;
  });
}

/**
 * Demo switcher: signs into one of the fictional demo accounts without a password.
 * Only available when DEMO_MODE is on, and only for accounts flagged is_demo.
 */
export async function demoSignInAction(personaKey: string) {
  return run(async () => {
    if (!config.demoMode) throw new AppError('FORBIDDEN', 'The demo is not enabled on this server.');
    const persona = DEMO_PERSONAS.find((p) => p.key === personaKey);
    if (!persona) throw new AppError('NOT_FOUND', 'That demo account does not exist.');
    const [user] = await withSystem((tx) => tx.select().from(users).where(eq(users.email, persona.email)));
    if (!user || !user.isDemo) throw new AppError('PRECONDITION', 'The demo workspace has not been created yet. Run pnpm demo:reset.');
    const current = (await cookies()).get(SESSION_COOKIE)?.value;
    if (current) await revokeSessionByToken(current);
    const meta = await requestMeta();
    const session = await createSession(user.id, meta);
    await setSessionCookie(session.token, session.expiresAt);
    return { to: await homePathFor(user) };
  });
}
