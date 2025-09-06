'use server';

import { acceptInvitation } from '@orqivanta/core';
import { run } from '@/lib/action';
import { requireUser } from '@/lib/session';

export async function acceptInvitationAction(token: string) {
  return run(async () => {
    const user = await requireUser();
    const res = await acceptInvitation(user.id, token);
    return res;
  });
}
