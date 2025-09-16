'use server';

import { createInvitations, saveClient, setClientArchived } from '@orqivanta/core';
import { run } from '@/lib/action';
import { actorFor } from '@/lib/session';

export async function saveClientAction(org: string, input: unknown) {
  return run(async () => {
    const c = await saveClient(await actorFor(org), input);
    return { id: c.id, name: c.name };
  });
}

export async function setClientArchivedAction(org: string, input: unknown) {
  return run(async () => {
    await setClientArchived(await actorFor(org), input);
    return true;
  });
}

/** Invites contacts of one client account to the portal (role is always "client"). */
export async function inviteClientContactsAction(org: string, input: { clientAccountId: string; emails: string[]; message?: string | null }) {
  return run(async () => createInvitations(await actorFor(org), { role: 'client', clientAccountId: input.clientAccountId, emails: input.emails, message: input.message ?? null }));
}
