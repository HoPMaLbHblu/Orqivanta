'use server';

import { createComment, deleteComment, editComment, setCommentResolved, toggleReaction } from '@orqivanta/core';
import { run } from '@/lib/action';
import { actorFor } from '@/lib/session';

export async function createCommentAction(org: string, input: { parent: { type: 'task' | 'document' | 'request' | 'approval'; id: string }; body: unknown; visibility: 'internal' | 'client'; replyToId?: string | null }) {
  return run(async () => {
    const c = await createComment(await actorFor(org), input);
    return { id: c.id };
  });
}

export async function editCommentAction(org: string, input: { commentId: string; body: unknown }) {
  return run(async () => {
    await editComment(await actorFor(org), input);
    return true;
  });
}

export async function deleteCommentAction(org: string, commentId: string) {
  return run(async () => {
    await deleteComment(await actorFor(org), { commentId });
    return true;
  });
}

export async function resolveCommentAction(org: string, commentId: string, resolved: boolean) {
  return run(async () => {
    await setCommentResolved(await actorFor(org), { commentId, resolved });
    return true;
  });
}

export async function toggleReactionAction(org: string, commentId: string, emoji: string) {
  return run(async () => {
    await toggleReaction(await actorFor(org), { commentId, emoji });
    return true;
  });
}
