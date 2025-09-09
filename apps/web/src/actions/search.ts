'use server';

import { search } from '@orqivanta/core';
import { run } from '@/lib/action';
import { getActor } from '@/lib/session';

export async function searchAction(org: string, q: string) {
  return run(async () => {
    const actor = await getActor(org);
    if (!actor || !q.trim()) return { results: [] };
    return search(actor, { q, limit: 12 });
  });
}
