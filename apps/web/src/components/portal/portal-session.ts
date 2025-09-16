import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { canPreviewPortal, getPortalAccount, portalPreviewActor, type Actor } from '@orqivanta/core';
import { requireActor, requireUser, type OrgActor, type SessionUser } from '@/lib/session';

/** Cookie holding the client account an owner or admin is previewing, scoped to /portal/<org>. */
export const PREVIEW_COOKIE = 'orq_portal_preview';

export interface PortalSession {
  user: SessionUser;
  /** The signed-in member, with their real role. */
  actor: OrgActor;
  /**
   * Who the portal is rendered for: the client contact themselves, or (in preview) a
   * client-scoped actor for an owner or admin. Null when staff haven't picked a client yet.
   */
  viewer: Actor | null;
  account: { id: string; name: string; accentColor: string | null } | null;
  /** Set while an owner or admin is previewing; the portal is then read-only. */
  preview: boolean;
  canPreview: boolean;
}

/** Resolves the portal viewer once per request. */
export const getPortalSession = cache(async (org: string): Promise<PortalSession> => {
  const user = await requireUser();
  const actor = await requireActor(org, { allowClient: true });
  if (actor.role === 'client') {
    return { user, actor, viewer: actor, account: await getPortalAccount(actor), preview: false, canPreview: false };
  }
  const canPreview = canPreviewPortal(actor);
  const clientId = (await cookies()).get(PREVIEW_COOKIE)?.value;
  if (canPreview && clientId) {
    const viewer = await portalPreviewActor(actor, clientId).catch(() => null);
    if (viewer) return { user, actor, viewer, account: await getPortalAccount(viewer), preview: true, canPreview };
  }
  return { user, actor, viewer: null, account: null, preview: false, canPreview };
});

/**
 * For portal pages: the viewer to pass to core. Internal members who haven't chosen a
 * client to preview go to the picker; nothing else in the portal renders for them.
 */
export async function requirePortal(org: string): Promise<PortalSession & { viewer: Actor }> {
  const s = await getPortalSession(org);
  if (!s.viewer) redirect(`/portal/${s.actor.orgSlug}/preview`);
  return s as PortalSession & { viewer: Actor };
}

/** Core NOT_FOUND / FORBIDDEN (and invalid ids) become a 404, so ids reveal nothing. */
export async function orNotFound<T>(p: Promise<T>): Promise<T> {
  try {
    return await p;
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === 'NOT_FOUND' || code === 'FORBIDDEN' || code === 'VALIDATION') notFound();
    throw err;
  }
}

/** Base path for portal links. */
export const portalBase = (org: string) => `/portal/${org}`;
