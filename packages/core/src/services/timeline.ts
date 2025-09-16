import { z } from 'zod';
import { activityEvents, and, asc, eq, users, withTenant } from '@orqivanta/db';
import { parse } from '../lib/validate';
import type { Actor } from '../permissions';
import { getApprovalAccess } from './approvals';
import { getRequestAccess } from './requests';

const schema = z.object({ type: z.enum(['request', 'approval']), id: z.uuid() });

/**
 * The activity history of one request or approval, oldest first, for its detail page.
 * Access follows the item itself; client contacts only see client-visible events.
 */
export async function listEntityTimeline(actor: Actor, input: unknown) {
  const { type, id } = parse(schema, input);
  return withTenant(actor.orgId, async (tx) => {
    const isClient = type === 'request' ? (await getRequestAccess(tx, actor, id)).isClient : (await getApprovalAccess(tx, actor, id)).isClient;
    return tx
      .select({
        id: activityEvents.id,
        verb: activityEvents.verb,
        summary: activityEvents.summary,
        data: activityEvents.data,
        createdAt: activityEvents.createdAt,
        actorName: users.name,
        actorColor: users.avatarColor,
      })
      .from(activityEvents)
      .leftJoin(users, eq(users.id, activityEvents.actorId))
      .where(and(eq(activityEvents.orgId, actor.orgId), eq(activityEvents.entityType, type), eq(activityEvents.entityId, id), isClient ? eq(activityEvents.clientVisible, true) : undefined))
      .orderBy(asc(activityEvents.createdAt))
      .limit(200);
  });
}
