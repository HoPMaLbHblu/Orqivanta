import { sql } from 'drizzle-orm';
import { customType, timestamp, uuid } from 'drizzle-orm/pg-core';

export const id = () => uuid('id').primaryKey().default(sql`gen_random_uuid()`);

export const orgId = () => uuid('org_id').notNull();

export const createdAt = () =>
  timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow();

export const updatedAt = () =>
  timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow();

export const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });

/** PostgreSQL tsvector, maintained by generated columns declared in SQL migrations. */
export const tsvector = customType<{ data: string }>({
  dataType() {
    return 'tsvector';
  },
});

/** Tables that carry org_id and are protected by row-level security. Kept in sync with migrations/rls. */
export const TENANT_TABLES = [
  'memberships',
  'teams',
  'team_members',
  'client_accounts',
  'invitations',
  'projects',
  'project_members',
  'project_statuses',
  'milestones',
  'project_updates',
  'labels',
  'tasks',
  'task_labels',
  'task_watchers',
  'task_dependencies',
  'checklist_items',
  'task_history',
  'collections',
  'documents',
  'document_versions',
  'files',
  'file_versions',
  'request_forms',
  'requests',
  'approvals',
  'approval_reviewers',
  'comments',
  'comment_reactions',
  'activity_events',
  'notifications',
  'realtime_events',
  'outbox',
  'audit_events',
  'favorites',
  'recent_items',
  'saved_views',
] as const;
