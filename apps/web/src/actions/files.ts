'use server';

import { setFileDeleted, updateFile } from '@orqivanta/core';
import { run } from '@/lib/action';
import { actorFor } from '@/lib/session';

/** Rename, describe, change kind or client sharing. */
export async function updateFileAction(org: string, input: unknown) {
  return run(async () => {
    const f = await updateFile(await actorFor(org), input);
    return { id: f.id, name: f.name };
  });
}

export async function setFileDeletedAction(org: string, input: unknown) {
  return run(async () => {
    await setFileDeleted(await actorFor(org), input);
    return true;
  });
}
