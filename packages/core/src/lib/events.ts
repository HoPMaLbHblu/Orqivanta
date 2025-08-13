import {
  activityEvents,
  auditEvents,
  inArray,
  notificationPreferences,
  notifications,
  organizations,
  eq,
  outbox,
  realtimeEvents,
  sql,
  users,
  type Tx,
} from '@orqivanta/db';
import type { Actor } from '../permissions';

export type Channel = 'org' | `project:${string}` | `user:${string}`;

/** Publishes a live-update event. Delivered to subscribers only after the transaction commits. */
export async function publish(
  tx: Tx,
  orgId: string,
  channel: Channel,
  type: string,
  entityId: string | null,
  payload: Record<string, unknown> = {},
) {
  await tx.insert(realtimeEvents).values({ orgId, channel, type, entityId, payload });
}

export async function recordActivity(
  tx: Tx,
  actor: Pick<Actor, 'orgId' | 'userId'>,
  e: {
    projectId?: string | null;
    verb: string;
    entityType: string;
    entityId: string;
    summary: string;
    data?: Record<string, unknown>;
    clientVisible?: boolean;
  },
) {
  await tx.insert(activityEvents).values({
    orgId: actor.orgId,
    projectId: e.projectId ?? null,
    actorId: actor.userId || null,
    verb: e.verb,
    entityType: e.entityType,
    entityId: e.entityId,
    summary: e.summary,
    data: e.data ?? {},
    clientVisible: e.clientVisible ?? false,
  });
}

export async function audit(
  tx: Tx,
  actor: Pick<Actor, 'orgId' | 'userId'>,
  action: string,
  target: { type?: string; id?: string | null; metadata?: Record<string, unknown>; ip?: string | null } = {},
) {
  await tx.insert(auditEvents).values({
    orgId: actor.orgId,
    actorId: actor.userId || null,
    action,
    targetType: target.type ?? null,
    targetId: target.id ?? null,
    ipAddress: target.ip ?? null,
    metadata: target.metadata ?? {},
  });
}

export type NotificationCategory =
  | 'assignment'
  | 'mention'
  | 'comment'
  | 'status'
  | 'approval'
  | 'request'
  | 'due'
  | 'membership';

/**
 * Creates in-app notifications and queues emails in the current transaction.
 * - The actor never notifies themselves.
 * - Recipients are de-duplicated; an unread notification with the same dedupeKey is
 *   refreshed instead of duplicated (e.g. many comments on one task while away).
 * - Per-category preferences decide in-app and email delivery.
 * Callers must pass only recipients who can access the linked resource.
 */
export async function notify(
  tx: Tx,
  actor: Pick<Actor, 'orgId' | 'userId'>,
  n: {
    userIds: (string | null | undefined)[];
    category: NotificationCategory;
    title: string;
    body?: string | null;
    href: string;
    entityId?: string | null;
    dedupeKey?: string;
  },
) {
  const recipients = [...new Set(n.userIds.filter((id): id is string => Boolean(id) && id !== actor.userId))];
  if (recipients.length === 0) return;

  const prefs = await tx
    .select()
    .from(notificationPreferences)
    .where(inArray(notificationPreferences.userId, recipients));
  const prefOf = (userId: string) => prefs.find((p) => p.userId === userId && p.category === n.category);

  const inApp = recipients.filter((id) => prefOf(id)?.inApp ?? true);
  for (const userId of inApp) {
    const values = {
      orgId: actor.orgId,
      userId,
      // System notifications (worker jobs) pass an empty actor id.
      actorId: actor.userId || null,
      category: n.category,
      title: n.title,
      body: n.body ?? null,
      href: n.href,
      entityId: n.entityId ?? null,
      dedupeKey: n.dedupeKey ? `${n.dedupeKey}` : null,
    };
    if (n.dedupeKey) {
      await tx
        .insert(notifications)
        .values(values)
        .onConflictDoUpdate({
          target: [notifications.userId, notifications.dedupeKey],
          targetWhere: sqlUnreadDedupe,
          set: { title: values.title, body: values.body, actorId: values.actorId, readAt: null, createdAt: new Date(), archivedAt: null },
        });
    } else {
      await tx.insert(notifications).values(values);
    }
    await publish(tx, actor.orgId, `user:${userId}`, 'notification.created', null, { category: n.category });
  }

  const emailTo = recipients.filter((id) => prefOf(id)?.email ?? DEFAULT_EMAIL[n.category]);
  if (emailTo.length) {
    const [org] = await tx.select({ name: organizations.name }).from(organizations).where(eq(organizations.id, actor.orgId));
    const people = await tx
      .select({ id: users.id, email: users.email, locale: users.locale, isDemo: users.isDemo })
      .from(users)
      .where(inArray(users.id, emailTo));
    for (const p of people) {
      // Demo personas use reserved example.com addresses; their mail stays in the dev mailbox.
      await tx.insert(outbox).values({
        orgId: actor.orgId,
        type: 'email',
        payload: {
          to: p.email,
          locale: p.locale === 'ru' ? 'ru' : 'en',
          template: 'notification',
          data: { title: n.title, body: n.body ?? null, url: n.href, orgName: org?.name ?? 'Orqivanta', category: n.category },
        },
      });
    }
  }
}

const sqlUnreadDedupe = sql`read_at is null and dedupe_key is not null`;

/** Email defaults: important, actionable categories on; chatty ones off. */
export const DEFAULT_EMAIL: Record<NotificationCategory, boolean> = {
  assignment: true,
  mention: true,
  comment: false,
  status: false,
  approval: true,
  request: true,
  due: true,
  membership: true,
};
