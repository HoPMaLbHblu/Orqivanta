import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { createdAt, id, orgId, ts, tsvector, updatedAt } from './_shared';
import { organizations, users } from './identity';
import { projects, tasks, type RichText } from './work';

export const collections = pgTable(
  'collections',
  {
    id: id(),
    orgId: orgId().references(() => organizations.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id'),
    name: text('name').notNull(),
    description: text('description'),
    icon: text('icon').notNull().default('folder'),
    position: integer('position').notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [
    unique('collections_org_id_key').on(t.orgId, t.id),
    foreignKey({
      name: 'collections_project_fk',
      columns: [t.orgId, t.projectId],
      foreignColumns: [projects.orgId, projects.id],
    }).onDelete('cascade'),
  ],
);

export const documentKind = pgEnum('document_kind', ['page', 'spec', 'meeting_notes', 'decision', 'brief']);

export const documents = pgTable(
  'documents',
  {
    id: id(),
    orgId: orgId(),
    projectId: uuid('project_id'),
    collectionId: uuid('collection_id'),
    title: text('title').notNull(),
    kind: documentKind('kind').notNull().default('page'),
    content: jsonb('content').$type<RichText>().notNull().default({ type: 'doc', content: [] }),
    contentText: text('content_text').notNull().default(''),
    /** Incremented on every saved change; clients must send the version they edited. */
    version: integer('version').notNull().default(1),
    sharedWithClient: boolean('shared_with_client').notNull().default(false),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: ts('deleted_at'),
    search: tsvector('search').generatedAlwaysAs(
      sql`setweight(to_tsvector('simple', coalesce(title,'')), 'A') || setweight(to_tsvector('simple', coalesce(content_text,'')), 'B')`,
    ),
  },
  (t) => [
    unique('documents_org_id_key').on(t.orgId, t.id),
    index('documents_project_idx').on(t.orgId, t.projectId),
    index('documents_search_idx').using('gin', t.search),
    index('documents_title_trgm_idx').using('gin', sql`${t.title} gin_trgm_ops`),
    foreignKey({
      name: 'documents_project_fk',
      columns: [t.orgId, t.projectId],
      foreignColumns: [projects.orgId, projects.id],
    }).onDelete('cascade'),
    foreignKey({
      name: 'documents_collection_fk',
      columns: [t.orgId, t.collectionId],
      foreignColumns: [collections.orgId, collections.id],
    }),
  ],
);

/**
 * Snapshot of a document. A snapshot is written when an editing session ends
 * (debounced), when a version is explicitly named, and before a restore.
 */
export const documentVersions = pgTable(
  'document_versions',
  {
    id: id(),
    orgId: orgId(),
    documentId: uuid('document_id').notNull(),
    version: integer('version').notNull(),
    title: text('title').notNull(),
    content: jsonb('content').$type<RichText>().notNull(),
    contentText: text('content_text').notNull(),
    label: text('label'),
    authorId: uuid('author_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [
    unique('document_versions_org_id_key').on(t.orgId, t.id),
    uniqueIndex('document_versions_doc_version_key').on(t.documentId, t.version),
    foreignKey({
      name: 'document_versions_document_fk',
      columns: [t.orgId, t.documentId],
      foreignColumns: [documents.orgId, documents.id],
    }).onDelete('cascade'),
  ],
);

export const fileKind = pgEnum('file_kind', ['attachment', 'deliverable']);

export const files = pgTable(
  'files',
  {
    id: id(),
    orgId: orgId(),
    /** Null only for attachments on requests that aren't linked to a project yet. */
    projectId: uuid('project_id'),
    /** Optional owning task (attachments). Requests store attachments with requestId. */
    taskId: uuid('task_id'),
    requestId: uuid('request_id'),
    name: text('name').notNull(),
    description: text('description'),
    kind: fileKind('kind').notNull().default('attachment'),
    currentVersion: integer('current_version').notNull().default(0),
    sharedWithClient: boolean('shared_with_client').notNull().default(false),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: ts('deleted_at'),
    search: tsvector('search').generatedAlwaysAs(
      sql`to_tsvector('simple', coalesce(name,'') || ' ' || coalesce(description,''))`,
    ),
  },
  (t) => [
    unique('files_org_id_key').on(t.orgId, t.id),
    index('files_project_idx').on(t.orgId, t.projectId),
    index('files_task_idx').on(t.taskId),
    index('files_search_idx').using('gin', t.search),
    foreignKey({
      name: 'files_project_fk',
      columns: [t.orgId, t.projectId],
      foreignColumns: [projects.orgId, projects.id],
    }).onDelete('cascade'),
    foreignKey({
      name: 'files_task_fk',
      columns: [t.orgId, t.taskId],
      foreignColumns: [tasks.orgId, tasks.id],
    }).onDelete('cascade'),
    check('files_single_owner', sql`num_nonnulls(${t.taskId}, ${t.requestId}) <= 1`),
    check('files_has_parent', sql`num_nonnulls(${t.projectId}, ${t.requestId}) >= 1`),
  ],
);

export const fileVersionStatus = pgEnum('file_version_status', ['ready', 'quarantined']);

export const fileVersions = pgTable(
  'file_versions',
  {
    id: id(),
    orgId: orgId(),
    fileId: uuid('file_id').notNull(),
    version: integer('version').notNull(),
    /** Random, unguessable storage key. Never derived from user input. */
    storageKey: text('storage_key').notNull(),
    previewKey: text('preview_key'),
    originalName: text('original_name').notNull(),
    mimeType: text('mime_type').notNull(),
    sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
    sha256: text('sha256').notNull(),
    width: integer('width'),
    height: integer('height'),
    status: fileVersionStatus('status').notNull().default('ready'),
    note: text('note'),
    uploadedBy: uuid('uploaded_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    meta: jsonb('meta').$type<Record<string, unknown>>(),
  },
  (t) => [
    unique('file_versions_org_id_key').on(t.orgId, t.id),
    uniqueIndex('file_versions_file_version_key').on(t.fileId, t.version),
    uniqueIndex('file_versions_storage_key').on(t.storageKey),
    foreignKey({
      name: 'file_versions_file_fk',
      columns: [t.orgId, t.fileId],
      foreignColumns: [files.orgId, files.id],
    }).onDelete('cascade'),
  ],
);
