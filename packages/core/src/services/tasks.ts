import { z } from 'zod';
import {
  and,
  asc,
  checklistItems,
  comments,
  desc,
  eq,
  files,
  inArray,
  isNotNull,
  isNull,
  labels,
  memberships,
  milestones,
  projectMembers,
  projectStatuses,
  projects,
  requests,
  savedViews,
  sql,
  taskDependencies,
  taskHistory,
  taskLabels,
  taskWatchers,
  tasks,
  teamMembers,
  users,
  withTenant,
  type Tx,
} from '@orqivanta/db';
import { conflict, notFound, precondition, validation } from '../errors';
import { notify, publish, recordActivity } from '../lib/events';
import { extractMentions, richTextToPlain, sanitizeRichText, truncate } from '../lib/richtext';
import { parse, zOptionalDate } from '../lib/validate';
import { effectiveProjectRole, type Actor } from '../permissions';
import {
  assertItemVisible,
  assertWritable,
  getProjectAccess,
  requireProject,
  visibleProjectsSql,
  type ProjectAccess,
  type ProjectRow,
} from './access';
import { completeRequestsForTask } from './requests';

export type TaskPriority = 'none' | 'low' | 'medium' | 'high' | 'urgent';
const PRIORITY_RANK: Record<TaskPriority, number> = { urgent: 0, high: 1, medium: 2, low: 3, none: 4 };

export const taskRef = (projectKey: string, number: number) => `${projectKey}-${number}`;
export const taskHref = (orgSlug: string, projectKey: string, number: number) => `/${orgSlug}/tasks/${taskRef(projectKey, number)}`;

/** Can this user (not necessarily the actor) open the project? Used to validate assignees. */
export async function userCanAccessProject(tx: Tx, project: ProjectRow, userId: string) {
  const [m] = await tx
    .select({ role: memberships.role, clientAccountId: memberships.clientAccountId, status: memberships.status })
    .from(memberships)
    .where(and(eq(memberships.orgId, project.orgId), eq(memberships.userId, userId)));
  if (!m || m.status !== 'active') return null;
  const [pm] = await tx
    .select({ role: projectMembers.role })
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, project.id), eq(projectMembers.userId, userId)));
  let inTeam = false;
  if (project.teamId) {
    const [tm] = await tx.select().from(teamMembers).where(and(eq(teamMembers.teamId, project.teamId), eq(teamMembers.userId, userId)));
    inTeam = Boolean(tm);
  }
  return effectiveProjectRole({
    orgRole: m.role,
    actorClientAccountId: m.clientAccountId,
    projectMemberRole: pm?.role ?? null,
    visibility: project.visibility,
    inProjectTeam: inTeam,
    projectClientAccountId: project.clientAccountId,
    portalEnabled: project.portalEnabled,
  });
}

async function assertAssignable(tx: Tx, project: ProjectRow, userId: string | null | undefined) {
  if (!userId) return;
  const role = await userCanAccessProject(tx, project, userId);
  if (!role || role === 'client') throw validation({ assigneeId: 'That person can’t access this project. Add them to it first.' });
}

// ---------------------------------------------------------------------------
// Listing
// ---------------------------------------------------------------------------

export const taskFilterSchema = z.object({
  projectId: z.uuid().optional(),
  assignee: z.union([z.literal('me'), z.literal('none'), z.uuid()]).optional(),
  statusIds: z.array(z.uuid()).max(20).optional(),
  categories: z.array(z.enum(['backlog', 'unstarted', 'started', 'review', 'completed', 'canceled'])).optional(),
  priorities: z.array(z.enum(['none', 'low', 'medium', 'high', 'urgent'])).optional(),
  labelIds: z.array(z.uuid()).max(20).optional(),
  milestoneId: z.uuid().optional(),
  due: z.enum(['overdue', 'today', 'week', 'none', 'any']).optional(),
  q: z.string().trim().max(100).optional(),
  watching: z.boolean().optional(),
  includeArchived: z.boolean().optional(),
  topLevelOnly: z.boolean().optional(),
  sort: z.enum(['manual', 'priority', 'due', 'created', 'updated', 'title']).default('manual'),
  limit: z.number().int().min(1).max(500).default(300),
});
export type TaskFilter = z.input<typeof taskFilterSchema>;

export async function listTasks(actor: Actor, input: unknown) {
  const f = parse(taskFilterSchema, input);
  return withTenant(actor.orgId, async (tx) => {
    let isClient = actor.role === 'client';
    if (f.projectId) isClient = (await getProjectAccess(tx, actor, f.projectId)).isClient;
    const today = sql`(now() at time zone 'utc')::date`;
    const conds = [
      eq(tasks.orgId, actor.orgId),
      isNull(tasks.deletedAt),
      visibleProjectsSql(actor),
      f.includeArchived ? undefined : isNull(tasks.archivedAt),
      isNull(projects.archivedAt),
      f.projectId ? eq(tasks.projectId, f.projectId) : undefined,
      isClient ? eq(tasks.sharedWithClient, true) : undefined,
      f.assignee === 'me' ? eq(tasks.assigneeId, actor.userId) : f.assignee === 'none' ? isNull(tasks.assigneeId) : f.assignee ? eq(tasks.assigneeId, f.assignee) : undefined,
      f.statusIds?.length ? inArray(tasks.statusId, f.statusIds) : undefined,
      f.categories?.length ? inArray(projectStatuses.category, f.categories) : undefined,
      f.priorities?.length ? inArray(tasks.priority, f.priorities) : undefined,
      f.milestoneId ? eq(tasks.milestoneId, f.milestoneId) : undefined,
      f.labelIds?.length
        ? sql`exists (select 1 from ${taskLabels} tl where tl.task_id = ${tasks.id} and tl.label_id in ${f.labelIds})`
        : undefined,
      f.due === 'overdue'
        ? and(sql`${tasks.dueDate} < ${today}`, sql`${projectStatuses.category} not in ('completed','canceled')`)
        : f.due === 'today'
          ? sql`${tasks.dueDate} = ${today}`
          : f.due === 'week'
            ? sql`${tasks.dueDate} between ${today} and ${today} + 7`
            : f.due === 'none'
              ? isNull(tasks.dueDate)
              : f.due === 'any'
                ? isNotNull(tasks.dueDate)
                : undefined,
      f.q ? sql`(${tasks.title} ilike ${'%' + f.q + '%'} or ${tasks.search} @@ plainto_tsquery('simple', ${f.q}))` : undefined,
      f.watching ? sql`exists (select 1 from ${taskWatchers} w where w.task_id = ${tasks.id} and w.user_id = ${actor.userId})` : undefined,
      f.topLevelOnly ? isNull(tasks.parentId) : undefined,
    ];
    const order =
      f.sort === 'priority'
        ? [sql`array_position(array['urgent','high','medium','low','none']::task_priority[], ${tasks.priority})`, asc(tasks.position)]
        : f.sort === 'due'
          ? [sql`${tasks.dueDate} asc nulls last`, asc(tasks.position)]
          : f.sort === 'created'
            ? [desc(tasks.createdAt)]
            : f.sort === 'updated'
              ? [desc(tasks.updatedAt)]
              : f.sort === 'title'
                ? [asc(tasks.title)]
                : [asc(projectStatuses.position), asc(tasks.position)];
    const rows = await tx
      .select({
        id: tasks.id,
        projectId: tasks.projectId,
        projectKey: projects.key,
        projectName: projects.name,
        projectColor: projects.color,
        number: tasks.number,
        title: tasks.title,
        statusId: tasks.statusId,
        statusName: projectStatuses.name,
        statusCategory: projectStatuses.category,
        priority: tasks.priority,
        assigneeId: tasks.assigneeId,
        assigneeName: users.name,
        assigneeColor: users.avatarColor,
        dueDate: tasks.dueDate,
        startDate: tasks.startDate,
        position: tasks.position,
        parentId: tasks.parentId,
        milestoneId: tasks.milestoneId,
        sharedWithClient: tasks.sharedWithClient,
        version: tasks.version,
        archivedAt: tasks.archivedAt,
        completedAt: tasks.completedAt,
        createdAt: tasks.createdAt,
        updatedAt: tasks.updatedAt,
        subtaskTotal: sql<number>`(select count(*)::int from ${tasks} st where st.parent_id = ${tasks.id} and st.deleted_at is null)`,
        subtaskDone: sql<number>`(select count(*)::int from ${tasks} st join ${projectStatuses} ss on ss.id = st.status_id where st.parent_id = ${tasks.id} and st.deleted_at is null and ss.category = 'completed')`,
        commentCount: isClient
          ? sql<number>`(select count(*)::int from ${comments} c where c.task_id = ${tasks.id} and c.deleted_at is null and c.visibility = 'client')`
          : sql<number>`(select count(*)::int from ${comments} c where c.task_id = ${tasks.id} and c.deleted_at is null)`,
        attachmentCount: sql<number>`(select count(*)::int from ${files} fl where fl.task_id = ${tasks.id} and fl.deleted_at is null)`,
        blocked: sql<boolean>`exists (select 1 from ${taskDependencies} d join ${tasks} b on b.id = d.blocker_id join ${projectStatuses} bs on bs.id = b.status_id where d.blocked_id = ${tasks.id} and b.deleted_at is null and bs.category not in ('completed','canceled'))`,
      })
      .from(tasks)
      .innerJoin(projects, eq(projects.id, tasks.projectId))
      .innerJoin(projectStatuses, eq(projectStatuses.id, tasks.statusId))
      .leftJoin(users, eq(users.id, tasks.assigneeId))
      .where(and(...conds))
      .orderBy(...order)
      .limit(f.limit + 1);
    const truncated = rows.length > f.limit;
    const list = truncated ? rows.slice(0, f.limit) : rows;
    const ids = list.map((r) => r.id);
    const tl = ids.length
      ? await tx
          .select({ taskId: taskLabels.taskId, id: labels.id, name: labels.name, color: labels.color })
          .from(taskLabels)
          .innerJoin(labels, eq(labels.id, taskLabels.labelId))
          .where(inArray(taskLabels.taskId, ids))
      : [];
    return {
      tasks: list.map((r) => ({ ...r, ref: taskRef(r.projectKey, r.number), labels: tl.filter((l) => l.taskId === r.id).map(({ taskId: _t, ...l }) => l) })),
      truncated,
    };
  });
}

export type TaskListItem = Awaited<ReturnType<typeof listTasks>>['tasks'][number];

// ---------------------------------------------------------------------------
// Detail
// ---------------------------------------------------------------------------

export function parseTaskRef(ref: string) {
  const m = /^([A-Za-z][A-Za-z0-9]{1,5})-(\d{1,7})$/.exec(ref);
  if (!m) return null;
  return { key: m[1]!.toUpperCase(), number: Number(m[2]) };
}

async function findTaskByRef(tx: Tx, actor: Actor, ref: string) {
  const parsed = parseTaskRef(ref);
  if (!parsed) throw notFound('That task');
  const [row] = await tx
    .select({ task: tasks })
    .from(tasks)
    .innerJoin(projects, eq(projects.id, tasks.projectId))
    .where(and(eq(projects.orgId, actor.orgId), eq(projects.key, parsed.key), eq(tasks.number, parsed.number)));
  if (!row) throw notFound('That task');
  return row.task;
}

async function loadTaskWithAccess(tx: Tx, actor: Actor, taskId: string, opts: { includeDeleted?: boolean } = {}) {
  const [task] = await tx.select().from(tasks).where(eq(tasks.id, taskId));
  if (!task || (task.deletedAt && !opts.includeDeleted)) throw notFound('That task');
  const access = await getProjectAccess(tx, actor, task.projectId);
  assertItemVisible(access, task.sharedWithClient, 'That task');
  return { task, access };
}

export async function getTask(actor: Actor, ref: string) {
  return withTenant(actor.orgId, async (tx) => {
    const t = await findTaskByRef(tx, actor, ref);
    const { task, access } = await loadTaskWithAccess(tx, actor, t.id, { includeDeleted: true });
    if (task.deletedAt && access.isClient) throw notFound('That task');
    const isClient = access.isClient;
    const [status] = await tx.select().from(projectStatuses).where(eq(projectStatuses.id, task.statusId));
    const statuses = await tx.select().from(projectStatuses).where(eq(projectStatuses.projectId, task.projectId)).orderBy(asc(projectStatuses.position));
    const people = (ids: (string | null)[]) => {
      const list = ids.filter((x): x is string => Boolean(x));
      return list.length ? tx.select({ id: users.id, name: users.name, avatarColor: users.avatarColor }).from(users).where(inArray(users.id, list)) : Promise.resolve([]);
    };
    const [assignee] = await people([task.assigneeId]);
    const [creator] = await people([task.createdBy]);
    const taskLabelRows = await tx
      .select({ id: labels.id, name: labels.name, color: labels.color })
      .from(taskLabels)
      .innerJoin(labels, eq(labels.id, taskLabels.labelId))
      .where(eq(taskLabels.taskId, task.id));
    const watchers = isClient
      ? []
      : await tx
          .select({ id: users.id, name: users.name, avatarColor: users.avatarColor })
          .from(taskWatchers)
          .innerJoin(users, eq(users.id, taskWatchers.userId))
          .where(eq(taskWatchers.taskId, task.id));
    const subtasks = await tx
      .select({
        id: tasks.id,
        number: tasks.number,
        title: tasks.title,
        statusId: tasks.statusId,
        statusCategory: projectStatuses.category,
        statusName: projectStatuses.name,
        assigneeName: users.name,
        assigneeColor: users.avatarColor,
        dueDate: tasks.dueDate,
        version: tasks.version,
      })
      .from(tasks)
      .innerJoin(projectStatuses, eq(projectStatuses.id, tasks.statusId))
      .leftJoin(users, eq(users.id, tasks.assigneeId))
      .where(and(eq(tasks.parentId, task.id), isNull(tasks.deletedAt), isClient ? eq(tasks.sharedWithClient, true) : undefined))
      .orderBy(asc(tasks.position));
    const [parent] = task.parentId
      ? await tx.select({ id: tasks.id, number: tasks.number, title: tasks.title, shared: tasks.sharedWithClient }).from(tasks).where(eq(tasks.id, task.parentId))
      : [];
    const checklist = await tx.select().from(checklistItems).where(eq(checklistItems.taskId, task.id)).orderBy(asc(checklistItems.position), asc(checklistItems.createdAt));
    const depSelect = (col: 'blocker' | 'blocked') =>
      tx
        .select({
          id: tasks.id,
          number: tasks.number,
          title: tasks.title,
          projectKey: projects.key,
          statusCategory: projectStatuses.category,
          shared: tasks.sharedWithClient,
        })
        .from(taskDependencies)
        .innerJoin(tasks, eq(tasks.id, col === 'blocker' ? taskDependencies.blockerId : taskDependencies.blockedId))
        .innerJoin(projects, eq(projects.id, tasks.projectId))
        .innerJoin(projectStatuses, eq(projectStatuses.id, tasks.statusId))
        .where(and(eq(col === 'blocker' ? taskDependencies.blockedId : taskDependencies.blockerId, task.id), isNull(tasks.deletedAt)));
    const blockedBy = (await depSelect('blocker')).filter((d) => !isClient || d.shared);
    const blocking = (await depSelect('blocked')).filter((d) => !isClient || d.shared);
    const history = isClient
      ? []
      : await tx
          .select({ id: taskHistory.id, field: taskHistory.field, fromValue: taskHistory.fromValue, toValue: taskHistory.toValue, createdAt: taskHistory.createdAt, actorName: users.name, actorColor: users.avatarColor })
          .from(taskHistory)
          .leftJoin(users, eq(users.id, taskHistory.actorId))
          .where(eq(taskHistory.taskId, task.id))
          .orderBy(desc(taskHistory.createdAt))
          .limit(100);
    const [milestone] = task.milestoneId ? await tx.select({ id: milestones.id, name: milestones.name }).from(milestones).where(eq(milestones.id, task.milestoneId)) : [];
    const [sourceRequest] = task.sourceRequestId && !isClient
      ? await tx.select({ id: requests.id, number: requests.number, title: requests.title }).from(requests).where(eq(requests.id, task.sourceRequestId))
      : [];
    const isWatching = watchers.some((w) => w.id === actor.userId);
    return {
      task: isClient ? { ...task, estimate: null } : task,
      ref: taskRef(access.project.key, task.number),
      project: { id: access.project.id, key: access.project.key, name: access.project.name, archived: Boolean(access.project.archivedAt), clientAccountId: access.project.clientAccountId, portalEnabled: access.project.portalEnabled },
      access: { role: access.role, isClient, canEdit: access.can('task.update') && !access.project.archivedAt, canDelete: access.can('task.delete'), canShare: access.can('project.shareWithClient') },
      status: status!,
      statuses,
      assignee: assignee ?? null,
      creator: creator ?? null,
      labels: taskLabelRows,
      watchers,
      isWatching,
      subtasks,
      parent: parent && (!isClient || parent.shared) ? parent : null,
      checklist,
      blockedBy,
      blocking,
      history,
      milestone: milestone ?? null,
      sourceRequest: sourceRequest ?? null,
    };
  });
}

export type TaskDetail = Awaited<ReturnType<typeof getTask>>;

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

const createSchema = z.object({
  projectId: z.uuid(),
  title: z.string().trim().min(1, 'Give the task a title.').max(300, 'Keep the title under 300 characters.'),
  description: z.unknown().optional(),
  statusId: z.uuid().optional(),
  priority: z.enum(['none', 'low', 'medium', 'high', 'urgent']).default('none'),
  assigneeId: z.uuid().nullable().optional(),
  dueDate: zOptionalDate,
  startDate: zOptionalDate,
  parentId: z.uuid().nullable().optional(),
  milestoneId: z.uuid().nullable().optional(),
  labelIds: z.array(z.uuid()).max(10).default([]),
  sharedWithClient: z.boolean().default(false),
  estimate: z.number().int().min(0).max(1000).nullable().optional(),
  sourceRequestId: z.uuid().nullable().optional(),
});

export async function createTaskInTx(tx: Tx, actor: Actor, access: ProjectAccess, input: z.infer<typeof createSchema>) {
  const data = input;
  if (data.startDate && data.dueDate && data.startDate > data.dueDate) throw validation({ dueDate: 'The due date must be on or after the start date.' });
  const project = access.project;
  await assertAssignable(tx, project, data.assigneeId);
  const statuses = await tx.select().from(projectStatuses).where(eq(projectStatuses.projectId, project.id)).orderBy(asc(projectStatuses.position));
  const status = data.statusId ? statuses.find((s) => s.id === data.statusId) : statuses.find((s) => s.category === 'unstarted') ?? statuses[0];
  if (!status) throw validation({ statusId: 'That status doesn’t belong to this project.' });
  if (data.parentId) {
    const [parent] = await tx.select().from(tasks).where(and(eq(tasks.id, data.parentId), eq(tasks.projectId, project.id), isNull(tasks.deletedAt)));
    if (!parent) throw validation({ parentId: 'The parent task must be in the same project.' });
    if (parent.parentId) throw validation({ parentId: 'Subtasks can’t have their own subtasks.' });
  }
  if (data.milestoneId) {
    const [m] = await tx.select().from(milestones).where(and(eq(milestones.id, data.milestoneId), eq(milestones.projectId, project.id)));
    if (!m) throw validation({ milestoneId: 'That milestone isn’t in this project.' });
  }
  if (data.sharedWithClient && !access.can('project.shareWithClient')) data.sharedWithClient = false;

  // Atomically reserve the next task number for this project.
  const [seq] = await tx
    .update(projects)
    .set({ taskSeq: sql`${projects.taskSeq} + 1` })
    .where(eq(projects.id, project.id))
    .returning({ number: projects.taskSeq });
  const [{ maxPos }] = (await tx
    .select({ maxPos: sql<number>`coalesce(max(${tasks.position}), 0)` })
    .from(tasks)
    .where(and(eq(tasks.projectId, project.id), eq(tasks.statusId, status.id)))) as [{ maxPos: number }];
  const description = data.description ? sanitizeRichText(data.description) : null;
  const [task] = await tx
    .insert(tasks)
    .values({
      orgId: actor.orgId,
      projectId: project.id,
      number: seq!.number,
      title: data.title,
      description,
      descriptionText: description ? richTextToPlain(description) : null,
      statusId: status.id,
      priority: data.priority,
      assigneeId: data.assigneeId ?? null,
      dueDate: data.dueDate,
      startDate: data.startDate,
      parentId: data.parentId ?? null,
      milestoneId: data.milestoneId ?? null,
      sharedWithClient: data.sharedWithClient,
      estimate: data.estimate ?? null,
      sourceRequestId: data.sourceRequestId ?? null,
      position: Number(maxPos) + 1000,
      startedAt: status.category === 'started' ? new Date() : null,
      completedAt: status.category === 'completed' ? new Date() : null,
      createdBy: actor.userId,
    })
    .returning();
  const t = task!;
  if (data.labelIds.length) {
    const valid = await tx.select({ id: labels.id }).from(labels).where(inArray(labels.id, data.labelIds));
    if (valid.length) await tx.insert(taskLabels).values(valid.map((l) => ({ orgId: actor.orgId, taskId: t.id, labelId: l.id })));
  }
  const watcherIds = [...new Set([actor.userId, data.assigneeId].filter((x): x is string => Boolean(x)))];
  if (actor.role !== 'client') {
    await tx.insert(taskWatchers).values(watcherIds.map((userId) => ({ orgId: actor.orgId, taskId: t.id, userId }))).onConflictDoNothing();
  }
  const ref = taskRef(project.key, t.number);
  await recordActivity(tx, actor, {
    projectId: project.id,
    verb: 'created',
    entityType: 'task',
    entityId: t.id,
    summary: `created ${ref} ${truncate(t.title, 80)}`,
    clientVisible: t.sharedWithClient,
  });
  if (data.assigneeId) {
    await notify(tx, actor, {
      userIds: [data.assigneeId],
      category: 'assignment',
      title: `Assigned to you: ${ref} ${truncate(t.title, 80)}`,
      body: `In ${project.name}`,
      href: taskHref(actor.orgSlug, project.key, t.number),
      entityId: t.id,
    });
  }
  if (description) await notifyMentions(tx, actor, access, t, description, null);
  await publish(tx, actor.orgId, `project:${project.id}`, 'task.created', t.id, { clientVisible: t.sharedWithClient });
  return { ...t, ref };
}

export async function createTask(actor: Actor, input: unknown) {
  const data = parse(createSchema, input);
  return withTenant(actor.orgId, async (tx) => {
    const access = await requireProject(tx, actor, data.projectId, 'task.create');
    assertWritable(access);
    return createTaskInTx(tx, actor, access, data);
  });
}

async function notifyMentions(tx: Tx, actor: Actor, access: ProjectAccess, task: typeof tasks.$inferSelect, doc: ReturnType<typeof sanitizeRichText>, previous: ReturnType<typeof sanitizeRichText> | null) {
  const before = new Set(extractMentions(previous));
  const mentioned = extractMentions(doc).filter((id) => !before.has(id));
  const allowed: string[] = [];
  for (const id of mentioned) {
    const role = await userCanAccessProject(tx, access.project, id);
    if (role && (role !== 'client' || task.sharedWithClient)) allowed.push(id);
  }
  if (!allowed.length) return;
  await notify(tx, actor, {
    userIds: allowed,
    category: 'mention',
    title: `You were mentioned in ${taskRef(access.project.key, task.number)} ${truncate(task.title, 60)}`,
    href: taskHref(actor.orgSlug, access.project.key, task.number),
    entityId: task.id,
  });
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

const updateSchema = z.object({
  taskId: z.uuid(),
  /** The version the client last saw. Omit only for fields that merge safely (none today). */
  version: z.number().int().positive(),
  title: z.string().trim().min(1, 'Give the task a title.').max(300).optional(),
  description: z.unknown().optional(),
  statusId: z.uuid().optional(),
  priority: z.enum(['none', 'low', 'medium', 'high', 'urgent']).optional(),
  assigneeId: z.uuid().nullable().optional(),
  dueDate: z.union([z.string(), z.null()]).optional(),
  startDate: z.union([z.string(), z.null()]).optional(),
  milestoneId: z.uuid().nullable().optional(),
  parentId: z.uuid().nullable().optional(),
  sharedWithClient: z.boolean().optional(),
  estimate: z.number().int().min(0).max(1000).nullable().optional(),
  labelIds: z.array(z.uuid()).max(10).optional(),
});

const dateOrNull = z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a valid date.'), z.literal(''), z.null()]).transform((v) => v || null);

/**
 * Applies a partial update with optimistic concurrency and server-side rules:
 * - Moving to a completed status requires every blocking task to be completed or canceled.
 * - Assignees must be able to open the project.
 * - Subtasks are one level deep; dates must be ordered.
 * Each changed field is written to task history.
 */
export async function updateTaskInTx(tx: Tx, actor: Actor, input: z.infer<typeof updateSchema>, opts: { skipVersion?: boolean } = {}) {
  const data = input;
  const { task, access } = await loadTaskWithAccess(tx, actor, data.taskId);
  if (!access.can('task.update')) throw notFound('That task');
  assertWritable(access);
  if (!opts.skipVersion && task.version !== data.version) {
    throw conflict({ version: task.version }, 'This task changed since you opened it. Review the latest version and try again.');
  }
  const patch: Partial<typeof tasks.$inferInsert> = {};
  const changes: { field: string; from: unknown; to: unknown }[] = [];
  const set = <K extends keyof typeof tasks.$inferInsert>(field: K, value: (typeof tasks.$inferInsert)[K], from: unknown, label = field as string) => {
    if (JSON.stringify(from ?? null) === JSON.stringify(value ?? null)) return;
    patch[field] = value;
    changes.push({ field: label, from: from ?? null, to: value ?? null });
  };

  if (data.title !== undefined) set('title', data.title, task.title);
  let newDescription: ReturnType<typeof sanitizeRichText> | null = null;
  if (data.description !== undefined) {
    newDescription = sanitizeRichText(data.description);
    const plain = richTextToPlain(newDescription);
    if (plain !== (task.descriptionText ?? '') || JSON.stringify(newDescription) !== JSON.stringify(task.description)) {
      patch.description = newDescription;
      patch.descriptionText = plain;
      changes.push({ field: 'description', from: null, to: null });
    }
  }
  if (data.priority !== undefined) set('priority', data.priority, task.priority);
  if (data.estimate !== undefined) set('estimate', data.estimate, task.estimate);
  if (data.dueDate !== undefined) set('dueDate', parse(dateOrNull, data.dueDate), task.dueDate);
  if (data.startDate !== undefined) set('startDate', parse(dateOrNull, data.startDate), task.startDate);
  const start = patch.startDate !== undefined ? patch.startDate : task.startDate;
  const due = patch.dueDate !== undefined ? patch.dueDate : task.dueDate;
  if (start && due && start > due) throw validation({ dueDate: 'The due date must be on or after the start date.' });

  if (data.assigneeId !== undefined && data.assigneeId !== task.assigneeId) {
    await assertAssignable(tx, access.project, data.assigneeId);
    set('assigneeId', data.assigneeId, task.assigneeId, 'assignee');
  }
  if (data.milestoneId !== undefined && data.milestoneId !== task.milestoneId) {
    if (data.milestoneId) {
      const [m] = await tx.select().from(milestones).where(and(eq(milestones.id, data.milestoneId), eq(milestones.projectId, task.projectId)));
      if (!m) throw validation({ milestoneId: 'That milestone isn’t in this project.' });
    }
    set('milestoneId', data.milestoneId, task.milestoneId, 'milestone');
  }
  if (data.parentId !== undefined && data.parentId !== task.parentId) {
    if (data.parentId) {
      if (data.parentId === task.id) throw validation({ parentId: 'A task can’t be its own parent.' });
      const [parent] = await tx.select().from(tasks).where(and(eq(tasks.id, data.parentId), eq(tasks.projectId, task.projectId), isNull(tasks.deletedAt)));
      if (!parent) throw validation({ parentId: 'The parent task must be in the same project.' });
      if (parent.parentId) throw validation({ parentId: 'Subtasks can’t have their own subtasks.' });
      const [child] = await tx.select({ id: tasks.id }).from(tasks).where(and(eq(tasks.parentId, task.id), isNull(tasks.deletedAt))).limit(1);
      if (child) throw validation({ parentId: 'This task has subtasks, so it can’t become a subtask.' });
    }
    set('parentId', data.parentId, task.parentId, 'parent');
  }
  if (data.sharedWithClient !== undefined && data.sharedWithClient !== task.sharedWithClient) {
    if (!access.can('project.shareWithClient')) throw validation({ sharedWithClient: 'Only project managers can change client sharing.' });
    set('sharedWithClient', data.sharedWithClient, task.sharedWithClient, 'client sharing');
  }

  let statusChange: { from: typeof projectStatuses.$inferSelect; to: typeof projectStatuses.$inferSelect } | null = null;
  if (data.statusId !== undefined && data.statusId !== task.statusId) {
    const statuses = await tx.select().from(projectStatuses).where(eq(projectStatuses.projectId, task.projectId));
    const to = statuses.find((s) => s.id === data.statusId);
    const from = statuses.find((s) => s.id === task.statusId)!;
    if (!to) throw validation({ statusId: 'That status doesn’t belong to this project.' });
    if (to.category === 'completed') {
      const openBlockers = await tx
        .select({ number: tasks.number, title: tasks.title, key: projects.key })
        .from(taskDependencies)
        .innerJoin(tasks, eq(tasks.id, taskDependencies.blockerId))
        .innerJoin(projects, eq(projects.id, tasks.projectId))
        .innerJoin(projectStatuses, eq(projectStatuses.id, tasks.statusId))
        .where(and(eq(taskDependencies.blockedId, task.id), isNull(tasks.deletedAt), sql`${projectStatuses.category} not in ('completed','canceled')`));
      if (openBlockers.length) {
        throw precondition(`Finish the blocking task${openBlockers.length > 1 ? 's' : ''} first: ${openBlockers.map((b) => taskRef(b.key, b.number)).join(', ')}.`);
      }
    }
    patch.statusId = to.id;
    changes.push({ field: 'status', from: from.name, to: to.name });
    if (to.category === 'completed' && from.category !== 'completed') patch.completedAt = new Date();
    if (to.category !== 'completed') patch.completedAt = null;
    if (to.category === 'started' && !task.startedAt) patch.startedAt = new Date();
    const [{ maxPos }] = (await tx.select({ maxPos: sql<number>`coalesce(max(${tasks.position}), 0)` }).from(tasks).where(and(eq(tasks.projectId, task.projectId), eq(tasks.statusId, to.id)))) as [{ maxPos: number }];
    patch.position = Number(maxPos) + 1000;
    statusChange = { from, to };
  }

  let labelChange = false;
  if (data.labelIds !== undefined) {
    const current = (await tx.select({ id: taskLabels.labelId }).from(taskLabels).where(eq(taskLabels.taskId, task.id))).map((l) => l.id).sort();
    const next = [...new Set(data.labelIds)].sort();
    if (JSON.stringify(current) !== JSON.stringify(next)) {
      const valid = next.length ? await tx.select({ id: labels.id, name: labels.name }).from(labels).where(inArray(labels.id, next)) : [];
      await tx.delete(taskLabels).where(eq(taskLabels.taskId, task.id));
      if (valid.length) await tx.insert(taskLabels).values(valid.map((l) => ({ orgId: actor.orgId, taskId: task.id, labelId: l.id })));
      changes.push({ field: 'labels', from: current.length, to: valid.map((v) => v.name) });
      labelChange = true;
    }
  }

  if (changes.length === 0) return { task, ref: taskRef(access.project.key, task.number), changed: false };

  const [updated] = await tx
    .update(tasks)
    .set({ ...patch, version: sql`${tasks.version} + 1`, updatedAt: new Date() })
    .where(eq(tasks.id, task.id))
    .returning();
  await tx.insert(taskHistory).values(
    changes.filter((c) => c.field !== 'description' || true).map((c) => ({ orgId: actor.orgId, taskId: task.id, actorId: actor.userId, field: c.field, fromValue: c.from as never, toValue: c.to as never })),
  );

  const ref = taskRef(access.project.key, task.number);
  const href = taskHref(actor.orgSlug, access.project.key, task.number);
  const shared = updated!.sharedWithClient;
  if (statusChange) {
    await recordActivity(tx, actor, {
      projectId: task.projectId,
      verb: statusChange.to.category === 'completed' ? 'completed' : 'moved',
      entityType: 'task',
      entityId: task.id,
      summary: statusChange.to.category === 'completed' ? `completed ${ref} ${truncate(task.title, 80)}` : `moved ${ref} to ${statusChange.to.name}`,
      data: { from: statusChange.from.name, to: statusChange.to.name },
      clientVisible: shared,
    });
    if (statusChange.to.category === 'completed') await completeRequestsForTask(tx, actor, task.id, access.project.key, task.number);
    const watchers = await tx.select({ userId: taskWatchers.userId }).from(taskWatchers).where(eq(taskWatchers.taskId, task.id));
    await notify(tx, actor, {
      userIds: watchers.map((w) => w.userId),
      category: 'status',
      title: `${ref} moved to ${statusChange.to.name}`,
      body: truncate(task.title, 120),
      href,
      entityId: task.id,
      dedupeKey: `task-status:${task.id}`,
    });
  } else if (!labelChange || changes.length > 1) {
    await recordActivity(tx, actor, {
      projectId: task.projectId,
      verb: 'updated',
      entityType: 'task',
      entityId: task.id,
      summary: `updated ${changes.map((c) => c.field).join(', ')} on ${ref}`,
      clientVisible: false,
    });
  }
  if (patch.assigneeId) {
    await tx.insert(taskWatchers).values({ orgId: actor.orgId, taskId: task.id, userId: patch.assigneeId }).onConflictDoNothing();
    await notify(tx, actor, {
      userIds: [patch.assigneeId],
      category: 'assignment',
      title: `Assigned to you: ${ref} ${truncate(task.title, 80)}`,
      body: `In ${access.project.name}`,
      href,
      entityId: task.id,
    });
  }
  if (newDescription) await notifyMentions(tx, actor, access, updated!, newDescription, task.description as never);
  await publish(tx, actor.orgId, `project:${task.projectId}`, 'task.updated', task.id, {
    clientVisible: shared || task.sharedWithClient,
    fields: changes.map((c) => c.field),
  });
  return { task: updated!, ref, changed: true };
}

export async function updateTask(actor: Actor, input: unknown) {
  const data = parse(updateSchema, input);
  return withTenant(actor.orgId, (tx) => updateTaskInTx(tx, actor, data));
}

// ---------------------------------------------------------------------------
// Board moves (keyboard and drag-and-drop share this)
// ---------------------------------------------------------------------------

const moveSchema = z.object({
  taskId: z.uuid(),
  version: z.number().int().positive(),
  statusId: z.uuid(),
  /** Place the task directly after this one (null = top of the column). */
  afterId: z.uuid().nullable(),
});

export async function moveTask(actor: Actor, input: unknown) {
  const data = parse(moveSchema, input);
  return withTenant(actor.orgId, async (tx) => {
    const { task } = await loadTaskWithAccess(tx, actor, data.taskId);
    let result = { task, changed: false } as { task: typeof task; changed: boolean };
    if (data.statusId !== task.statusId) {
      const r = await updateTaskInTx(tx, actor, { taskId: task.id, version: data.version, statusId: data.statusId });
      result = { task: r.task, changed: r.changed };
    } else if (task.version !== data.version) {
      throw conflict({ version: task.version }, 'This task changed since you loaded the board. The board has been refreshed.');
    }
    const column = await tx
      .select({ id: tasks.id, position: tasks.position })
      .from(tasks)
      .where(and(eq(tasks.projectId, task.projectId), eq(tasks.statusId, data.statusId), isNull(tasks.deletedAt), sql`${tasks.id} <> ${task.id}`))
      .orderBy(asc(tasks.position));
    const idx = data.afterId ? column.findIndex((c) => c.id === data.afterId) : -1;
    if (data.afterId && idx === -1) throw validation({ afterId: 'The board changed. Refresh and try again.' });
    const prev = idx >= 0 ? column[idx]!.position : null;
    const next = column[idx + 1]?.position ?? null;
    let position: number;
    if (prev === null && next === null) position = 1000;
    else if (prev === null) position = next! - 1000;
    else if (next === null) position = prev + 1000;
    else position = (prev + next) / 2;
    if (prev !== null && next !== null && next - prev < 1e-6) {
      // Positions got too close: renumber the column.
      const ordered = [...column.slice(0, idx + 1), { id: task.id }, ...column.slice(idx + 1)];
      for (let i = 0; i < ordered.length; i++) await tx.update(tasks).set({ position: (i + 1) * 1000 }).where(eq(tasks.id, ordered[i]!.id));
    } else {
      await tx.update(tasks).set({ position }).where(eq(tasks.id, task.id));
    }
    const [fresh] = await tx.update(tasks).set({ version: sql`${tasks.version} + ${result.changed ? 0 : 1}` }).where(eq(tasks.id, task.id)).returning();
    await publish(tx, actor.orgId, `project:${task.projectId}`, 'task.updated', task.id, { clientVisible: fresh!.sharedWithClient, fields: ['position'] });
    return fresh!;
  });
}

// ---------------------------------------------------------------------------
// Bulk edits
// ---------------------------------------------------------------------------

const bulkSchema = z.object({
  taskIds: z.array(z.uuid()).min(1).max(200),
  statusId: z.uuid().optional(),
  assigneeId: z.uuid().nullable().optional(),
  priority: z.enum(['none', 'low', 'medium', 'high', 'urgent']).optional(),
  dueDate: z.union([z.string(), z.null()]).optional(),
  addLabelId: z.uuid().optional(),
  archive: z.boolean().optional(),
});

/** Applies the same change to many tasks. Tasks that fail a rule are skipped and reported. */
export async function bulkUpdateTasks(actor: Actor, input: unknown) {
  const data = parse(bulkSchema, input);
  return withTenant(actor.orgId, async (tx) => {
    const updated: string[] = [];
    const skipped: { id: string; ref?: string; reason: string }[] = [];
    for (const id of data.taskIds) {
      await tx.execute(sql`savepoint bulk_item`);
      try {
        const { task, access } = await loadTaskWithAccess(tx, actor, id);
        if (data.archive !== undefined) {
          if (!access.can('task.update')) throw notFound('That task');
          await tx.update(tasks).set({ archivedAt: data.archive ? new Date() : null, version: sql`${tasks.version} + 1`, updatedAt: new Date() }).where(eq(tasks.id, id));
          await publish(tx, actor.orgId, `project:${task.projectId}`, 'task.updated', id, { clientVisible: task.sharedWithClient });
        }
        let labelIds: string[] | undefined;
        if (data.addLabelId) {
          const current = (await tx.select({ id: taskLabels.labelId }).from(taskLabels).where(eq(taskLabels.taskId, id))).map((l) => l.id);
          labelIds = [...new Set([...current, data.addLabelId])];
        }
        let statusId = data.statusId;
        if (statusId) {
          // Bulk status moves use the target status's category within each task's own project.
          const [target] = await tx.select().from(projectStatuses).where(eq(projectStatuses.id, statusId));
          if (target && target.projectId !== task.projectId) {
            const [same] = await tx.select().from(projectStatuses).where(and(eq(projectStatuses.projectId, task.projectId), eq(projectStatuses.category, target.category))).limit(1);
            statusId = same?.id;
          }
        }
        await updateTaskInTx(
          tx,
          actor,
          {
            taskId: id,
            version: task.version,
            statusId,
            assigneeId: data.assigneeId,
            priority: data.priority,
            dueDate: data.dueDate,
            labelIds,
          },
          { skipVersion: true },
        );
        await tx.execute(sql`release savepoint bulk_item`);
        updated.push(id);
      } catch (err) {
        await tx.execute(sql`rollback to savepoint bulk_item`);
        skipped.push({ id, reason: err instanceof Error ? err.message : 'Could not update this task.' });
      }
    }
    return { updated, skipped };
  });
}

// ---------------------------------------------------------------------------
// Delete, restore, duplicate, watch
// ---------------------------------------------------------------------------

export async function deleteTask(actor: Actor, input: unknown) {
  const { taskId } = parse(z.object({ taskId: z.uuid() }), input);
  return withTenant(actor.orgId, async (tx) => {
    const { task, access } = await loadTaskWithAccess(tx, actor, taskId);
    if (!access.can('task.delete')) throw notFound('That task');
    await tx.update(tasks).set({ deletedAt: new Date(), updatedAt: new Date(), version: sql`${tasks.version} + 1` }).where(or2(eq(tasks.id, taskId), eq(tasks.parentId, taskId)));
    const ref = taskRef(access.project.key, task.number);
    await recordActivity(tx, actor, { projectId: task.projectId, verb: 'deleted', entityType: 'task', entityId: taskId, summary: `deleted ${ref} ${truncate(task.title, 80)}` });
    await publish(tx, actor.orgId, `project:${task.projectId}`, 'task.deleted', taskId, { clientVisible: task.sharedWithClient });
    return { ref };
  });
}

function or2(a: ReturnType<typeof eq>, b: ReturnType<typeof eq>) {
  return sql`(${a} or ${b})`;
}

export async function restoreTask(actor: Actor, input: unknown) {
  const { taskId } = parse(z.object({ taskId: z.uuid() }), input);
  return withTenant(actor.orgId, async (tx) => {
    const { task, access } = await loadTaskWithAccess(tx, actor, taskId, { includeDeleted: true });
    if (!access.can('task.delete')) throw notFound('That task');
    await tx.update(tasks).set({ deletedAt: null, updatedAt: new Date(), version: sql`${tasks.version} + 1` }).where(or2(eq(tasks.id, taskId), eq(tasks.parentId, taskId)));
    await recordActivity(tx, actor, { projectId: task.projectId, verb: 'restored', entityType: 'task', entityId: taskId, summary: `restored ${taskRef(access.project.key, task.number)}` });
    await publish(tx, actor.orgId, `project:${task.projectId}`, 'task.created', taskId, { clientVisible: task.sharedWithClient });
  });
}

export async function duplicateTask(actor: Actor, input: unknown) {
  const { taskId } = parse(z.object({ taskId: z.uuid() }), input);
  return withTenant(actor.orgId, async (tx) => {
    const { task, access } = await loadTaskWithAccess(tx, actor, taskId);
    if (!access.can('task.create')) throw notFound('That task');
    assertWritable(access);
    const labelIds = (await tx.select({ id: taskLabels.labelId }).from(taskLabels).where(eq(taskLabels.taskId, taskId))).map((l) => l.id);
    const copy = await createTaskInTx(tx, actor, access, {
      projectId: task.projectId,
      title: `${task.title} (copy)`.slice(0, 300),
      description: task.description ?? undefined,
      statusId: task.statusId,
      priority: task.priority,
      assigneeId: task.assigneeId,
      dueDate: task.dueDate,
      startDate: task.startDate,
      parentId: task.parentId,
      milestoneId: task.milestoneId,
      labelIds,
      sharedWithClient: false,
      estimate: task.estimate,
    });
    const items = await tx.select().from(checklistItems).where(eq(checklistItems.taskId, taskId));
    if (items.length) await tx.insert(checklistItems).values(items.map((i) => ({ orgId: actor.orgId, taskId: copy.id, text: i.text, done: false, position: i.position })));
    return copy;
  });
}

export async function setWatching(actor: Actor, input: unknown) {
  const { taskId, watching } = parse(z.object({ taskId: z.uuid(), watching: z.boolean() }), input);
  return withTenant(actor.orgId, async (tx) => {
    const { access } = await loadTaskWithAccess(tx, actor, taskId);
    if (access.isClient) throw notFound('That task');
    if (watching) await tx.insert(taskWatchers).values({ orgId: actor.orgId, taskId, userId: actor.userId }).onConflictDoNothing();
    else await tx.delete(taskWatchers).where(and(eq(taskWatchers.taskId, taskId), eq(taskWatchers.userId, actor.userId)));
  });
}

// ---------------------------------------------------------------------------
// Checklist
// ---------------------------------------------------------------------------

export async function saveChecklistItem(actor: Actor, input: unknown) {
  const data = parse(
    z.object({ taskId: z.uuid(), itemId: z.uuid().optional(), text: z.string().trim().min(1, 'Write something.').max(300).optional(), done: z.boolean().optional() }),
    input,
  );
  return withTenant(actor.orgId, async (tx) => {
    const { task, access } = await loadTaskWithAccess(tx, actor, data.taskId);
    if (!access.can('task.update')) throw notFound('That task');
    assertWritable(access);
    let item;
    if (data.itemId) {
      const patch: Record<string, unknown> = {};
      if (data.text !== undefined) patch.text = data.text;
      if (data.done !== undefined) patch.done = data.done;
      [item] = await tx.update(checklistItems).set(patch).where(and(eq(checklistItems.id, data.itemId), eq(checklistItems.taskId, task.id))).returning();
      if (!item) throw notFound('That checklist item');
    } else {
      if (!data.text) throw validation({ text: 'Write something.' });
      const [{ max }] = (await tx.select({ max: sql<number>`coalesce(max(position), -1)::int` }).from(checklistItems).where(eq(checklistItems.taskId, task.id))) as [{ max: number }];
      const [{ n }] = (await tx.select({ n: sql<number>`count(*)::int` }).from(checklistItems).where(eq(checklistItems.taskId, task.id))) as [{ n: number }];
      if (n >= 100) throw validation({ text: 'A checklist can have up to 100 items.' });
      [item] = await tx.insert(checklistItems).values({ orgId: actor.orgId, taskId: task.id, text: data.text, position: max + 1 }).returning();
    }
    await publish(tx, actor.orgId, `project:${task.projectId}`, 'task.updated', task.id, { clientVisible: task.sharedWithClient, fields: ['checklist'] });
    return item!;
  });
}

export async function deleteChecklistItem(actor: Actor, input: unknown) {
  const data = parse(z.object({ taskId: z.uuid(), itemId: z.uuid() }), input);
  return withTenant(actor.orgId, async (tx) => {
    const { task, access } = await loadTaskWithAccess(tx, actor, data.taskId);
    if (!access.can('task.update')) throw notFound('That task');
    await tx.delete(checklistItems).where(and(eq(checklistItems.id, data.itemId), eq(checklistItems.taskId, task.id)));
    await publish(tx, actor.orgId, `project:${task.projectId}`, 'task.updated', task.id, { clientVisible: task.sharedWithClient, fields: ['checklist'] });
  });
}

// ---------------------------------------------------------------------------
// Dependencies
// ---------------------------------------------------------------------------

export async function addDependency(actor: Actor, input: unknown) {
  const data = parse(z.object({ blockerRef: z.string().max(20), blockedId: z.uuid() }), input);
  return withTenant(actor.orgId, async (tx) => {
    const { task: blocked, access } = await loadTaskWithAccess(tx, actor, data.blockedId);
    if (!access.can('task.update')) throw notFound('That task');
    const blockerRow = await findTaskByRef(tx, actor, data.blockerRef).catch(() => null);
    if (!blockerRow || blockerRow.deletedAt) throw validation({ blockerRef: `No task ${data.blockerRef.toUpperCase()} that you can see.` });
    await loadTaskWithAccess(tx, actor, blockerRow.id);
    if (blockerRow.id === blocked.id) throw validation({ blockerRef: 'A task can’t block itself.' });
    // Reject cycles: walk everything the blocker is (transitively) blocked by.
    const cycle = await tx.execute<{ found: boolean }>(sql`
      with recursive chain(id) as (
        select ${taskDependencies.blockerId} from ${taskDependencies} where ${taskDependencies.blockedId} = ${blockerRow.id}
        union
        select d.blocker_id from ${taskDependencies} d join chain c on d.blocked_id = c.id
      ) select exists(select 1 from chain where id = ${blocked.id}) as found`);
    if (cycle.rows[0]?.found) throw validation({ blockerRef: 'That would create a circular dependency.' });
    await tx.insert(taskDependencies).values({ orgId: actor.orgId, blockerId: blockerRow.id, blockedId: blocked.id }).onConflictDoNothing();
    await tx.insert(taskHistory).values({ orgId: actor.orgId, taskId: blocked.id, actorId: actor.userId, field: 'blocked by', fromValue: null, toValue: data.blockerRef.toUpperCase() as never });
    await publish(tx, actor.orgId, `project:${blocked.projectId}`, 'task.updated', blocked.id, { clientVisible: blocked.sharedWithClient, fields: ['dependencies'] });
  });
}

export async function removeDependency(actor: Actor, input: unknown) {
  const data = parse(z.object({ blockerId: z.uuid(), blockedId: z.uuid() }), input);
  return withTenant(actor.orgId, async (tx) => {
    const { task, access } = await loadTaskWithAccess(tx, actor, data.blockedId);
    if (!access.can('task.update')) throw notFound('That task');
    await tx.delete(taskDependencies).where(and(eq(taskDependencies.blockerId, data.blockerId), eq(taskDependencies.blockedId, data.blockedId)));
    await publish(tx, actor.orgId, `project:${task.projectId}`, 'task.updated', task.id, { clientVisible: task.sharedWithClient, fields: ['dependencies'] });
  });
}

// ---------------------------------------------------------------------------
// Labels and saved views
// ---------------------------------------------------------------------------

export async function listLabels(actor: Actor) {
  return withTenant(actor.orgId, (tx) => tx.select().from(labels).where(eq(labels.orgId, actor.orgId)).orderBy(asc(labels.name)));
}

export async function saveLabel(actor: Actor, input: unknown) {
  const data = parse(z.object({ labelId: z.uuid().optional(), name: z.string().trim().min(1).max(30), color: z.string().max(20) }), input);
  if (actor.role === 'client') throw notFound('That page');
  return withTenant(actor.orgId, async (tx) => {
    try {
      if (data.labelId) {
        if (actor.role !== 'owner' && actor.role !== 'admin') throw validation({ name: 'Only admins can rename labels.' });
        const [l] = await tx.update(labels).set({ name: data.name, color: data.color }).where(eq(labels.id, data.labelId)).returning();
        if (!l) throw notFound('That label');
        return l;
      }
      const [l] = await tx.insert(labels).values({ orgId: actor.orgId, name: data.name, color: data.color }).returning();
      return l!;
    } catch (err) {
      if (String((err as { cause?: unknown }).cause ?? err).includes('labels_org_name_key')) throw validation({ name: 'A label with that name already exists.' });
      throw err;
    }
  });
}

export async function deleteLabel(actor: Actor, input: unknown) {
  const { labelId } = parse(z.object({ labelId: z.uuid() }), input);
  if (actor.role !== 'owner' && actor.role !== 'admin') throw notFound('That label');
  await withTenant(actor.orgId, (tx) => tx.delete(labels).where(eq(labels.id, labelId)));
}

export const viewQuerySchema = taskFilterSchema.omit({ limit: true, projectId: true }).extend({
  groupBy: z.enum(['status', 'assignee', 'priority', 'milestone', 'none']).optional(),
});

export async function listSavedViews(actor: Actor, projectId: string | null) {
  return withTenant(actor.orgId, (tx) =>
    tx
      .select()
      .from(savedViews)
      .where(
        and(
          eq(savedViews.orgId, actor.orgId),
          projectId ? eq(savedViews.projectId, projectId) : isNull(savedViews.projectId),
          sql`(${savedViews.userId} = ${actor.userId} or ${savedViews.shared})`,
        ),
      )
      .orderBy(asc(savedViews.name)),
  );
}

export async function saveView(actor: Actor, input: unknown) {
  const data = parse(
    z.object({ projectId: z.uuid().nullable(), name: z.string().trim().min(1, 'Name the view.').max(60), layout: z.enum(['list', 'board']), query: viewQuerySchema, shared: z.boolean().default(false) }),
    input,
  );
  if (actor.role === 'client') throw notFound('That page');
  return withTenant(actor.orgId, async (tx) => {
    if (data.projectId) await getProjectAccess(tx, actor, data.projectId);
    const [v] = await tx.insert(savedViews).values({ orgId: actor.orgId, userId: actor.userId, projectId: data.projectId, name: data.name, layout: data.layout, query: data.query, shared: data.shared }).returning();
    return v!;
  });
}

export async function deleteView(actor: Actor, input: unknown) {
  const { viewId } = parse(z.object({ viewId: z.uuid() }), input);
  await withTenant(actor.orgId, async (tx) => {
    const [v] = await tx.delete(savedViews).where(and(eq(savedViews.id, viewId), eq(savedViews.userId, actor.userId))).returning();
    if (!v) throw notFound('That view');
  });
}

export { PRIORITY_RANK };
