import { z } from 'zod';
import {
  and,
  asc,
  collections,
  comments,
  desc,
  documentVersions,
  documents,
  eq,
  isNotNull,
  isNull,
  projects,
  sql,
  users,
  withTenant,
  type Tx,
} from '@orqivanta/db';
import { conflict, notFound, validation } from '../errors';
import { notify, publish, recordActivity } from '../lib/events';
import { extractMentions, richTextToPlain, sanitizeRichText, truncate, type RichDoc } from '../lib/richtext';
import { parse } from '../lib/validate';
import { canOrg, type Actor } from '../permissions';
import { assertItemVisible, assertWritable, getProjectAccess, visibleProjectsSql, type ProjectAccess } from './access';
import { userCanAccessProject } from './tasks';

export type DocumentKind = 'page' | 'spec' | 'meeting_notes' | 'decision' | 'brief';

export const DOCUMENT_TEMPLATES: Record<string, { title: string; kind: DocumentKind; content: RichDoc }> = {
  blank: { title: 'Untitled', kind: 'page', content: { type: 'doc', content: [] } },
  meeting_notes: {
    title: 'Meeting notes',
    kind: 'meeting_notes',
    content: {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Attendees' }] },
        { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph' }] }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Notes' }] },
        { type: 'paragraph' },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Action items' }] },
        { type: 'taskList', content: [{ type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph' }] }] },
      ],
    },
  },
  spec: {
    title: 'Specification',
    kind: 'spec',
    content: {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Problem' }] },
        { type: 'paragraph' },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Proposal' }] },
        { type: 'paragraph' },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Out of scope' }] },
        { type: 'paragraph' },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Open questions' }] },
        { type: 'paragraph' },
      ],
    },
  },
  decision: {
    title: 'Decision record',
    kind: 'decision',
    content: {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Context' }] },
        { type: 'paragraph' },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Decision' }] },
        { type: 'paragraph' },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Consequences' }] },
        { type: 'paragraph' },
      ],
    },
  },
  brief: {
    title: 'Creative brief',
    kind: 'brief',
    content: {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Objective' }] },
        { type: 'paragraph' },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Audience' }] },
        { type: 'paragraph' },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Deliverables' }] },
        { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph' }] }] },
      ],
    },
  },
};

type DocRow = typeof documents.$inferSelect;
export interface DocAccess {
  doc: DocRow;
  project: ProjectAccess | null;
  isClient: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canShare: boolean;
}

/**
 * Org-wide documents (no project) are visible to internal members only.
 * Project documents follow project access; client contacts see only shared documents.
 */
export async function getDocAccess(tx: Tx, actor: Actor, documentId: string, opts: { includeDeleted?: boolean } = {}): Promise<DocAccess> {
  const [doc] = await tx.select().from(documents).where(eq(documents.id, documentId));
  if (!doc || doc.orgId !== actor.orgId || (doc.deletedAt && !opts.includeDeleted)) throw notFound('That document');
  if (!doc.projectId) {
    if (!canOrg(actor.role, 'documents.browse')) throw notFound('That document');
    const isAdmin = actor.role === 'owner' || actor.role === 'admin';
    return { doc, project: null, isClient: false, canEdit: true, canDelete: isAdmin || doc.createdBy === actor.userId, canShare: false };
  }
  const project = await getProjectAccess(tx, actor, doc.projectId);
  assertItemVisible(project, doc.sharedWithClient, 'That document');
  const archived = Boolean(project.project.archivedAt);
  return {
    doc,
    project,
    isClient: project.isClient,
    canEdit: project.can('document.update') && !archived,
    canDelete: project.can('document.delete') || (doc.createdBy === actor.userId && project.can('document.update')),
    canShare: project.can('project.shareWithClient'),
  };
}

const listSchema = z.object({
  projectId: z.uuid().optional(),
  collectionId: z.uuid().optional(),
  scope: z.enum(['all', 'org', 'project']).default('all'),
  kind: z.enum(['page', 'spec', 'meeting_notes', 'decision', 'brief']).optional(),
  q: z.string().trim().max(100).optional(),
  deleted: z.boolean().optional(),
});

export async function listDocuments(actor: Actor, input: unknown = {}) {
  const f = parse(listSchema, input);
  return withTenant(actor.orgId, async (tx) => {
    let isClient = actor.role === 'client';
    if (f.projectId) isClient = (await getProjectAccess(tx, actor, f.projectId)).isClient;
    const projectVisible = sql`(${documents.projectId} is null and ${actor.role !== 'client'}) or exists (select 1 from ${projects} where ${projects.id} = ${documents.projectId} and ${visibleProjectsSql(actor)})`;
    const rows = await tx
      .select({
        id: documents.id,
        title: documents.title,
        kind: documents.kind,
        projectId: documents.projectId,
        projectKey: projects.key,
        projectName: projects.name,
        collectionId: documents.collectionId,
        sharedWithClient: documents.sharedWithClient,
        version: documents.version,
        updatedAt: documents.updatedAt,
        deletedAt: documents.deletedAt,
        updatedByName: users.name,
        updatedByColor: users.avatarColor,
        excerpt: sql<string>`left(${documents.contentText}, 180)`,
        commentCount: sql<number>`(select count(*)::int from ${comments} c where c.document_id = ${documents.id} and c.deleted_at is null and c.resolved_at is null ${isClient ? sql`and c.visibility = 'client'` : sql``})`,
      })
      .from(documents)
      .leftJoin(projects, eq(projects.id, documents.projectId))
      .leftJoin(users, eq(users.id, documents.updatedBy))
      .where(
        and(
          eq(documents.orgId, actor.orgId),
          f.deleted ? isNotNull(documents.deletedAt) : isNull(documents.deletedAt),
          projectVisible,
          isClient ? eq(documents.sharedWithClient, true) : undefined,
          f.projectId ? eq(documents.projectId, f.projectId) : f.scope === 'org' ? isNull(documents.projectId) : f.scope === 'project' ? isNotNull(documents.projectId) : undefined,
          f.collectionId ? eq(documents.collectionId, f.collectionId) : undefined,
          f.kind ? eq(documents.kind, f.kind) : undefined,
          f.q ? sql`(${documents.title} ilike ${'%' + f.q + '%'} or ${documents.search} @@ plainto_tsquery('simple', ${f.q}))` : undefined,
        ),
      )
      .orderBy(desc(documents.updatedAt))
      .limit(200);
    return rows;
  });
}

export async function getDocument(actor: Actor, documentId: string) {
  return withTenant(actor.orgId, async (tx) => {
    const a = await getDocAccess(tx, actor, documentId, { includeDeleted: true });
    if (a.doc.deletedAt && a.isClient) throw notFound('That document');
    const [updatedBy] = a.doc.updatedBy ? await tx.select({ name: users.name, avatarColor: users.avatarColor }).from(users).where(eq(users.id, a.doc.updatedBy)) : [];
    const [collection] = a.doc.collectionId ? await tx.select({ id: collections.id, name: collections.name }).from(collections).where(eq(collections.id, a.doc.collectionId)) : [];
    const [{ versions }] = (await tx.select({ versions: sql<number>`count(*)::int` }).from(documentVersions).where(eq(documentVersions.documentId, documentId))) as [{ versions: number }];
    return {
      doc: a.doc,
      project: a.project ? { id: a.project.project.id, key: a.project.project.key, name: a.project.project.name, portalEnabled: a.project.project.portalEnabled, archived: Boolean(a.project.project.archivedAt) } : null,
      access: { isClient: a.isClient, canEdit: a.canEdit && !a.doc.deletedAt, canDelete: a.canDelete, canShare: a.canShare },
      updatedBy: updatedBy ?? null,
      collection: collection ?? null,
      versionCount: versions,
    };
  });
}

const createSchema = z.object({
  title: z.string().trim().max(200).optional(),
  projectId: z.uuid().nullable().optional(),
  collectionId: z.uuid().nullable().optional(),
  template: z.enum(['blank', 'meeting_notes', 'spec', 'decision', 'brief']).default('blank'),
});

export async function createDocument(actor: Actor, input: unknown) {
  const data = parse(createSchema, input);
  return withTenant(actor.orgId, async (tx) => {
    if (data.projectId) {
      const access = await getProjectAccess(tx, actor, data.projectId);
      if (!access.can('document.create')) throw notFound('That project');
      assertWritable(access);
    } else if (!canOrg(actor.role, 'documents.browse')) {
      throw notFound('That page');
    }
    if (data.collectionId) {
      const [c] = await tx.select().from(collections).where(eq(collections.id, data.collectionId));
      if (!c || (c.projectId ?? null) !== (data.projectId ?? null)) throw validation({ collectionId: 'That collection belongs somewhere else.' });
    }
    const tpl = DOCUMENT_TEMPLATES[data.template]!;
    const title = data.title || tpl.title;
    const [doc] = await tx
      .insert(documents)
      .values({
        orgId: actor.orgId,
        projectId: data.projectId ?? null,
        collectionId: data.collectionId ?? null,
        title,
        kind: tpl.kind,
        content: tpl.content,
        contentText: richTextToPlain(tpl.content),
        createdBy: actor.userId,
        updatedBy: actor.userId,
      })
      .returning();
    await recordActivity(tx, actor, { projectId: data.projectId ?? null, verb: 'created', entityType: 'document', entityId: doc!.id, summary: `created the document ${title}` });
    if (data.projectId) await publish(tx, actor.orgId, `project:${data.projectId}`, 'document.created', doc!.id);
    return doc!;
  });
}

const saveSchema = z.object({
  documentId: z.uuid(),
  /** The version the editor started from. A mismatch means someone else saved in between. */
  baseVersion: z.number().int().positive(),
  title: z.string().trim().max(200).optional(),
  content: z.unknown().optional(),
});

const SNAPSHOT_INTERVAL_MS = 10 * 60 * 1000;

/**
 * Saves a document with optimistic concurrency. If another save landed first, nothing is
 * overwritten: the caller gets CONFLICT with the latest content and chooses how to resolve.
 * A history snapshot is kept per editing session (new author, or 10 minutes since the last).
 */
export async function saveDocument(actor: Actor, input: unknown) {
  const data = parse(saveSchema, input);
  return withTenant(actor.orgId, async (tx) => {
    const a = await getDocAccess(tx, actor, data.documentId);
    if (!a.canEdit) throw notFound('That document');
    if (a.project) assertWritable(a.project);
    const doc = a.doc;
    if (doc.version !== data.baseVersion) {
      const [by] = doc.updatedBy ? await tx.select({ name: users.name }).from(users).where(eq(users.id, doc.updatedBy)) : [];
      throw conflict(
        { version: doc.version, title: doc.title, content: doc.content, updatedAt: doc.updatedAt, updatedByName: by?.name ?? null },
        `${by?.name ?? 'Someone'} saved a newer version while you were editing.`,
      );
    }
    const content = data.content !== undefined ? sanitizeRichText(data.content) : (doc.content as RichDoc);
    const title = data.title !== undefined ? data.title || 'Untitled' : doc.title;
    const text = richTextToPlain(content);
    const [updated] = await tx
      .update(documents)
      .set({ title, content, contentText: text, version: doc.version + 1, updatedBy: actor.userId, updatedAt: new Date() })
      .where(and(eq(documents.id, doc.id), eq(documents.version, doc.version)))
      .returning();
    if (!updated) throw conflict({ version: doc.version + 1 }, 'Someone saved a newer version while you were editing.');

    const [last] = await tx.select().from(documentVersions).where(eq(documentVersions.documentId, doc.id)).orderBy(desc(documentVersions.version)).limit(1);
    if (!last || last.authorId !== actor.userId || Date.now() - last.createdAt.getTime() > SNAPSHOT_INTERVAL_MS) {
      await tx.insert(documentVersions).values({ orgId: actor.orgId, documentId: doc.id, version: updated!.version, title, content, contentText: text, authorId: actor.userId });
    } else {
      await tx.update(documentVersions).set({ version: updated!.version, title, content, contentText: text, createdAt: new Date() }).where(eq(documentVersions.id, last.id));
    }

    const newMentions = extractMentions(content).filter((id) => !extractMentions(doc.content as RichDoc).includes(id));
    if (newMentions.length) {
      const allowed: string[] = [];
      for (const id of newMentions) {
        if (!a.project) allowed.push(id);
        else {
          const role = await userCanAccessProject(tx, a.project.project, id);
          if (role && (role !== 'client' || doc.sharedWithClient)) allowed.push(id);
        }
      }
      await notify(tx, actor, {
        userIds: allowed,
        category: 'mention',
        title: `You were mentioned in ${truncate(title, 80)}`,
        href: `/${actor.orgSlug}/documents/${doc.id}`,
        entityId: doc.id,
      });
    }
    if (doc.projectId) await publish(tx, actor.orgId, `project:${doc.projectId}`, 'document.updated', doc.id, { version: updated!.version, clientVisible: doc.sharedWithClient });
    return { version: updated!.version, updatedAt: updated!.updatedAt };
  });
}

export async function listDocumentVersions(actor: Actor, documentId: string) {
  return withTenant(actor.orgId, async (tx) => {
    const a = await getDocAccess(tx, actor, documentId);
    if (a.isClient) throw notFound('That document');
    return tx
      .select({ id: documentVersions.id, version: documentVersions.version, title: documentVersions.title, label: documentVersions.label, createdAt: documentVersions.createdAt, authorName: users.name, authorColor: users.avatarColor, length: sql<number>`length(${documentVersions.contentText})` })
      .from(documentVersions)
      .leftJoin(users, eq(users.id, documentVersions.authorId))
      .where(eq(documentVersions.documentId, documentId))
      .orderBy(desc(documentVersions.version));
  });
}

export async function getDocumentVersion(actor: Actor, documentId: string, versionId: string) {
  return withTenant(actor.orgId, async (tx) => {
    const a = await getDocAccess(tx, actor, documentId);
    const [v] = await tx.select().from(documentVersions).where(and(eq(documentVersions.id, versionId), eq(documentVersions.documentId, documentId)));
    if (!v) throw notFound('That version');
    // Clients may read only versions that were sent to them for approval.
    if (a.isClient) {
      const allowed = await tx.execute<{ ok: boolean }>(sql`select exists(select 1 from approvals ap join approval_reviewers r on r.approval_id = ap.id where ap.document_version_id = ${versionId} and r.user_id = ${actor.userId}) as ok`);
      if (!allowed.rows[0]?.ok) throw notFound('That version');
    }
    return v;
  });
}

/** Creates an exact, immutable snapshot of the current document (used for approvals). */
export async function snapshotDocument(tx: Tx, actor: Actor, documentId: string, label: string) {
  const [doc] = await tx.select().from(documents).where(eq(documents.id, documentId));
  if (!doc) throw notFound('That document');
  const [existing] = await tx.select().from(documentVersions).where(and(eq(documentVersions.documentId, documentId), eq(documentVersions.version, doc.version)));
  if (existing) {
    if (!existing.label) await tx.update(documentVersions).set({ label }).where(eq(documentVersions.id, existing.id));
    return existing;
  }
  const [v] = await tx
    .insert(documentVersions)
    .values({ orgId: actor.orgId, documentId, version: doc.version, title: doc.title, content: doc.content, contentText: doc.contentText, label, authorId: actor.userId })
    .returning();
  return v!;
}

export async function nameDocumentVersion(actor: Actor, input: unknown) {
  const data = parse(z.object({ documentId: z.uuid(), label: z.string().trim().min(1).max(60) }), input);
  return withTenant(actor.orgId, async (tx) => {
    const a = await getDocAccess(tx, actor, data.documentId);
    if (!a.canEdit) throw notFound('That document');
    return snapshotDocument(tx, actor, data.documentId, data.label);
  });
}

/** Restores an earlier version as a new version, so nothing in the history is lost. */
export async function restoreDocumentVersion(actor: Actor, input: unknown) {
  const data = parse(z.object({ documentId: z.uuid(), versionId: z.uuid() }), input);
  return withTenant(actor.orgId, async (tx) => {
    const a = await getDocAccess(tx, actor, data.documentId);
    if (!a.canEdit) throw notFound('That document');
    const [v] = await tx.select().from(documentVersions).where(and(eq(documentVersions.id, data.versionId), eq(documentVersions.documentId, data.documentId)));
    if (!v) throw notFound('That version');
    await snapshotDocument(tx, actor, data.documentId, a.doc.version === v.version ? 'Current' : 'Before restore');
    const next = a.doc.version + 1;
    await tx.update(documents).set({ title: v.title, content: v.content, contentText: v.contentText, version: next, updatedBy: actor.userId, updatedAt: new Date() }).where(eq(documents.id, data.documentId));
    await tx.insert(documentVersions).values({ orgId: actor.orgId, documentId: data.documentId, version: next, title: v.title, content: v.content, contentText: v.contentText, label: `Restored v${v.version}`, authorId: actor.userId });
    await recordActivity(tx, actor, { projectId: a.doc.projectId, verb: 'restored', entityType: 'document', entityId: data.documentId, summary: `restored ${a.doc.title} to version ${v.version}` });
    if (a.doc.projectId) await publish(tx, actor.orgId, `project:${a.doc.projectId}`, 'document.updated', a.doc.id, { version: next });
    return { version: next };
  });
}

export async function setDocumentShared(actor: Actor, input: unknown) {
  const data = parse(z.object({ documentId: z.uuid(), shared: z.boolean() }), input);
  return withTenant(actor.orgId, async (tx) => {
    const a = await getDocAccess(tx, actor, data.documentId);
    if (!a.canShare || !a.project) throw validation({ shared: 'Only project managers can share project documents with the client.' });
    if (data.shared && !a.project.project.clientAccountId) throw validation({ shared: 'Link this project to a client first.' });
    await tx.update(documents).set({ sharedWithClient: data.shared, version: a.doc.version + 1, updatedAt: new Date() }).where(eq(documents.id, a.doc.id));
    await recordActivity(tx, actor, {
      projectId: a.doc.projectId,
      verb: data.shared ? 'shared' : 'unshared',
      entityType: 'document',
      entityId: a.doc.id,
      summary: data.shared ? `shared ${a.doc.title} with the client` : `stopped sharing ${a.doc.title} with the client`,
      clientVisible: data.shared,
    });
    await publish(tx, actor.orgId, `project:${a.doc.projectId}`, 'document.updated', a.doc.id, { clientVisible: true });
  });
}

export async function setDocumentDeleted(actor: Actor, input: unknown) {
  const data = parse(z.object({ documentId: z.uuid(), deleted: z.boolean() }), input);
  return withTenant(actor.orgId, async (tx) => {
    const a = await getDocAccess(tx, actor, data.documentId, { includeDeleted: true });
    if (!a.canDelete) throw notFound('That document');
    await tx.update(documents).set({ deletedAt: data.deleted ? new Date() : null, updatedAt: new Date() }).where(eq(documents.id, a.doc.id));
    await recordActivity(tx, actor, { projectId: a.doc.projectId, verb: data.deleted ? 'deleted' : 'restored', entityType: 'document', entityId: a.doc.id, summary: `${data.deleted ? 'deleted' : 'restored'} the document ${a.doc.title}` });
    if (a.doc.projectId) await publish(tx, actor.orgId, `project:${a.doc.projectId}`, 'document.deleted', a.doc.id, { clientVisible: a.doc.sharedWithClient });
  });
}

export async function moveDocument(actor: Actor, input: unknown) {
  const data = parse(z.object({ documentId: z.uuid(), collectionId: z.uuid().nullable() }), input);
  return withTenant(actor.orgId, async (tx) => {
    const a = await getDocAccess(tx, actor, data.documentId);
    if (!a.canEdit) throw notFound('That document');
    if (data.collectionId) {
      const [c] = await tx.select().from(collections).where(eq(collections.id, data.collectionId));
      if (!c || (c.projectId ?? null) !== (a.doc.projectId ?? null)) throw validation({ collectionId: 'That collection belongs somewhere else.' });
    }
    await tx.update(documents).set({ collectionId: data.collectionId }).where(eq(documents.id, a.doc.id));
  });
}

export async function listCollections(actor: Actor, projectId: string | null) {
  return withTenant(actor.orgId, async (tx) => {
    if (projectId) await getProjectAccess(tx, actor, projectId);
    else if (!canOrg(actor.role, 'documents.browse')) throw notFound('That page');
    return tx
      .select({ id: collections.id, name: collections.name, icon: collections.icon, description: collections.description, projectId: collections.projectId, docCount: sql<number>`(select count(*)::int from ${documents} d where d.collection_id = ${collections.id} and d.deleted_at is null)` })
      .from(collections)
      .where(and(eq(collections.orgId, actor.orgId), projectId ? eq(collections.projectId, projectId) : isNull(collections.projectId)))
      .orderBy(asc(collections.position), asc(collections.name));
  });
}

export async function saveCollection(actor: Actor, input: unknown) {
  const data = parse(z.object({ collectionId: z.uuid().optional(), projectId: z.uuid().nullable(), name: z.string().trim().min(1, 'Name the collection.').max(60), description: z.string().trim().max(200).optional().nullable() }), input);
  return withTenant(actor.orgId, async (tx) => {
    if (data.projectId) {
      const access = await getProjectAccess(tx, actor, data.projectId);
      if (!access.can('document.create')) throw notFound('That project');
    } else if (!canOrg(actor.role, 'documents.browse')) throw notFound('That page');
    if (data.collectionId) {
      const [c] = await tx.update(collections).set({ name: data.name, description: data.description ?? null }).where(eq(collections.id, data.collectionId)).returning();
      if (!c) throw notFound('That collection');
      return c;
    }
    const [c] = await tx.insert(collections).values({ orgId: actor.orgId, projectId: data.projectId, name: data.name, description: data.description ?? null }).returning();
    return c!;
  });
}

export async function deleteCollection(actor: Actor, input: unknown) {
  const { collectionId } = parse(z.object({ collectionId: z.uuid() }), input);
  return withTenant(actor.orgId, async (tx) => {
    const [c] = await tx.select().from(collections).where(eq(collections.id, collectionId));
    if (!c) throw notFound('That collection');
    if (c.projectId) {
      const access = await getProjectAccess(tx, actor, c.projectId);
      if (!access.can('document.delete')) throw notFound('That collection');
    } else if (actor.role !== 'owner' && actor.role !== 'admin') throw notFound('That collection');
    // Documents stay; they just leave the collection.
    await tx.update(documents).set({ collectionId: null }).where(eq(documents.collectionId, collectionId));
    await tx.delete(collections).where(eq(collections.id, collectionId));
  });
}
