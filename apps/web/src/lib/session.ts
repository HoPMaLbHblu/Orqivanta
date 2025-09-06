import 'server-only';
import { cache } from 'react';
import { cookies, headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { config, resolveActor, SESSION_COOKIE, validateSession } from '@orqivanta/core';

export type SessionUser = NonNullable<Awaited<ReturnType<typeof validateSession>>>['user'];
export type OrgActor = NonNullable<Awaited<ReturnType<typeof resolveActor>>>;

/** The signed-in session for this request, validated once per render. */
export const getSession = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return validateSession(token);
});

export async function requireUser(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) {
    const path = (await headers()).get('x-pathname') ?? '/';
    redirect(`/sign-in?next=${encodeURIComponent(path)}`);
  }
  return session.user;
}

/** The current user's membership in an organization, or null when they have none. */
export const getActor = cache(async (orgSlug: string) => {
  const session = await getSession();
  if (!session) return null;
  return resolveActor(session.user.id, orgSlug);
});

/**
 * For pages inside /[org]. Signed-out visitors go to sign-in; people without a membership
 * get a 404 so organization addresses never reveal whether they exist. Client contacts are
 * sent to the portal, which is the only place they work.
 */
export async function requireActor(orgSlug: string, opts: { allowClient?: boolean } = {}): Promise<OrgActor> {
  await requireUser();
  const actor = await getActor(orgSlug);
  if (!actor) notFound();
  if (actor.role === 'client' && !opts.allowClient) redirect(`/portal/${actor.orgSlug}`);
  return actor;
}

export async function requestMeta() {
  const h = await headers();
  return {
    ip: h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || null,
    userAgent: h.get('user-agent'),
  };
}

export async function setSessionCookie(token: string, expiresAt: Date) {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProduction,
    path: '/',
    expires: expiresAt,
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(SESSION_COOKIE);
}
