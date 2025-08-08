import { sql } from 'drizzle-orm';
import {
  bigserial,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { approvals } from './clientwork';
import { requests } from './clientwork';
import { documents } from './content';
import { createdAt, id, orgId, ts } from './_shared';
import { organizations, users } from './identity';
import { tasks, type RichText } from './work';

export const commentVisibility = pgEnum('comment_visibility', ['internal', 'client']);

/**
 * Comments attach to exactly one parent through a real foreign key per parent type,
 * so deleting a parent deletes its discussion and a comment can never point at nothing.
 */
export const comments = pgTable(
  'comments',
  {
    id: id(),
    orgId: orgId(),
    taskId: uuid('task_id').references(() => tasks.id, { onDelete: 'cascade' }),
    documentId: uuid('document_id').references(() => documents.id, { onDelete: 'cascade' }),
    requestId: uuid('request_id').references(() => requests.id, { onDelete: 'cascade' }),
    approvalId: uuid('approval_id').references(() => approvals.id, { onDelete: 'cascade' }),
    parentId: uuid('parent_id'),
    authorId: uuid('author_id').references(() => users.id, { onDelete: 'set null' }),
    body: jsonb('body').$type<RichText>().notNull(),
    bodyText: text('body_text').notNull(),
    /** Client-visible comments appear in the portal. Internal comments never do. */
    visibility: commentVisibility('visibility').notNull().default('internal'),
    mentions: jsonb('mentions').$type<string[]>().notNull().default([]),
    resolvedAt: ts('resolved_at'),
    editedAt: ts('edited_at'),
    deletedAt: ts('deleted_at'),
    createdAt: createdAt(),
  },
  (t) => [
    index('comments_task_idx').on(t.taskId, t.createdAt),
    index('comments_document_idx').on(t.documentId, t.createdAt),
    index('comments_request_idx').on(t.requestId, t.createdAt),
    index('comments_approval_idx').on(t.approvalId, t.createdAt),
    check(
      'comments_single_parent',
      sql`num_nonnulls(${t.taskId}, ${t.documentId}, ${t.requestId}, ${t.approvalId}) = 1`,
    ),
  ],
);

export const commentReactions = pgTable(
  'comment_reactions',
  {
    orgId: orgId(),
    commentId: uuid('comment_id')
      .notNull()
      .references(() => comments.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    emoji: text('emoji').notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.commentId, t.userId, t.emoji] })],
);

/** Human-readable activity, shown in feeds. client_visible rows also appear in the portal. */
export const activityEvents = pgTable(
  'activity_events',
  {
    id: id(),
    orgId: orgId(),
    projectId: uuid('project_id'),
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
    verb: text('verb').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id').notNull(),
    summary: text('summary').notNull(),
    data: jsonb('data').$type<Record<string, unknown>>().notNull().default({}),
    clientVisible: boolean('client_visible').notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [
    index('activity_events_org_idx').on(t.orgId, t.createdAt),
    index('activity_events_project_idx').on(t.projectId, t.createdAt),
    index('activity_events_entity_idx').on(t.entityId, t.createdAt),
  ],
);

export const notificationCategory = pgEnum('notification_category', [
  'assignment',
  'mention',
  'comment',
  'status',
  'approval',
  'request',
  'due',
  'membership',
]);

export const notifications = pgTable(
  'notifications',
  {
    id: id(),
    orgId: orgId(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
    category: notificationCategory('category').notNull(),
    title: text('title').notNull(),
    body: text('body'),
    /** Relative app path, e.g. /northwind/tasks/BRD-12. */
    href: text('href').notNull(),
    entityId: uuid('entity_id'),
    /** Collapses duplicates: one unread notification per (user, dedupe key). */
    dedupeKey: text('dedupe_key'),
    readAt: ts('read_at'),
    archivedAt: ts('archived_at'),
    emailedAt: ts('emailed_at'),
    createdAt: createdAt(),
  },
  (t) => [
    index('notifications_user_idx').on(t.userId, t.orgId, t.createdAt),
    uniqueIndex('notifications_dedupe_key')
      .on(t.userId, t.dedupeKey)
      .where(sql`${t.readAt} is null and ${t.dedupeKey} is not null`),
  ],
);

export const notificationPreferences = pgTable(
  'notification_preferences',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    category: notificationCategory('category').notNull(),
    inApp: boolean('in_app').notNull().default(true),
    email: boolean('email').notNull().default(true),
  },
  (t) => [primaryKey({ columns: [t.userId, t.category] })],
);

/**
 * Append-only stream for live updates. An insert trigger calls pg_notify, which PostgreSQL
 * only delivers after the transaction commits, so subscribers never see uncommitted changes.
 * Clients reconnect with the last id they saw and replay anything they missed.
 */
export const realtimeEvents = pgTable(
  'realtime_events',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    orgId: orgId(),
    /** Channel scope: "org", "project:<id>", or "user:<id>". */
    channel: text('channel').notNull(),
    type: text('type').notNull(),
    entityId: uuid('entity_id'),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [index('realtime_events_org_idx').on(t.orgId, t.id)],
);

/** Transactional outbox: side effects (notifications, email) recorded in the same transaction. */
export const outbox = pgTable(
  'outbox',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    /** Null for account emails (verification, password reset) that belong to no tenant. */
    orgId: uuid('org_id'),
    type: text('type').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    attempts: integer('attempts').notNull().default(0),
    lastError: text('last_error'),
    processedAt: ts('processed_at'),
    /** Earliest time the next attempt may run (exponential backoff). */
    runAfter: ts('run_after').notNull().defaultNow(),
    /** Set when attempts are exhausted; the item stays visible to administrators. */
    failedAt: ts('failed_at'),
    createdAt: createdAt(),
  },
  (t) => [index('outbox_pending_idx').on(t.id).where(sql`${t.processedAt} is null`)],
);

export const auditEvents = pgTable(
  'audit_events',
  {
    id: id(),
    orgId: orgId().references(() => organizations.id, { onDelete: 'cascade' }),
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
    action: text('action').notNull(),
    targetType: text('target_type'),
    targetId: uuid('target_id'),
    ipAddress: text('ip_address'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [index('audit_events_org_idx').on(t.orgId, t.createdAt)],
);

export const favorites = pgTable(
  'favorites',
  {
    orgId: orgId(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id').notNull(),
    position: integer('position').notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.entityType, t.entityId] })],
);

/** Recently opened resources, per user. Upserted on view, trimmed by the worker. */
export const recentItems = pgTable(
  'recent_items',
  {
    orgId: orgId(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id').notNull(),
    viewedAt: ts('viewed_at').notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.entityType, t.entityId] }),
    index('recent_items_user_idx').on(t.userId, t.orgId, t.viewedAt),
  ],
);

/**
 * Copy of every outgoing email. In development the /dev/mailbox page reads it, so
 * verification and invitation links work without any email provider.
 */
export const emailLog = pgTable('email_log', {
  id: id(),
  to: text('to').notNull(),
  subject: text('subject').notNull(),
  html: text('html').notNull(),
  text: text('text').notNull(),
  transport: text('transport').notNull(),
  status: text('status').notNull(),
  error: text('error'),
  createdAt: createdAt(),
});
