'use server';

import { markNotifications } from '@orqivanta/core';
import { run } from '@/lib/action';
import { actorFor } from '@/lib/session';

export async function markNotificationsAction(org: string, input: { ids?: string[]; all?: boolean; action: 'read' | 'unread' | 'archive' | 'unarchive' }) {
  return run(async () => {
    await markNotifications(await actorFor(org), input);
    return true;
  });
}
