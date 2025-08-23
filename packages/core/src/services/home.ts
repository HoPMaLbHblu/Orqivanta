import { z } from 'zod';
import {
  activityEvents,
  and,
  approvalReviewers,
  approvals,
  auditEvents,
  desc,
  eq,
  inArray,
  isNull,
  lt,
  projectMembers,
  projectStatuses,
  projects,
  requests,
  sql,
  taskWatchers,
  tasks,
  users,
  withTenant,
} from '@orqivanta/db';
import { parse } from '../lib/validate';
import type { Actor } from '../permissions';
import { assertOrg } from './context';
import { visibleProjectsSql } from './access';
import { listProjects } from './projects';
import { OPEN_REQUEST_STATUSES } from './requests';

/**
 * Counts on Home and My Work. Definitions (also shown in the UI):
 * - assigned: open tasks assigned to you (not completed/canceled, not archived/deleted)
 * - overdue: assigned tasks with a due date before today
 * - dueThisWeek: assigned tasks due today through the next 7 days
 * - reviews: pending approval rounds where you are a reviewer and haven't decided
 * - requests: open requests you own
 * - watching: open tasks you watch but aren't assigned to
 */
export async function getMyWorkCounts(actor: Actor) {
  return withTenant(actor.orgId, async (tx) => {
    const open = sql`${projectStatuses.category} not in ('completed','canceled')`;
    const today = sql`(now() at time zone 'utc')::date`;
    const base = and(eq(tasks.orgId, actor.orgId), isNull(tasks.deletedAt), isNull(tasks.archivedAt), isNull(projects.archivedAt), visibleProjectsSql(actor), open);
    const [t] = await tx
      .select({
        assigned: sql<number>`count(*) filter (where ${tasks.assigneeId} = ${actor.userId})::int`,
        overdue: sql<number>`count(*) filter (where ${tasks.assigneeId} = ${actor.userId} and ${tasks.dueDate} < ${today})::int`,
        dueThisWeek: sql<number>`count(*) filter (where ${tasks.assigneeId} = ${actor.userId} and ${tasks.dueDate} between ${today} and ${today} + 7)::int`,
        watching: sql<number>`count(*) filter (where ${tasks.assigneeId} is distinct from ${actor.userId} and exists (select 1 from ${taskWatchers} w where w.task_id = ${tasks.id} and w.user_id = ${actor.userId}))::int`,
      })
      .from(tasks)
      .innerJoin(projects, eq(projects.id, tasks.projectId))
      .innerJoin(projectStatuses, eq(projectStatuses.id, tasks.statusId))
      .where(base);
    const [rv] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(approvalReviewers)
      .innerJoin(approvals, eq(approvals.id, approvalReviewers.approvalId))
      .innerJoin(projects, eq(projects.id, approvals.projectId))
      .where(and(eq(approvalReviewers.userId, actor.userId), isNull(approvalReviewers.decision), eq(approvals.status, 'pending'), visibleProjectsSql(actor)));
    const [rq] =
      actor.role === 'client'
        ? [{ n: 0 }]
        : await tx
            .select({ n: sql<number>`count(*)::int` })
            .from(requests)
            .where(and(eq(requests.orgId, actor.orgId), eq(requests.ownerId, actor.userId), inArray(requests.status, ['submitted', 'in_review', 'needs_info', 'accepted', 'in_progress'])));
    return { assigned: t?.assigned ?? 0, overdue: t?.overdue ?? 0, dueThisWeek: t?.dueThisWeek ?? 0, watching: t?.watching ?? 0, reviews: rv?.n ?? 0, requests: rq?.n ?? 0 };
  });
}

const feedSchema = z.object({ projectId: z.uuid().optional(), before: z.string().datetime().optional(), limit: z.number().int().min(1).max(100).default(30) });

/** Activity across the projects the actor can see (plus org-level events for internal users). */
export async function listActivity(actor: Actor, input: unknown = {}) {
  const f = parse(feedSchema, input);
  return withTenant(actor.orgId, async (tx) => {
    const isClient = actor.role === 'client';
    const rows = await tx
      .select({
        id: activityEvents.id,
        verb: activityEvents.verb,
        entityType: activityEvents.entityType,
        entityId: activityEvents.entityId,
        summary: activityEvents.summary,
        createdAt: activityEvents.createdAt,
        projectId: activityEvents.projectId,
        projectKey: projects.key,
        projectName: projects.name,
        actorName: users.name,
        actorColor: users.avatarColor,
      })
      .from(activityEvents)
      .leftJoin(projects, eq(projects.id, activityEvents.projectId))
      .leftJoin(users, eq(users.id, activityEvents.actorId))
      .where(
        and(
          eq(activityEvents.orgId, actor.orgId),
          f.projectId ? eq(activityEvents.projectId, f.projectId) : undefined,
          sql`((${activityEvents.projectId} is null and ${!isClient}) or (${projects.id} is not null and ${visibleProjectsSql(actor)}))`,
          isClient ? eq(activityEvents.clientVisible, true) : undefined,
          isClient ? sql`(${activityEvents.entityType} <> 'request' or exists (select 1 from ${requests} r where r.id = ${activityEvents.entityId} and r.client_account_id = ${actor.clientAccountId}))` : undefined,
          f.before ? lt(activityEvents.createdAt, new Date(f.before)) : undefined,
        ),
      )
      .orderBy(desc(activityEvents.createdAt))
      .limit(f.limit + 1);
    return { items: rows.slice(0, f.limit), nextCursor: rows.length > f.limit ? rows[f.limit - 1]!.createdAt.toISOString() : null };
  });
}

/** Everything the Home dashboard shows, in one call. */
export async function getHome(actor: Actor) {
  const [counts, projectList, activity] = await Promise.all([getMyWorkCounts(actor), listProjects(actor, { status: 'active' }), listActivity(actor, { limit: 12 })]);
  const upcoming = await withTenant(actor.orgId, (tx) =>
    tx
      .select({ id: tasks.id, number: tasks.number, title: tasks.title, dueDate: tasks.dueDate, priority: tasks.priority, projectKey: projects.key, projectName: projects.name, statusName: projectStatuses.name, statusCategory: projectStatuses.category })
      .from(tasks)
      .innerJoin(projects, eq(projects.id, tasks.projectId))
      .innerJoin(projectStatuses, eq(projectStatuses.id, tasks.statusId))
      .where(
        and(
          eq(tasks.assigneeId, actor.userId),
          isNull(tasks.deletedAt),
          isNull(tasks.archivedAt),
          visibleProjectsSql(actor),
          sql`${projectStatuses.category} not in ('completed','canceled')`,
        ),
      )
      .orderBy(sql`${tasks.dueDate} asc nulls last`, sql`array_position(array['urgent','high','medium','low','none']::task_priority[], ${tasks.priority})`)
      .limit(8),
  );
  const reviews = await withTenant(actor.orgId, (tx) =>
    tx
      .select({ id: approvals.id, title: approvals.title, dueDate: approvals.dueDate, projectKey: projects.key, projectName: projects.name, round: approvals.round })
      .from(approvalReviewers)
      .innerJoin(approvals, eq(approvals.id, approvalReviewers.approvalId))
      .innerJoin(projects, eq(projects.id, approvals.projectId))
      .where(and(eq(approvalReviewers.userId, actor.userId), isNull(approvalReviewers.decision), eq(approvals.status, 'pending'), visibleProjectsSql(actor)))
      .orderBy(sql`${approvals.dueDate} asc nulls last`)
      .limit(6),
  );
  const myProjectIds = await withTenant(actor.orgId, async (tx) =>
    new Set((await tx.select({ id: projectMembers.projectId }).from(projectMembers).where(eq(projectMembers.userId, actor.userId))).map((r) => r.id)),
  );
  const projectsForHome = projectList
    .filter((p) => p.isFavorite || myProjectIds.has(p.id) || actor.role === 'owner' || actor.role === 'admin')
    .sort((a, b) => Number(b.isFavorite) - Number(a.isFavorite) || severity(b.health) - severity(a.health))
    .slice(0, 6);
  return { counts, upcoming, reviews, projects: projectsForHome, activity: activity.items, openRequests: OPEN_REQUEST_STATUSES.length ? counts.requests : 0 };
}

const severity = (h: string) => (h === 'off_track' ? 2 : h === 'at_risk' ? 1 : 0);

const auditSchema = z.object({ before: z.string().datetime().optional(), action: z.string().max(60).optional(), limit: z.number().int().min(1).max(200).default(50) });

export async function listAudit(actor: Actor, input: unknown = {}) {
  assertOrg(actor, 'audit.view');
  const f = parse(auditSchema, input);
  return withTenant(actor.orgId, async (tx) => {
    const rows = await tx
      .select({ id: auditEvents.id, action: auditEvents.action, targetType: auditEvents.targetType, targetId: auditEvents.targetId, metadata: auditEvents.metadata, ipAddress: auditEvents.ipAddress, createdAt: auditEvents.createdAt, actorName: users.name, actorEmail: users.email })
      .from(auditEvents)
      .leftJoin(users, eq(users.id, auditEvents.actorId))
      .where(and(eq(auditEvents.orgId, actor.orgId), f.action ? sql`${auditEvents.action} like ${f.action + '%'}` : undefined, f.before ? lt(auditEvents.createdAt, new Date(f.before)) : undefined))
      .orderBy(desc(auditEvents.createdAt))
      .limit(f.limit + 1);
    return { items: rows.slice(0, f.limit), nextCursor: rows.length > f.limit ? rows[f.limit - 1]!.createdAt.toISOString() : null };
  });
}
