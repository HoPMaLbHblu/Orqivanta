import { z } from 'zod';
import {
  activityEvents,
  and,
  asc,
  clientAccounts,
  desc,
  eq,
  favorites,
  inArray,
  isNotNull,
  isNull,
  memberships,
  milestones,
  ne,
  projectMembers,
  projectStatuses,
  projectUpdates,
  projects,
  sql,
  taskDependencies,
  tasks,
  teams,
  users,
  withTenant,
  type Tx,
} from '@orqivanta/db';
import { conflict, notFound, validation } from '../errors';
import { audit, notify, publish, recordActivity } from '../lib/events';
import { richTextToPlain, sanitizeRichText } from '../lib/richtext';
import { parse, zName, zOptionalDate } from '../lib/validate';
import type { Actor } from '../permissions';
import { DEFAULT_STATUSES, PROJECT_TEMPLATES } from '../templates';
import { assertOrg } from './context';
import { assertWritable, getProjectAccess, requireProject, visibleProjectsSql } from './access';

export type Health = 'on_track' | 'at_risk' | 'off_track';

export interface ProjectStats {
  total: number;
  completed: number;
  canceled: number;
  open: number;
  overdue: number;
  blocked: number;
  /** completed ÷ (total − canceled). Null when there is nothing to measure. */
  progress: number | null;
}

/**
 * Health when no one has posted an update: off track if the project is past its due date
 * and unfinished; at risk if ≥ 20% of open tasks are overdue or blocked; otherwise on track.
 */
export function computeHealth(stats: ProjectStats, dueDate: string | null, today: string): Health {
  if (dueDate && dueDate < today && stats.progress !== 1 && stats.open > 0) return 'off_track';
  if (stats.open > 0 && (stats.overdue + stats.blocked) / stats.open >= 0.2) return 'at_risk';
  return 'on_track';
}

const todaySql = sql`(now() at time zone 'utc')::date`;

/** Task statistics for many projects in one query (no N+1). Subtasks count as tasks. */
async function statsFor(tx: Tx, projectIds: string[], opts: { sharedOnly?: boolean } = {}) {
  if (projectIds.length === 0) return new Map<string, ProjectStats>();
  const rows = await tx
    .select({
      projectId: tasks.projectId,
      total: sql<number>`count(*)::int`,
      completed: sql<number>`count(*) filter (where ${projectStatuses.category} = 'completed')::int`,
      canceled: sql<number>`count(*) filter (where ${projectStatuses.category} = 'canceled')::int`,
      overdue: sql<number>`count(*) filter (where ${projectStatuses.category} not in ('completed','canceled') and ${tasks.dueDate} < ${todaySql})::int`,
      blocked: sql<number>`count(*) filter (where ${projectStatuses.category} not in ('completed','canceled') and exists (
        select 1 from ${taskDependencies} d join ${tasks} b on b.id = d.blocker_id join ${projectStatuses} bs on bs.id = b.status_id
        where d.blocked_id = ${tasks.id} and bs.category not in ('completed','canceled') and b.deleted_at is null))::int`,
    })
    .from(tasks)
    .innerJoin(projectStatuses, eq(projectStatuses.id, tasks.statusId))
    .where(
      and(
        inArray(tasks.projectId, projectIds),
        isNull(tasks.deletedAt),
        isNull(tasks.archivedAt),
        opts.sharedOnly ? eq(tasks.sharedWithClient, true) : undefined,
      ),
    )
    .groupBy(tasks.projectId);
  const map = new Map<string, ProjectStats>();
  for (const id of projectIds) {
    const r = rows.find((x) => x.projectId === id);
    const total = r?.total ?? 0;
    const completed = r?.completed ?? 0;
    const canceled = r?.canceled ?? 0;
    const measurable = total - canceled;
    map.set(id, {
      total,
      completed,
      canceled,
      open: measurable - completed,
      overdue: r?.overdue ?? 0,
      blocked: r?.blocked ?? 0,
      progress: measurable > 0 ? completed / measurable : null,
    });
  }
  return map;
}

const listSchema = z.object({
  status: z.enum(['active', 'archived', 'all']).default('active'),
  clientAccountId: z.uuid().optional(),
  teamId: z.uuid().optional(),
  q: z.string().trim().max(100).optional(),
});

export async function listProjects(actor: Actor, input: unknown = {}) {
  const f = parse(listSchema, input);
  return withTenant(actor.orgId, async (tx) => {
    const rows = await tx
      .select({
        project: projects,
        clientName: clientAccounts.name,
        teamName: teams.name,
        ownerName: users.name,
        ownerColor: users.avatarColor,
        isFavorite: sql<boolean>`exists (select 1 from ${favorites} f where f.user_id = ${actor.userId} and f.entity_type = 'project' and f.entity_id = ${projects.id})`,
        latestHealth: sql<Health | null>`(select pu.health from ${projectUpdates} pu where pu.project_id = ${projects.id} ${
          actor.role === 'client' ? sql`and pu.shared_with_client` : sql``
        } order by pu.created_at desc limit 1)`,
      })
      .from(projects)
      .leftJoin(clientAccounts, eq(clientAccounts.id, projects.clientAccountId))
      .leftJoin(teams, eq(teams.id, projects.teamId))
      .leftJoin(users, eq(users.id, projects.ownerId))
      .where(
        and(
          eq(projects.orgId, actor.orgId),
          visibleProjectsSql(actor),
          f.status === 'active' ? isNull(projects.archivedAt) : f.status === 'archived' ? isNotNull(projects.archivedAt) : undefined,
          f.clientAccountId ? eq(projects.clientAccountId, f.clientAccountId) : undefined,
          f.teamId ? eq(projects.teamId, f.teamId) : undefined,
          f.q ? sql`(${projects.name} ilike ${'%' + f.q + '%'} or ${projects.key} ilike ${f.q + '%'})` : undefined,
        ),
      )
      .orderBy(asc(projects.name));
    const stats = await statsFor(tx, rows.map((r) => r.project.id), { sharedOnly: actor.role === 'client' });
    const today = new Date().toISOString().slice(0, 10);
    return rows.map((r) => {
      const s = stats.get(r.project.id)!;
      return {
        ...r.project,
        clientName: r.clientName,
        teamName: r.teamName,
        ownerName: r.ownerName,
        ownerColor: r.ownerColor,
        isFavorite: r.isFavorite,
        stats: s,
        health: (r.latestHealth ?? computeHealth(s, r.project.dueDate, today)) as Health,
        healthSource: r.latestHealth ? ('reported' as const) : ('computed' as const),
      };
    });
  });
}

const createSchema = z.object({
  name: zName('Project name', 80),
  key: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z][A-Z0-9]{1,5}$/, 'Use 2–6 letters or digits, starting with a letter.'),
  description: z.string().trim().max(2000).optional().nullable(),
  templateId: z.string().default('blank'),
  clientAccountId: z.uuid().optional().nullable(),
  teamId: z.uuid().optional().nullable(),
  visibility: z.enum(['private', 'team', 'org']).default('org'),
  startDate: zOptionalDate,
  dueDate: zOptionalDate,
  memberIds: z.array(z.uuid()).max(100).default([]),
  color: z.string().max(20).optional(),
});

export function suggestProjectKey(name: string) {
  const words = name.toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
  const key = words.length > 1 ? words.map((w) => w[0]).join('') : (words[0] ?? 'PRJ');
  return (key.length >= 2 ? key : (words[0] ?? 'PRJ')).slice(0, 4).padEnd(2, 'X');
}

export async function createProject(actor: Actor, input: unknown) {
  assertOrg(actor, 'projects.create');
  const data = parse(createSchema, input);
  if (data.startDate && data.dueDate && data.startDate > data.dueDate) {
    throw validation({ dueDate: 'The due date must be after the start date.' });
  }
  if (data.visibility === 'team' && !data.teamId) throw validation({ teamId: 'Choose a team for a team-visible project.' });
  const template = PROJECT_TEMPLATES.find((t) => t.id === data.templateId) ?? PROJECT_TEMPLATES[0]!;

  return withTenant(actor.orgId, async (tx) => {
    const [dupe] = await tx.select({ id: projects.id }).from(projects).where(and(eq(projects.orgId, actor.orgId), eq(projects.key, data.key)));
    if (dupe) throw validation({ key: `Key ${data.key} is already used by another project.` });
    if (data.clientAccountId) {
      const [c] = await tx.select().from(clientAccounts).where(eq(clientAccounts.id, data.clientAccountId));
      if (!c) throw validation({ clientAccountId: 'That client no longer exists.' });
    }
    if (data.teamId) {
      const [t] = await tx.select().from(teams).where(eq(teams.id, data.teamId));
      if (!t) throw validation({ teamId: 'That team no longer exists.' });
    }

    const [project] = await tx
      .insert(projects)
      .values({
        orgId: actor.orgId,
        key: data.key,
        name: data.name,
        description: data.description ?? null,
        goals: template.goals,
        visibility: data.visibility,
        teamId: data.teamId ?? null,
        clientAccountId: data.clientAccountId ?? null,
        ownerId: actor.userId,
        color: data.color ?? 'verdigris',
        startDate: data.startDate,
        dueDate: data.dueDate,
        createdBy: actor.userId,
      })
      .returning();
    const p = project!;

    const statuses = await tx
      .insert(projectStatuses)
      .values(DEFAULT_STATUSES.map((s, i) => ({ orgId: actor.orgId, projectId: p.id, name: s.name, category: s.category, position: i })))
      .returning();

    // Creator manages the project; invited members contribute. Only internal members qualify.
    const memberIds = [...new Set(data.memberIds.filter((id) => id !== actor.userId))];
    if (memberIds.length) {
      const valid = await tx
        .select({ userId: memberships.userId })
        .from(memberships)
        .where(and(eq(memberships.orgId, actor.orgId), ne(memberships.role, 'client'), inArray(memberships.userId, memberIds)));
      if (valid.length !== memberIds.length) throw validation({ memberIds: 'Only internal members can be added to a project.' });
    }
    await tx.insert(projectMembers).values([
      { orgId: actor.orgId, projectId: p.id, userId: actor.userId, role: 'manager' as const },
      ...memberIds.map((userId) => ({ orgId: actor.orgId, projectId: p.id, userId, role: 'contributor' as const })),
    ]);

    const start = data.startDate ? new Date(data.startDate) : new Date();
    const ms = template.milestones.length
      ? await tx
          .insert(milestones)
          .values(
            template.milestones.map((m, i) => ({
              orgId: actor.orgId,
              projectId: p.id,
              name: m.name,
              position: i,
              dueDate: new Date(start.getTime() + m.offsetDays * 86400_000).toISOString().slice(0, 10),
            })),
          )
          .returning()
      : [];
    if (template.tasks.length) {
      await tx.insert(tasks).values(
        template.tasks.map((t, i) => ({
          orgId: actor.orgId,
          projectId: p.id,
          number: i + 1,
          title: t.title,
          statusId: statuses.find((s) => s.category === t.status)!.id,
          priority: (t.priority ?? 'none') as 'none' | 'low' | 'medium' | 'high',
          milestoneId: t.milestone !== undefined ? (ms[t.milestone]?.id ?? null) : null,
          position: (i + 1) * 1000,
          createdBy: actor.userId,
        })),
      );
      await tx.update(projects).set({ taskSeq: template.tasks.length }).where(eq(projects.id, p.id));
    }

    await recordActivity(tx, actor, { projectId: p.id, verb: 'created', entityType: 'project', entityId: p.id, summary: `created the project ${p.name}` });
    await audit(tx, actor, 'project.created', { type: 'project', id: p.id, metadata: { key: p.key, template: template.id } });
    await publish(tx, actor.orgId, 'org', 'project.created', p.id);
    if (memberIds.length) {
      await notify(tx, actor, {
        userIds: memberIds,
        category: 'membership',
        title: `You were added to ${p.name}`,
        href: `/${actor.orgSlug}/projects/${p.key}`,
        entityId: p.id,
      });
    }
    return p;
  });
}

export async function getProjectByKey(actor: Actor, key: string) {
  return withTenant(actor.orgId, async (tx) => {
    const [row] = await tx
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.orgId, actor.orgId), eq(projects.key, key.toUpperCase())));
    if (!row) throw notFound('That project');
    const access = await getProjectAccess(tx, actor, row.id);
    return access;
  });
}

/** Everything the project overview tab shows, filtered for the viewer's role. */
export async function getProjectOverview(actor: Actor, projectId: string) {
  return withTenant(actor.orgId, async (tx) => {
    const access = await getProjectAccess(tx, actor, projectId);
    const p = access.project;
    const isClient = access.isClient;
    const [stats] = [(await statsFor(tx, [p.id], { sharedOnly: isClient })).get(p.id)!];
    const ms = await tx
      .select({
        milestone: milestones,
        total: sql<number>`(select count(*)::int from ${tasks} t where t.milestone_id = ${milestones.id} and t.deleted_at is null)`,
        done: sql<number>`(select count(*)::int from ${tasks} t join ${projectStatuses} s on s.id = t.status_id where t.milestone_id = ${milestones.id} and t.deleted_at is null and s.category = 'completed')`,
      })
      .from(milestones)
      .where(and(eq(milestones.projectId, p.id), isClient ? eq(milestones.sharedWithClient, true) : undefined))
      .orderBy(asc(milestones.position), asc(milestones.dueDate));
    const updates = await tx
      .select({ update: projectUpdates, authorName: users.name, authorColor: users.avatarColor })
      .from(projectUpdates)
      .leftJoin(users, eq(users.id, projectUpdates.authorId))
      .where(and(eq(projectUpdates.projectId, p.id), isClient ? eq(projectUpdates.sharedWithClient, true) : undefined))
      .orderBy(desc(projectUpdates.createdAt))
      .limit(10);
    const members = isClient
      ? []
      : await tx
          .select({ userId: users.id, name: users.name, email: users.email, avatarColor: users.avatarColor, role: projectMembers.role })
          .from(projectMembers)
          .innerJoin(users, eq(users.id, projectMembers.userId))
          .where(eq(projectMembers.projectId, p.id))
          .orderBy(asc(users.name));
    const activity = await tx
      .select({ event: activityEvents, actorName: users.name, actorColor: users.avatarColor })
      .from(activityEvents)
      .leftJoin(users, eq(users.id, activityEvents.actorId))
      .where(and(eq(activityEvents.projectId, p.id), isClient ? eq(activityEvents.clientVisible, true) : undefined))
      .orderBy(desc(activityEvents.createdAt))
      .limit(15);
    const [client] = p.clientAccountId
      ? await tx.select({ id: clientAccounts.id, name: clientAccounts.name }).from(clientAccounts).where(eq(clientAccounts.id, p.clientAccountId))
      : [];
    const [team] = p.teamId ? await tx.select({ id: teams.id, name: teams.name }).from(teams).where(eq(teams.id, p.teamId)) : [];
    const [owner] = p.ownerId ? await tx.select({ id: users.id, name: users.name, avatarColor: users.avatarColor }).from(users).where(eq(users.id, p.ownerId)) : [];
    const today = new Date().toISOString().slice(0, 10);
    const latest = updates[0]?.update;
    return {
      access: { role: access.role, isClient },
      project: isClient ? { ...p, description: p.description } : p,
      stats,
      health: latest?.health ?? computeHealth(stats, p.dueDate, today),
      healthSource: latest ? ('reported' as const) : ('computed' as const),
      milestones: ms.map((m) => ({ ...m.milestone, taskTotal: m.total, taskDone: m.done })),
      updates: updates.map((u) => ({ ...u.update, authorName: u.authorName, authorColor: u.authorColor })),
      members,
      activity: activity.map((a) => ({ ...a.event, actorName: a.actorName, actorColor: a.actorColor })),
      client: client ?? null,
      team: team ?? null,
      owner: owner ?? null,
    };
  });
}

const updateSchema = z.object({
  projectId: z.uuid(),
  version: z.number().int().positive(),
  name: zName('Project name', 80).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  goals: z.array(z.string().trim().min(1).max(200)).max(10).optional(),
  visibility: z.enum(['private', 'team', 'org']).optional(),
  teamId: z.uuid().nullable().optional(),
  clientAccountId: z.uuid().nullable().optional(),
  ownerId: z.uuid().nullable().optional(),
  startDate: zOptionalDate,
  dueDate: zOptionalDate,
  status: z.enum(['active', 'paused', 'completed']).optional(),
  color: z.string().max(20).optional(),
});

/** Updates project fields with optimistic concurrency: a stale version returns CONFLICT. */
export async function updateProject(actor: Actor, input: unknown) {
  const data = parse(updateSchema, input);
  return withTenant(actor.orgId, async (tx) => {
    const access = await requireProject(tx, actor, data.projectId, 'project.update');
    assertWritable(access);
    const { projectId, version, ...fields } = data;
    const patch = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));
    const merged = { ...access.project, ...patch };
    if (merged.startDate && merged.dueDate && merged.startDate > merged.dueDate) {
      throw validation({ dueDate: 'The due date must be after the start date.' });
    }
    if (merged.visibility === 'team' && !merged.teamId) throw validation({ teamId: 'Choose a team for a team-visible project.' });
    if (patch.clientAccountId === null && access.project.portalEnabled) {
      (patch as Record<string, unknown>).portalEnabled = false;
    }
    const [updated] = await tx
      .update(projects)
      .set({ ...patch, version: sql`${projects.version} + 1`, updatedAt: new Date() })
      .where(and(eq(projects.id, projectId), eq(projects.version, version)))
      .returning();
    if (!updated) throw conflict(access.project);
    await recordActivity(tx, actor, {
      projectId,
      verb: 'updated',
      entityType: 'project',
      entityId: projectId,
      summary: `updated project details`,
      data: { fields: Object.keys(patch) },
    });
    await publish(tx, actor.orgId, `project:${projectId}`, 'project.updated', projectId);
    return updated;
  });
}

export async function setProjectArchived(actor: Actor, input: unknown) {
  const { projectId, archived } = parse(z.object({ projectId: z.uuid(), archived: z.boolean() }), input);
  return withTenant(actor.orgId, async (tx) => {
    const access = await requireProject(tx, actor, projectId, 'project.archive');
    await tx
      .update(projects)
      .set({ archivedAt: archived ? new Date() : null, status: archived ? 'archived' : 'active', version: sql`${projects.version} + 1`, updatedAt: new Date() })
      .where(eq(projects.id, projectId));
    await recordActivity(tx, actor, { projectId, verb: archived ? 'archived' : 'restored', entityType: 'project', entityId: projectId, summary: archived ? 'archived the project' : 'restored the project' });
    await audit(tx, actor, archived ? 'project.archived' : 'project.restored', { type: 'project', id: projectId, metadata: { key: access.project.key } });
    await publish(tx, actor.orgId, `project:${projectId}`, 'project.updated', projectId);
  });
}

/** Soft delete. Restorable for 30 days from Settings → Projects, then purged by the worker. */
export async function deleteProject(actor: Actor, input: unknown) {
  const { projectId, confirmKey } = parse(z.object({ projectId: z.uuid(), confirmKey: z.string() }), input);
  return withTenant(actor.orgId, async (tx) => {
    const access = await requireProject(tx, actor, projectId, 'project.delete');
    if (confirmKey.trim().toUpperCase() !== access.project.key) throw validation({ confirmKey: `Type ${access.project.key} to confirm.` });
    await tx.update(projects).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(projects.id, projectId));
    await audit(tx, actor, 'project.deleted', { type: 'project', id: projectId, metadata: { key: access.project.key, name: access.project.name } });
    await publish(tx, actor.orgId, `project:${projectId}`, 'project.deleted', projectId);
  });
}

export async function listDeletedProjects(actor: Actor) {
  assertOrg(actor, 'org.update');
  return withTenant(actor.orgId, (tx) =>
    tx
      .select({ id: projects.id, key: projects.key, name: projects.name, deletedAt: projects.deletedAt })
      .from(projects)
      .where(and(eq(projects.orgId, actor.orgId), isNotNull(projects.deletedAt)))
      .orderBy(desc(projects.deletedAt)),
  );
}

export async function restoreDeletedProject(actor: Actor, input: unknown) {
  assertOrg(actor, 'org.update');
  const { projectId } = parse(z.object({ projectId: z.uuid() }), input);
  await withTenant(actor.orgId, async (tx) => {
    const [p] = await tx.update(projects).set({ deletedAt: null }).where(and(eq(projects.id, projectId), isNotNull(projects.deletedAt))).returning();
    if (!p) throw notFound('That project');
    await audit(tx, actor, 'project.undeleted', { type: 'project', id: projectId, metadata: { key: p.key } });
  });
}

// ---------------------------------------------------------------------------
// Client portal sharing
// ---------------------------------------------------------------------------

export async function setPortalEnabled(actor: Actor, input: unknown) {
  const { projectId, enabled } = parse(z.object({ projectId: z.uuid(), enabled: z.boolean() }), input);
  return withTenant(actor.orgId, async (tx) => {
    const access = await requireProject(tx, actor, projectId, 'project.shareWithClient');
    if (enabled && !access.project.clientAccountId) {
      throw validation({ enabled: 'Link this project to a client before opening it in the portal.' });
    }
    await tx.update(projects).set({ portalEnabled: enabled, version: sql`${projects.version} + 1`, updatedAt: new Date() }).where(eq(projects.id, projectId));
    await recordActivity(tx, actor, {
      projectId,
      verb: enabled ? 'shared' : 'unshared',
      entityType: 'project',
      entityId: projectId,
      summary: enabled ? 'opened the project in the client portal' : 'closed the project in the client portal',
    });
    await audit(tx, actor, enabled ? 'project.portal_enabled' : 'project.portal_disabled', { type: 'project', id: projectId });
    await publish(tx, actor.orgId, `project:${projectId}`, 'project.updated', projectId);
  });
}

// ---------------------------------------------------------------------------
// Project members
// ---------------------------------------------------------------------------

export async function addProjectMembers(actor: Actor, input: unknown) {
  const data = parse(
    z.object({ projectId: z.uuid(), userIds: z.array(z.uuid()).min(1).max(50), role: z.enum(['manager', 'contributor', 'viewer']) }),
    input,
  );
  return withTenant(actor.orgId, async (tx) => {
    const access = await requireProject(tx, actor, data.projectId, 'project.manageMembers');
    const valid = await tx
      .select({ userId: memberships.userId })
      .from(memberships)
      .where(and(eq(memberships.orgId, actor.orgId), eq(memberships.status, 'active'), ne(memberships.role, 'client'), inArray(memberships.userId, data.userIds)));
    if (valid.length !== new Set(data.userIds).size) throw validation({ userIds: 'Only active internal members can be added.' });
    await tx
      .insert(projectMembers)
      .values(valid.map((v) => ({ orgId: actor.orgId, projectId: data.projectId, userId: v.userId, role: data.role })))
      .onConflictDoUpdate({ target: [projectMembers.projectId, projectMembers.userId], set: { role: data.role } });
    await notify(tx, actor, {
      userIds: valid.map((v) => v.userId),
      category: 'membership',
      title: `You were added to ${access.project.name}`,
      href: `/${actor.orgSlug}/projects/${access.project.key}`,
      entityId: data.projectId,
    });
    await publish(tx, actor.orgId, `project:${data.projectId}`, 'project.members', data.projectId);
  });
}

export async function changeProjectMemberRole(actor: Actor, input: unknown) {
  const data = parse(z.object({ projectId: z.uuid(), userId: z.uuid(), role: z.enum(['manager', 'contributor', 'viewer']) }), input);
  return withTenant(actor.orgId, async (tx) => {
    await requireProject(tx, actor, data.projectId, 'project.manageMembers');
    if (data.role !== 'manager') await assertAnotherManager(tx, data.projectId, data.userId);
    const [row] = await tx
      .update(projectMembers)
      .set({ role: data.role })
      .where(and(eq(projectMembers.projectId, data.projectId), eq(projectMembers.userId, data.userId)))
      .returning();
    if (!row) throw notFound('That project member');
    await publish(tx, actor.orgId, `project:${data.projectId}`, 'project.members', data.projectId);
    await publish(tx, actor.orgId, `user:${data.userId}`, 'access.changed', null);
  });
}

async function assertAnotherManager(tx: Tx, projectId: string, leavingUserId: string) {
  const managers = await tx
    .select({ userId: projectMembers.userId })
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.role, 'manager')));
  if (managers.length === 1 && managers[0]!.userId === leavingUserId) {
    throw validation({ role: 'A project needs at least one manager. Promote someone else first.' });
  }
}

export async function removeProjectMember(actor: Actor, input: unknown) {
  const data = parse(z.object({ projectId: z.uuid(), userId: z.uuid() }), input);
  return withTenant(actor.orgId, async (tx) => {
    if (data.userId !== actor.userId) await requireProject(tx, actor, data.projectId, 'project.manageMembers');
    await assertAnotherManager(tx, data.projectId, data.userId);
    await tx.delete(projectMembers).where(and(eq(projectMembers.projectId, data.projectId), eq(projectMembers.userId, data.userId)));
    await publish(tx, actor.orgId, `project:${data.projectId}`, 'project.members', data.projectId);
    await publish(tx, actor.orgId, `user:${data.userId}`, 'access.changed', null);
  });
}

// ---------------------------------------------------------------------------
// Milestones and status updates
// ---------------------------------------------------------------------------

const milestoneSchema = z.object({
  projectId: z.uuid(),
  milestoneId: z.uuid().optional(),
  name: zName('Milestone name', 120),
  description: z.string().trim().max(1000).optional().nullable(),
  dueDate: zOptionalDate,
  status: z.enum(['planned', 'in_progress', 'done', 'missed']).default('planned'),
  sharedWithClient: z.boolean().default(false),
});

export async function saveMilestone(actor: Actor, input: unknown) {
  const data = parse(milestoneSchema, input);
  return withTenant(actor.orgId, async (tx) => {
    const access = await requireProject(tx, actor, data.projectId, 'milestone.manage');
    assertWritable(access);
    const values = {
      name: data.name,
      description: data.description ?? null,
      dueDate: data.dueDate,
      status: data.status,
      sharedWithClient: data.sharedWithClient,
      completedAt: data.status === 'done' ? new Date() : null,
      updatedAt: new Date(),
    };
    let row;
    if (data.milestoneId) {
      [row] = await tx.update(milestones).set(values).where(and(eq(milestones.id, data.milestoneId), eq(milestones.projectId, data.projectId))).returning();
      if (!row) throw notFound('That milestone');
    } else {
      const [{ max }] = (await tx.select({ max: sql<number>`coalesce(max(position), -1)::int` }).from(milestones).where(eq(milestones.projectId, data.projectId))) as [{ max: number }];
      [row] = await tx.insert(milestones).values({ ...values, orgId: actor.orgId, projectId: data.projectId, position: max + 1 }).returning();
    }
    await recordActivity(tx, actor, {
      projectId: data.projectId,
      verb: data.milestoneId ? 'updated' : 'created',
      entityType: 'milestone',
      entityId: row!.id,
      summary: data.status === 'done' ? `completed milestone ${row!.name}` : `${data.milestoneId ? 'updated' : 'added'} milestone ${row!.name}`,
      clientVisible: row!.sharedWithClient,
    });
    await publish(tx, actor.orgId, `project:${data.projectId}`, 'milestone.updated', row!.id, { clientVisible: row!.sharedWithClient });
    return row!;
  });
}

export async function deleteMilestone(actor: Actor, input: unknown) {
  const data = parse(z.object({ projectId: z.uuid(), milestoneId: z.uuid() }), input);
  return withTenant(actor.orgId, async (tx) => {
    await requireProject(tx, actor, data.projectId, 'milestone.manage');
    await tx.update(tasks).set({ milestoneId: null }).where(eq(tasks.milestoneId, data.milestoneId));
    const [row] = await tx.delete(milestones).where(and(eq(milestones.id, data.milestoneId), eq(milestones.projectId, data.projectId))).returning();
    if (!row) throw notFound('That milestone');
    await publish(tx, actor.orgId, `project:${data.projectId}`, 'milestone.updated', data.milestoneId);
  });
}

const updatePostSchema = z.object({
  projectId: z.uuid(),
  health: z.enum(['on_track', 'at_risk', 'off_track']),
  summary: z.string().trim().min(1, 'Write a one-line summary.').max(200),
  body: z.unknown().optional(),
  sharedWithClient: z.boolean().default(false),
});

/** Posts a status update. Watchers of the project (its members) are notified. */
export async function postProjectUpdate(actor: Actor, input: unknown) {
  const data = parse(updatePostSchema, input);
  return withTenant(actor.orgId, async (tx) => {
    const access = await requireProject(tx, actor, data.projectId, 'project.postUpdate');
    const body = data.body ? sanitizeRichText(data.body) : null;
    const [row] = await tx
      .insert(projectUpdates)
      .values({
        orgId: actor.orgId,
        projectId: data.projectId,
        health: data.health,
        summary: data.summary,
        body,
        bodyText: body ? richTextToPlain(body) : null,
        sharedWithClient: data.sharedWithClient,
        authorId: actor.userId,
      })
      .returning();
    await recordActivity(tx, actor, {
      projectId: data.projectId,
      verb: 'posted',
      entityType: 'project_update',
      entityId: row!.id,
      summary: `posted a status update: ${data.summary}`,
      data: { health: data.health },
      clientVisible: data.sharedWithClient,
    });
    const members = await tx.select({ userId: projectMembers.userId }).from(projectMembers).where(eq(projectMembers.projectId, data.projectId));
    await notify(tx, actor, {
      userIds: members.map((m) => m.userId),
      category: 'status',
      title: `${access.project.name}: ${data.summary}`,
      href: `/${actor.orgSlug}/projects/${access.project.key}`,
      entityId: data.projectId,
    });
    if (data.sharedWithClient && access.project.portalEnabled && access.project.clientAccountId) {
      await notify(tx, actor, {
        userIds: await clientContactIds(tx, access.project.clientAccountId),
        category: 'status',
        title: `${access.project.name}: ${data.summary}`,
        href: `/portal/${actor.orgSlug}/projects/${access.project.key}`,
        entityId: data.projectId,
      });
    }
    await publish(tx, actor.orgId, `project:${data.projectId}`, 'project.update_posted', row!.id, { clientVisible: data.sharedWithClient });
    return row!;
  });
}

export async function listStatuses(actor: Actor, projectId: string) {
  return withTenant(actor.orgId, async (tx) => {
    await getProjectAccess(tx, actor, projectId);
    return tx.select().from(projectStatuses).where(eq(projectStatuses.projectId, projectId)).orderBy(asc(projectStatuses.position));
  });
}

/** Active contacts of a client account, for client-facing notifications. */
export async function clientContactIds(tx: Tx, clientAccountId: string) {
  const rows = await tx
    .select({ userId: memberships.userId })
    .from(memberships)
    .where(and(eq(memberships.role, 'client'), eq(memberships.clientAccountId, clientAccountId), eq(memberships.status, 'active')));
  return rows.map((r) => r.userId);
}

export { statsFor };
