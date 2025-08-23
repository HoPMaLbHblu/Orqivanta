import { z } from 'zod';
import {
  and,
  desc,
  eq,
  favorites,
  inArray,
  isNotNull,
  isNull,
  lt,
  notificationPreferences,
  notifications,
  recentItems,
  sql,
  users,
  withSystem,
  withTenant,
} from '@orqivanta/db';
import { DEFAULT_EMAIL, type NotificationCategory } from '../lib/events';
import { parse } from '../lib/validate';
import type { Actor } from '../permissions';
import { projects, type Tx } from '@orqivanta/db';
import { visibleProjectsSql } from './access';

/** Project ids the actor can open right now; used to drop stale favorites and recents. */
async function visibleProjectIds(tx: Tx, actor: Actor) {
  const rows = await tx.select({ id: projects.id }).from(projects).where(and(eq(projects.orgId, actor.orgId), visibleProjectsSql(actor)));
  return new Set(rows.map((r) => r.id));
}

export const NOTIFICATION_CATEGORIES: { id: NotificationCategory; label: string; description: string }[] = [
  { id: 'assignment', label: 'Assignments', description: 'A task is assigned to you.' },
  { id: 'mention', label: 'Mentions', description: 'Someone @mentions you in a comment or document.' },
  { id: 'comment', label: 'Comments', description: 'New comments on tasks, documents and requests you follow.' },
  { id: 'status', label: 'Status changes', description: 'Tasks you watch move, and project status updates.' },
  { id: 'approval', label: 'Approvals', description: 'Reviews requested from you and decisions on your reviews.' },
  { id: 'request', label: 'Requests', description: 'New requests you own and progress on requests you submitted.' },
  { id: 'due', label: 'Due dates', description: 'Your tasks are due soon or overdue.' },
  { id: 'membership', label: 'Membership', description: 'You join a project or your role changes.' },
];

const listSchema = z.object({
  filter: z.enum(['unread', 'all', 'archived']).default('all'),
  category: z.enum(['assignment', 'mention', 'comment', 'status', 'approval', 'request', 'due', 'membership']).optional(),
  before: z.string().datetime().optional(),
  limit: z.number().int().min(1).max(100).default(40),
});

/** The actor's notifications in the current organization, newest first, cursor-paginated. */
export async function listNotifications(actor: Actor, input: unknown = {}) {
  const f = parse(listSchema, input);
  return withTenant(actor.orgId, async (tx) => {
    const rows = await tx
      .select({
        id: notifications.id,
        category: notifications.category,
        title: notifications.title,
        body: notifications.body,
        href: notifications.href,
        readAt: notifications.readAt,
        archivedAt: notifications.archivedAt,
        createdAt: notifications.createdAt,
        actorName: users.name,
        actorColor: users.avatarColor,
      })
      .from(notifications)
      .leftJoin(users, eq(users.id, notifications.actorId))
      .where(
        and(
          eq(notifications.userId, actor.userId),
          eq(notifications.orgId, actor.orgId),
          f.filter === 'archived' ? isNotNull(notifications.archivedAt) : isNull(notifications.archivedAt),
          f.filter === 'unread' ? isNull(notifications.readAt) : undefined,
          f.category ? eq(notifications.category, f.category) : undefined,
          f.before ? lt(notifications.createdAt, new Date(f.before)) : undefined,
        ),
      )
      .orderBy(desc(notifications.createdAt))
      .limit(f.limit + 1);
    return { items: rows.slice(0, f.limit), nextCursor: rows.length > f.limit ? rows[f.limit - 1]!.createdAt.toISOString() : null };
  });
}

export async function unreadCount(actor: Actor) {
  const [row] = await withTenant(actor.orgId, (tx) =>
    tx
      .select({ n: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(eq(notifications.userId, actor.userId), eq(notifications.orgId, actor.orgId), isNull(notifications.readAt), isNull(notifications.archivedAt))),
  );
  return row?.n ?? 0;
}

export async function markNotifications(actor: Actor, input: unknown) {
  const data = parse(
    z.object({ ids: z.array(z.uuid()).max(200).optional(), all: z.boolean().optional(), action: z.enum(['read', 'unread', 'archive', 'unarchive']) }),
    input,
  );
  return withTenant(actor.orgId, async (tx) => {
    const scope = and(
      eq(notifications.userId, actor.userId),
      eq(notifications.orgId, actor.orgId),
      data.all ? undefined : inArray(notifications.id, data.ids?.length ? data.ids : ['00000000-0000-0000-0000-000000000000']),
    );
    const set =
      data.action === 'read'
        ? { readAt: new Date() }
        : data.action === 'unread'
          ? { readAt: null }
          : data.action === 'archive'
            ? { archivedAt: new Date(), readAt: sql`coalesce(${notifications.readAt}, now())` }
            : { archivedAt: null };
    await tx.update(notifications).set(set as never).where(and(scope, data.action === 'read' ? isNull(notifications.readAt) : undefined));
  });
}

export async function getNotificationPreferences(userId: string) {
  const rows = await withSystem((tx) => tx.select().from(notificationPreferences).where(eq(notificationPreferences.userId, userId)));
  return NOTIFICATION_CATEGORIES.map((c) => {
    const r = rows.find((x) => x.category === c.id);
    return { ...c, inApp: r?.inApp ?? true, email: r?.email ?? DEFAULT_EMAIL[c.id] };
  });
}

export async function setNotificationPreference(userId: string, input: unknown) {
  const data = parse(
    z.object({ category: z.enum(['assignment', 'mention', 'comment', 'status', 'approval', 'request', 'due', 'membership']), inApp: z.boolean(), email: z.boolean() }),
    input,
  );
  await withSystem((tx) =>
    tx
      .insert(notificationPreferences)
      .values({ userId, ...data })
      .onConflictDoUpdate({ target: [notificationPreferences.userId, notificationPreferences.category], set: { inApp: data.inApp, email: data.email } }),
  );
}

// ---------------------------------------------------------------------------
// Favorites and recent items
// ---------------------------------------------------------------------------

const entitySchema = z.object({ entityType: z.enum(['project', 'document', 'task', 'client']), entityId: z.uuid() });

export async function setFavorite(actor: Actor, input: unknown) {
  const data = parse(entitySchema.extend({ favorite: z.boolean() }), input);
  await withTenant(actor.orgId, async (tx) => {
    if (data.favorite) {
      const [{ n }] = (await tx.select({ n: sql<number>`count(*)::int` }).from(favorites).where(and(eq(favorites.userId, actor.userId), eq(favorites.orgId, actor.orgId)))) as [{ n: number }];
      await tx.insert(favorites).values({ orgId: actor.orgId, userId: actor.userId, entityType: data.entityType, entityId: data.entityId, position: n }).onConflictDoNothing();
    } else {
      await tx.delete(favorites).where(and(eq(favorites.userId, actor.userId), eq(favorites.entityType, data.entityType), eq(favorites.entityId, data.entityId)));
    }
  });
}

/** Favorites resolved to titles and links. Items the user can no longer see are skipped. */
export async function listFavorites(actor: Actor) {
  return withTenant(actor.orgId, async (tx) => {
    const visible = await visibleProjectIds(tx, actor);
    const rows = await tx.execute<{ entity_type: string; entity_id: string; title: string | null; key: string | null; color: string | null; project_id: string | null }>(sql`
      select f.entity_type, f.entity_id,
        coalesce(p.name, d.title) as title, p.key, p.color, coalesce(p.id, d.project_id) as project_id
      from favorites f
      left join projects p on f.entity_type = 'project' and p.id = f.entity_id and p.deleted_at is null
      left join documents d on f.entity_type = 'document' and d.id = f.entity_id and d.deleted_at is null
      where f.user_id = ${actor.userId} and f.org_id = ${actor.orgId}
      order by f.position, f.created_at`);
    return rows.rows
      .filter((r) => r.title && (r.project_id ? visible.has(r.project_id) : r.entity_type === 'document' && actor.role !== 'client'))
      .map((r) => ({ entityType: r.entity_type, entityId: r.entity_id, title: r.title!, key: r.key, color: r.color }));
  });
}

export async function recordView(actor: Actor, entityType: 'project' | 'document' | 'task' | 'request', entityId: string) {
  await withTenant(actor.orgId, (tx) =>
    tx
      .insert(recentItems)
      .values({ orgId: actor.orgId, userId: actor.userId, entityType, entityId })
      .onConflictDoUpdate({ target: [recentItems.userId, recentItems.entityType, recentItems.entityId], set: { viewedAt: new Date() } }),
  ).catch(() => undefined);
}

export async function listRecent(actor: Actor, limit = 8) {
  return withTenant(actor.orgId, async (tx) => {
    const visible = await visibleProjectIds(tx, actor);
    const rows = await tx.execute<{ entity_type: string; entity_id: string; title: string | null; ref: string | null; viewed_at: Date; project_id: string | null }>(sql`
      select r.entity_type, r.entity_id, r.viewed_at, coalesce(p.id, d.project_id, t.project_id) as project_id,
        coalesce(p.name, d.title, t.title, rq.title) as title,
        coalesce(p.key, tp.key || '-' || t.number, '#' || rq.number) as ref
      from recent_items r
      left join projects p on r.entity_type = 'project' and p.id = r.entity_id and p.deleted_at is null
      left join documents d on r.entity_type = 'document' and d.id = r.entity_id and d.deleted_at is null
      left join tasks t on r.entity_type = 'task' and t.id = r.entity_id and t.deleted_at is null
      left join projects tp on tp.id = t.project_id
      left join requests rq on r.entity_type = 'request' and rq.id = r.entity_id
      where r.user_id = ${actor.userId} and r.org_id = ${actor.orgId}
      order by r.viewed_at desc limit ${limit * 2}`);
    return rows.rows
      .filter((r) => r.title && (r.project_id ? visible.has(r.project_id) : actor.role !== 'client'))
      .slice(0, limit);
  });
}
