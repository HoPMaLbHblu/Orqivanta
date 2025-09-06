import 'server-only';
import { listMyOrgs } from '@orqivanta/core';

/** Where a signed-in person starts: their last organization, else the first, else onboarding. */
export async function homePathFor(user: { id: string; lastActiveOrgId: string | null }) {
  const orgs = await listMyOrgs(user.id);
  const org = orgs.find((o) => o.id === user.lastActiveOrgId) ?? orgs[0];
  if (!org) return '/onboarding';
  return org.role === 'client' ? `/portal/${org.slug}` : `/${org.slug}`;
}

/** Only same-site relative paths are accepted as redirect targets. */
export function safeNext(next: unknown): string | null {
  return typeof next === 'string' && /^\/(?!\/)[^\s\\]*$/.test(next) && next.length < 500 ? next : null;
}
