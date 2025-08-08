import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
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
import { documentVersions, documents, fileVersions, files } from './content';
import { clientAccounts, organizations, users } from './identity';
import { milestones, projects, taskPriority, tasks } from './work';

export type FormField = {
  key: string;
  label: string;
  type: 'short_text' | 'long_text' | 'select' | 'date' | 'url' | 'number';
  required: boolean;
  options?: string[];
  help?: string;
};

export const formAudience = pgEnum('form_audience', ['internal', 'client', 'both']);

export const requestForms = pgTable(
  'request_forms',
  {
    id: id(),
    orgId: orgId().references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    audience: formAudience('audience').notNull().default('both'),
    fields: jsonb('fields').$type<FormField[]>().notNull().default([]),
    /** Default triage owner for new requests submitted through this form. */
    defaultOwnerId: uuid('default_owner_id').references(() => users.id, { onDelete: 'set null' }),
    active: boolean('active').notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [unique('request_forms_org_id_key').on(t.orgId, t.id)],
);

export const requestStatus = pgEnum('request_status', [
  'submitted',
  'in_review',
  'needs_info',
  'accepted',
  'in_progress',
  'completed',
  'declined',
  'duplicate',
]);

export const requests = pgTable(
  'requests',
  {
    id: id(),
    orgId: orgId(),
    number: integer('number').notNull(),
    clientAccountId: uuid('client_account_id'),
    projectId: uuid('project_id'),
    formId: uuid('form_id'),
    title: text('title').notNull(),
    details: text('details').notNull().default(''),
    /** Answers to the form's custom fields, keyed by field key. Validated against the form on submit. */
    answers: jsonb('answers').$type<Record<string, unknown>>().notNull().default({}),
    status: requestStatus('status').notNull().default('submitted'),
    priority: taskPriority('priority').notNull().default('none'),
    ownerId: uuid('owner_id').references(() => users.id, { onDelete: 'set null' }),
    submittedBy: uuid('submitted_by').references(() => users.id, { onDelete: 'set null' }),
    duplicateOfId: uuid('duplicate_of_id'),
    convertedTaskId: uuid('converted_task_id'),
    convertedProjectId: uuid('converted_project_id'),
    closureReason: text('closure_reason'),
    dueDate: date('due_date', { mode: 'string' }),
    firstResponseAt: ts('first_response_at'),
    resolvedAt: ts('resolved_at'),
    version: integer('version').notNull().default(1),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    search: tsvector('search').generatedAlwaysAs(
      sql`to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(details,''))`,
    ),
  },
  (t) => [
    unique('requests_org_id_key').on(t.orgId, t.id),
    uniqueIndex('requests_org_number_key').on(t.orgId, t.number),
    index('requests_status_idx').on(t.orgId, t.status),
    index('requests_client_idx').on(t.orgId, t.clientAccountId),
    index('requests_search_idx').using('gin', t.search),
    foreignKey({
      name: 'requests_client_fk',
      columns: [t.orgId, t.clientAccountId],
      foreignColumns: [clientAccounts.orgId, clientAccounts.id],
    }),
    foreignKey({
      name: 'requests_project_fk',
      columns: [t.orgId, t.projectId],
      foreignColumns: [projects.orgId, projects.id],
    }),
    foreignKey({
      name: 'requests_form_fk',
      columns: [t.orgId, t.formId],
      foreignColumns: [requestForms.orgId, requestForms.id],
    }),
    foreignKey({
      name: 'requests_duplicate_fk',
      columns: [t.orgId, t.duplicateOfId],
      foreignColumns: [t.orgId, t.id],
    }),
    foreignKey({
      name: 'requests_task_fk',
      columns: [t.orgId, t.convertedTaskId],
      foreignColumns: [tasks.orgId, tasks.id],
    }),
    foreignKey({
      name: 'requests_converted_project_fk',
      columns: [t.orgId, t.convertedProjectId],
      foreignColumns: [projects.orgId, projects.id],
    }),
  ],
);

export const approvalRule = pgEnum('approval_rule', ['any', 'all']);
export const approvalStatus = pgEnum('approval_status', [
  'pending',
  'approved',
  'changes_requested',
  'rejected',
  'canceled',
  'superseded',
]);
export const reviewDecision = pgEnum('review_decision', ['approved', 'changes_requested', 'rejected']);

export const approvals = pgTable(
  'approvals',
  {
    id: id(),
    orgId: orgId(),
    projectId: uuid('project_id').notNull(),
    title: text('title').notNull(),
    instructions: text('instructions'),
    /** Exactly one subject: an exact file version, an exact document version, or a milestone. */
    fileVersionId: uuid('file_version_id'),
    documentVersionId: uuid('document_version_id'),
    milestoneId: uuid('milestone_id'),
    /** Denormalized for listing; the version above is what was actually reviewed. */
    fileId: uuid('file_id'),
    documentId: uuid('document_id'),
    rule: approvalRule('rule').notNull().default('all'),
    status: approvalStatus('status').notNull().default('pending'),
    dueDate: date('due_date', { mode: 'string' }),
    /** Earlier round this approval replaced, when a new version reopened review. */
    previousId: uuid('previous_id'),
    round: integer('round').notNull().default(1),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    decidedAt: ts('decided_at'),
    lastReminderAt: ts('last_reminder_at'),
    version: integer('version').notNull().default(1),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique('approvals_org_id_key').on(t.orgId, t.id),
    index('approvals_project_idx').on(t.orgId, t.projectId, t.status),
    check(
      'approvals_single_subject',
      sql`num_nonnulls(${t.fileVersionId}, ${t.documentVersionId}, ${t.milestoneId}) = 1`,
    ),
    foreignKey({
      name: 'approvals_project_fk',
      columns: [t.orgId, t.projectId],
      foreignColumns: [projects.orgId, projects.id],
    }).onDelete('cascade'),
    foreignKey({
      name: 'approvals_file_version_fk',
      columns: [t.orgId, t.fileVersionId],
      foreignColumns: [fileVersions.orgId, fileVersions.id],
    }).onDelete('cascade'),
    foreignKey({
      name: 'approvals_document_version_fk',
      columns: [t.orgId, t.documentVersionId],
      foreignColumns: [documentVersions.orgId, documentVersions.id],
    }).onDelete('cascade'),
    foreignKey({
      name: 'approvals_milestone_fk',
      columns: [t.orgId, t.milestoneId],
      foreignColumns: [milestones.orgId, milestones.id],
    }).onDelete('cascade'),
    foreignKey({
      name: 'approvals_file_fk',
      columns: [t.orgId, t.fileId],
      foreignColumns: [files.orgId, files.id],
    }).onDelete('cascade'),
    foreignKey({
      name: 'approvals_document_fk',
      columns: [t.orgId, t.documentId],
      foreignColumns: [documents.orgId, documents.id],
    }).onDelete('cascade'),
    foreignKey({
      name: 'approvals_previous_fk',
      columns: [t.orgId, t.previousId],
      foreignColumns: [t.orgId, t.id],
    }),
  ],
);

export const approvalReviewers = pgTable(
  'approval_reviewers',
  {
    orgId: orgId(),
    approvalId: uuid('approval_id')
      .notNull()
      .references(() => approvals.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    decision: reviewDecision('decision'),
    comment: text('comment'),
    decidedAt: ts('decided_at'),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.approvalId, t.userId] }),
    index('approval_reviewers_user_idx').on(t.userId),
  ],
);
