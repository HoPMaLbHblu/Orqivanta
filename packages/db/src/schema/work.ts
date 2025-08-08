import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  doublePrecision,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { createdAt, id, orgId, ts, tsvector, updatedAt } from './_shared';
import { clientAccounts, organizations, teams, users } from './identity';

export type RichText = { type: 'doc'; content?: unknown[] };

export const projectStatus = pgEnum('project_status', ['active', 'paused', 'completed', 'archived']);
export const projectVisibility = pgEnum('project_visibility', ['private', 'team', 'org']);
export const projectHealth = pgEnum('project_health', ['on_track', 'at_risk', 'off_track']);
export const projectRole = pgEnum('project_role', ['manager', 'contributor', 'viewer']);

export const projects = pgTable(
  'projects',
  {
    id: id(),
    orgId: orgId().references(() => organizations.id, { onDelete: 'cascade' }),
    /** Short uppercase key used in task identifiers, e.g. "BRD" in BRD-42. Unique per org. */
    key: text('key').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    goals: jsonb('goals').$type<string[]>().notNull().default([]),
    status: projectStatus('status').notNull().default('active'),
    visibility: projectVisibility('visibility').notNull().default('org'),
    teamId: uuid('team_id').references(() => teams.id, { onDelete: 'set null' }),
    clientAccountId: uuid('client_account_id'),
    /** When true, client contacts of clientAccountId can open this project in the portal. */
    portalEnabled: boolean('portal_enabled').notNull().default(false),
    ownerId: uuid('owner_id').references(() => users.id, { onDelete: 'set null' }),
    color: text('color').notNull().default('verdigris'),
    startDate: date('start_date', { mode: 'string' }),
    dueDate: date('due_date', { mode: 'string' }),
    taskSeq: integer('task_seq').notNull().default(0),
    version: integer('version').notNull().default(1),
    archivedAt: ts('archived_at'),
    deletedAt: ts('deleted_at'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    search: tsvector('search').generatedAlwaysAs(
      sql`to_tsvector('simple', coalesce(name,'') || ' ' || coalesce(key,'') || ' ' || coalesce(description,''))`,
    ),
  },
  (t) => [
    unique('projects_org_id_key').on(t.orgId, t.id),
    uniqueIndex('projects_org_key_key').on(t.orgId, t.key),
    index('projects_search_idx').using('gin', t.search),
    foreignKey({
      name: 'projects_client_fk',
      columns: [t.orgId, t.clientAccountId],
      foreignColumns: [clientAccounts.orgId, clientAccounts.id],
    }),
  ],
);

export const projectMembers = pgTable(
  'project_members',
  {
    orgId: orgId(),
    projectId: uuid('project_id').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: projectRole('role').notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.projectId, t.userId] }),
    index('project_members_user_idx').on(t.userId),
    foreignKey({
      name: 'project_members_project_fk',
      columns: [t.orgId, t.projectId],
      foreignColumns: [projects.orgId, projects.id],
    }).onDelete('cascade'),
  ],
);

export const statusCategory = pgEnum('status_category', [
  'backlog',
  'unstarted',
  'started',
  'review',
  'completed',
  'canceled',
]);

export const projectStatuses = pgTable(
  'project_statuses',
  {
    id: id(),
    orgId: orgId(),
    projectId: uuid('project_id').notNull(),
    name: text('name').notNull(),
    category: statusCategory('category').notNull(),
    position: integer('position').notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    unique('project_statuses_org_id_key').on(t.orgId, t.id),
    foreignKey({
      name: 'project_statuses_project_fk',
      columns: [t.orgId, t.projectId],
      foreignColumns: [projects.orgId, projects.id],
    }).onDelete('cascade'),
  ],
);

export const milestoneStatus = pgEnum('milestone_status', ['planned', 'in_progress', 'done', 'missed']);

export const milestones = pgTable(
  'milestones',
  {
    id: id(),
    orgId: orgId(),
    projectId: uuid('project_id').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    dueDate: date('due_date', { mode: 'string' }),
    status: milestoneStatus('status').notNull().default('planned'),
    sharedWithClient: boolean('shared_with_client').notNull().default(false),
    position: integer('position').notNull().default(0),
    completedAt: ts('completed_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique('milestones_org_id_key').on(t.orgId, t.id),
    foreignKey({
      name: 'milestones_project_fk',
      columns: [t.orgId, t.projectId],
      foreignColumns: [projects.orgId, projects.id],
    }).onDelete('cascade'),
  ],
);

export const projectUpdates = pgTable(
  'project_updates',
  {
    id: id(),
    orgId: orgId(),
    projectId: uuid('project_id').notNull(),
    health: projectHealth('health').notNull(),
    summary: text('summary').notNull(),
    body: jsonb('body').$type<RichText>(),
    bodyText: text('body_text'),
    sharedWithClient: boolean('shared_with_client').notNull().default(false),
    authorId: uuid('author_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [
    index('project_updates_project_idx').on(t.projectId, t.createdAt),
    foreignKey({
      name: 'project_updates_project_fk',
      columns: [t.orgId, t.projectId],
      foreignColumns: [projects.orgId, projects.id],
    }).onDelete('cascade'),
  ],
);

export const labels = pgTable(
  'labels',
  {
    id: id(),
    orgId: orgId().references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    color: text('color').notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('labels_org_name_key').on(t.orgId, sql`lower(${t.name})`)],
);

export const taskPriority = pgEnum('task_priority', ['none', 'low', 'medium', 'high', 'urgent']);

export const tasks = pgTable(
  'tasks',
  {
    id: id(),
    orgId: orgId(),
    projectId: uuid('project_id').notNull(),
    number: integer('number').notNull(),
    title: text('title').notNull(),
    description: jsonb('description').$type<RichText>(),
    descriptionText: text('description_text'),
    statusId: uuid('status_id').notNull(),
    priority: taskPriority('priority').notNull().default('none'),
    assigneeId: uuid('assignee_id').references(() => users.id, { onDelete: 'set null' }),
    parentId: uuid('parent_id'),
    milestoneId: uuid('milestone_id'),
    startDate: date('start_date', { mode: 'string' }),
    dueDate: date('due_date', { mode: 'string' }),
    estimate: integer('estimate'),
    position: doublePrecision('position').notNull().default(0),
    sharedWithClient: boolean('shared_with_client').notNull().default(false),
    /** Request this task was created from, if any. */
    sourceRequestId: uuid('source_request_id'),
    completedAt: ts('completed_at'),
    startedAt: ts('started_at'),
    version: integer('version').notNull().default(1),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    archivedAt: ts('archived_at'),
    deletedAt: ts('deleted_at'),
    search: tsvector('search').generatedAlwaysAs(
      sql`to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(description_text,''))`,
    ),
  },
  (t) => [
    unique('tasks_org_id_key').on(t.orgId, t.id),
    uniqueIndex('tasks_project_number_key').on(t.projectId, t.number),
    index('tasks_project_status_idx').on(t.projectId, t.statusId, t.position),
    index('tasks_assignee_idx').on(t.orgId, t.assigneeId),
    index('tasks_due_idx').on(t.orgId, t.dueDate),
    index('tasks_search_idx').using('gin', t.search),
    index('tasks_title_trgm_idx').using('gin', sql`${t.title} gin_trgm_ops`),
    foreignKey({
      name: 'tasks_project_fk',
      columns: [t.orgId, t.projectId],
      foreignColumns: [projects.orgId, projects.id],
    }).onDelete('cascade'),
    foreignKey({
      name: 'tasks_status_fk',
      columns: [t.orgId, t.statusId],
      foreignColumns: [projectStatuses.orgId, projectStatuses.id],
    }),
    foreignKey({
      name: 'tasks_parent_fk',
      columns: [t.orgId, t.parentId],
      foreignColumns: [t.orgId, t.id],
    }).onDelete('cascade'),
    foreignKey({
      name: 'tasks_milestone_fk',
      columns: [t.orgId, t.milestoneId],
      foreignColumns: [milestones.orgId, milestones.id],
    }),
    check('tasks_title_len', sql`char_length(${t.title}) between 1 and 300`),
    check('tasks_dates', sql`${t.startDate} is null or ${t.dueDate} is null or ${t.startDate} <= ${t.dueDate}`),
  ],
);

export const taskLabels = pgTable(
  'task_labels',
  {
    orgId: orgId(),
    taskId: uuid('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    labelId: uuid('label_id')
      .notNull()
      .references(() => labels.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.taskId, t.labelId] })],
);

export const taskWatchers = pgTable(
  'task_watchers',
  {
    orgId: orgId(),
    taskId: uuid('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.taskId, t.userId] }), index('task_watchers_user_idx').on(t.userId)],
);

export const taskDependencies = pgTable(
  'task_dependencies',
  {
    orgId: orgId(),
    /** blockerId must be completed before blockedId can move to a completed status. */
    blockerId: uuid('blocker_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    blockedId: uuid('blocked_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.blockerId, t.blockedId] }),
    check('task_dependencies_no_self', sql`${t.blockerId} <> ${t.blockedId}`),
  ],
);

export const checklistItems = pgTable(
  'checklist_items',
  {
    id: id(),
    orgId: orgId(),
    taskId: uuid('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    text: text('text').notNull(),
    done: boolean('done').notNull().default(false),
    position: integer('position').notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index('checklist_items_task_idx').on(t.taskId)],
);

/** Field-level change history for tasks, shown in the task's activity tab. */
export const taskHistory = pgTable(
  'task_history',
  {
    id: id(),
    orgId: orgId(),
    taskId: uuid('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
    field: text('field').notNull(),
    fromValue: jsonb('from_value'),
    toValue: jsonb('to_value'),
    createdAt: createdAt(),
  },
  (t) => [index('task_history_task_idx').on(t.taskId, t.createdAt)],
);

export const savedViews = pgTable(
  'saved_views',
  {
    id: id(),
    orgId: orgId(),
    projectId: uuid('project_id'),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    layout: text('layout').notNull().default('list'),
    /** Serialized filter, sort and grouping state; validated by the API schema. */
    query: jsonb('query').$type<Record<string, unknown>>().notNull().default({}),
    shared: boolean('shared').notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index('saved_views_user_idx').on(t.orgId, t.userId)],
);
