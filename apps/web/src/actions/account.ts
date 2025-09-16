'use server';

import { cookies } from 'next/headers';
import { AppError, changePassword, revokeOtherSessions, revokeSession, setNotificationPreference, updateProfile } from '@orqivanta/core';
import { run } from '@/lib/action';
import { getSession } from '@/lib/session';
import { isLocale, LOCALE_COOKIE, THEME_COOKIE } from '@/i18n/config';

async function session() {
  const s = await getSession();
  if (!s) throw new AppError('UNAUTHENTICATED', 'Your session has ended. Sign in again to continue.');
  return s;
}

/** Profile and preferences share one schema in core, so both forms send the full set. */
export async function updateProfileAction(input: { name: string; timeZone: string; locale: string; dateFormat: string; theme: string; avatarColor?: string }) {
  return run(async () => {
    const s = await session();
    await updateProfile(s.user.id, input);
    const jar = await cookies();
    if (isLocale(input.locale)) jar.set(LOCALE_COOKIE, input.locale, { path: '/', maxAge: 31536000, sameSite: 'lax' });
    if (['system', 'light', 'dark'].includes(input.theme)) jar.set(THEME_COOKIE, input.theme, { path: '/', maxAge: 31536000, sameSite: 'lax' });
    return true;
  });
}

export async function setNotificationPreferenceAction(input: { category: string; inApp: boolean; email: boolean }) {
  return run(async () => {
    const s = await session();
    await setNotificationPreference(s.user.id, input);
    return true;
  });
}

export async function changePasswordAction(input: { currentPassword: string; newPassword: string }) {
  return run(async () => {
    const s = await session();
    await changePassword(s.user.id, s.sessionId, input);
    return true;
  });
}

export async function revokeSessionAction(sessionId: string) {
  return run(async () => {
    const s = await session();
    if (sessionId === s.sessionId) throw new AppError('VALIDATION', 'Use Sign out to end the session you’re using now.');
    await revokeSession(s.user.id, sessionId);
    return true;
  });
}

export async function revokeOtherSessionsAction() {
  return run(async () => {
    const s = await session();
    await revokeOtherSessions(s.user.id, s.sessionId);
    return true;
  });
}
