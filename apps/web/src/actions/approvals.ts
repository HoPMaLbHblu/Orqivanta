'use server';

import { cancelApproval, decideApproval, reassignReviewer, remindReviewers } from '@orqivanta/core';
import { run } from '@/lib/action';
import { actorFor } from '@/lib/session';

export async function decideApprovalAction(org: string, input: unknown) {
  return run(async () => decideApproval(await actorFor(org), input));
}

export async function remindReviewersAction(org: string, input: unknown) {
  return run(async () => remindReviewers(await actorFor(org), input));
}

export async function reassignReviewerAction(org: string, input: unknown) {
  return run(async () => {
    await reassignReviewer(await actorFor(org), input);
    return true;
  });
}

export async function cancelApprovalAction(org: string, input: unknown) {
  return run(async () => {
    await cancelApproval(await actorFor(org), input);
    return true;
  });
}
