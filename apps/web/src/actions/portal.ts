'use server';

import { cookies } from 'next/headers';
import { AppError, config, decideApproval, markNotifications, portalPreviewActor, submitRequest } from '@orqivanta/core';
import { PREVIEW_COOKIE } from '@/components/portal/portal-session';
import { run } from '@/lib/action';
import { actorFor } from '@/lib/session';

/**
 * Portal mutations. They run as the signed-in person (never as a preview actor) and only for
 * client contacts: staff use the internal app, and an owner previewing the portal can't act.
 */
async function clientActor(org: string) {
  const actor = await actorFor(org);
  if (actor.role !== 'client') throw new AppError('NOT_FOUND', 'That page doesn’t exist or you no longer have access to it.');
  return actor;
}

export async function submitPortalRequestAction(org: string, input: { formId: string; title: string; details: string; answers: Record<string, unknown>; projectId?: string | null }) {
  return run(async () => {
    const r = await submitRequest(await clientActor(org), input);
    return { id: r.id, number: r.number };
  });
}

export async function decidePortalApprovalAction(org: string, input: { approvalId: string; decision: 'approved' | 'changes_requested' | 'rejected'; comment?: string | null }) {
  return run(async () => decideApproval(await clientActor(org), input));
}

export async function markPortalNotificationsAction(org: string, input: { ids?: string[]; all?: boolean }) {
  return run(async () => {
    // Any member may manage their own notifications; this only touches the caller's rows.
    await markNotifications(await actorFor(org), { ...input, action: 'read' });
    return true;
  });
}

/** Starts a "view as client" preview. Owners and admins only; core decides who qualifies. */
export async function setPortalPreviewAction(org: string, clientAccountId: string) {
  return run(async () => {
    const actor = await actorFor(org);
    const viewer = await portalPreviewActor(actor, clientAccountId);
    (await cookies()).set(PREVIEW_COOKIE, viewer.clientAccountId!, { httpOnly: true, sameSite: 'lax', secure: config.isProduction, path: `/portal/${org}` });
    return true;
  });
}

export async function exitPortalPreviewAction(org: string) {
  return run(async () => {
    (await cookies()).delete({ name: PREVIEW_COOKIE, path: `/portal/${org}` });
    return true;
  });
}
