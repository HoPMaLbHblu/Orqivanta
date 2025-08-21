import { z } from 'zod';
import {
  and,
  approvals,
  desc,
  eq,
  fileVersions,
  files,
  isNull,
  organizations,
  outbox,
  projects,
  requests,
  sql,
  tasks,
  users,
  withTenant,
  type Tx,
} from '@orqivanta/db';
import { AppError, notFound, validation } from '../errors';
import { config } from '../config';
import { sha256 } from '../lib/crypto';
import { publish, recordActivity } from '../lib/events';
import { parse } from '../lib/validate';
import type { Actor } from '../permissions';
import { newStorageKey, storage } from '../storage';
import { inspectUpload, PREVIEWABLE, sanitizeFileName } from '../storage/inspect';
import { assertItemVisible, assertWritable, getProjectAccess, visibleProjectsSql } from './access';
import { reopenApprovalsForFile } from './approvals';
import { getRequestAccess } from './requests';

export interface UploadInput {
  buffer: Buffer;
  originalName: string;
}

async function assertQuota(tx: Tx, orgId: string, incoming: number) {
  const [org] = await tx.select({ quotaMb: organizations.storageQuotaMb }).from(organizations).where(eq(organizations.id, orgId));
  const [{ used }] = (await tx
    .select({ used: sql<number>`coalesce(sum(${fileVersions.sizeBytes}), 0)::bigint` })
    .from(fileVersions)
    .where(eq(fileVersions.orgId, orgId))) as [{ used: number }];
  const quota = (org?.quotaMb ?? 1024) * 1024 * 1024;
  if (Number(used) + incoming > quota) {
    throw new AppError('QUOTA_EXCEEDED', `This upload would exceed your organization’s ${Math.round(quota / 1048576)} MB storage limit. Delete unused files or ask an admin to raise the limit.`);
  }
}


type FileRow = typeof files.$inferSelect;

export interface FileAccess {
  isClient: boolean;
  canUpload: boolean;
  canDelete: boolean;
  canShare: boolean;
  project: Awaited<ReturnType<typeof getProjectAccess>> | null;
}

/**
 * Access to one file. Project files follow project access and per-file client sharing.
 * Request attachments (with or without a project) follow access to the request.
 */
export async function getFileAccess(tx: Tx, actor: Actor, file: FileRow): Promise<FileAccess> {
  if (file.requestId) {
    const r = await getRequestAccess(tx, actor, file.requestId);
    return { isClient: r.isClient, canUpload: true, canDelete: !r.isClient || file.createdBy === actor.userId, canShare: false, project: null };
  }
  if (!file.projectId) throw notFound('That file');
  const access = await getProjectAccess(tx, actor, file.projectId);
  assertItemVisible(access, file.sharedWithClient, 'That file');
  const own = file.createdBy === actor.userId && access.can('file.upload');
  return {
    isClient: access.isClient,
    canUpload: access.can('file.upload') && !access.project.archivedAt,
    canDelete: access.can('file.delete') || own,
    canShare: access.can('project.shareWithClient'),
    project: access,
  };
}

/** Validates and stores the bytes. Called before the database transaction. */
async function storeUpload(upload: UploadInput) {
  if (upload.buffer.length === 0) throw validation({ file: 'This file is empty.' });
  if (upload.buffer.length > config.maxUploadBytes) {
    throw validation({ file: `Files can be up to ${Math.round(config.maxUploadBytes / 1048576)} MB.` });
  }
  const { mimeType } = await inspectUpload(upload.buffer, upload.originalName);
  const storageKey = newStorageKey('f');
  await storage.put(storageKey, upload.buffer);
  return { storageKey, mimeType, sizeBytes: upload.buffer.length, sha256: sha256(upload.buffer), originalName: sanitizeFileName(upload.originalName) };
}

const createSchema = z.object({
  projectId: z.uuid().nullable().optional(),
  taskId: z.uuid().nullable().optional(),
  requestId: z.uuid().nullable().optional(),
  kind: z.enum(['attachment', 'deliverable']).default('attachment'),
  name: z.string().trim().max(180).optional(),
  description: z.string().trim().max(1000).optional().nullable(),
  sharedWithClient: z.boolean().default(false),
});

/**
 * Creates a file with its first version. Bytes are stored first under a random key; if the
 * database transaction then fails, the cleanup job removes the orphaned object.
 */
export async function uploadFile(actor: Actor, input: unknown, upload: UploadInput) {
  const data = parse(createSchema, input);
  return withTenant(actor.orgId, async (tx) => {
    let sharedWithClient = data.sharedWithClient;
    let projectId = data.projectId ?? null;
    if (data.requestId) {
      // Request attachments: anyone who can see the request (clients included) may attach.
      const r = await getRequestAccess(tx, actor, data.requestId);
      projectId = r.request.projectId;
      sharedWithClient = true;
    } else {
      if (!projectId) throw validation({ projectId: 'Choose a project.' });
      const access = await getProjectAccess(tx, actor, projectId);
      if (!access.can('file.upload')) throw notFound('That project');
      assertWritable(access);
      if (sharedWithClient && !access.can('project.shareWithClient')) sharedWithClient = false;
      if (data.taskId) {
        const [t] = await tx.select().from(tasks).where(and(eq(tasks.id, data.taskId), eq(tasks.projectId, projectId), isNull(tasks.deletedAt)));
        if (!t) throw validation({ taskId: 'That task isn’t in this project.' });
        if (access.isClient && !t.sharedWithClient) throw notFound('That task');
      }
    }
    await assertQuota(tx, actor.orgId, upload.buffer.length);
    const stored = await storeUpload(upload);
    const [file] = await tx
      .insert(files)
      .values({
        orgId: actor.orgId,
        projectId,
        taskId: data.requestId ? null : (data.taskId ?? null),
        requestId: data.requestId ?? null,
        name: sanitizeFileName(data.name || stored.originalName),
        description: data.description ?? null,
        kind: data.kind,
        currentVersion: 1,
        sharedWithClient,
        createdBy: actor.userId,
      })
      .returning();
    const [version] = await tx
      .insert(fileVersions)
      .values({ orgId: actor.orgId, fileId: file!.id, version: 1, ...stored, uploadedBy: actor.userId })
      .returning();
    if (stored.mimeType.startsWith('image/')) {
      await tx.insert(outbox).values({ orgId: actor.orgId, type: 'file.preview', payload: { versionId: version!.id } });
    }
    await recordActivity(tx, actor, {
      projectId,
      verb: 'uploaded',
      entityType: 'file',
      entityId: file!.id,
      summary: data.kind === 'deliverable' ? `uploaded deliverable ${file!.name}` : `attached ${file!.name}`,
      clientVisible: sharedWithClient,
    });
    if (projectId) await publish(tx, actor.orgId, `project:${projectId}`, 'file.created', file!.id, { clientVisible: sharedWithClient, taskId: data.taskId ?? null });
    if (data.requestId) await publish(tx, actor.orgId, 'org', 'request.updated', data.requestId, { clientAccountId: null });
    return { file: file!, version: version! };
  });
}

/** Uploads a new version. For deliverables this reopens review on any approval of the old version. */
export async function uploadFileVersion(actor: Actor, input: unknown, upload: UploadInput) {
  const data = parse(z.object({ fileId: z.uuid(), note: z.string().trim().max(500).optional().nullable() }), input);
  return withTenant(actor.orgId, async (tx) => {
    const [file] = await tx.select().from(files).where(and(eq(files.id, data.fileId), isNull(files.deletedAt))).for('update');
    if (!file) throw notFound('That file');
    const fa = await getFileAccess(tx, actor, file);
    if (!fa.canUpload) throw notFound('That file');
    if (fa.project) assertWritable(fa.project);
    await assertQuota(tx, actor.orgId, upload.buffer.length);
    const stored = await storeUpload(upload);
    const next = file.currentVersion + 1;
    const [version] = await tx
      .insert(fileVersions)
      .values({ orgId: actor.orgId, fileId: file.id, version: next, ...stored, note: data.note ?? null, uploadedBy: actor.userId })
      .returning();
    await tx.update(files).set({ currentVersion: next, updatedAt: new Date() }).where(eq(files.id, file.id));
    if (stored.mimeType.startsWith('image/')) {
      await tx.insert(outbox).values({ orgId: actor.orgId, type: 'file.preview', payload: { versionId: version!.id } });
    }
    await recordActivity(tx, actor, {
      projectId: file.projectId,
      verb: 'versioned',
      entityType: 'file',
      entityId: file.id,
      summary: `uploaded version ${next} of ${file.name}`,
      clientVisible: file.sharedWithClient,
    });
    const reopened = await reopenApprovalsForFile(tx, actor, file, version!);
    if (file.projectId) await publish(tx, actor.orgId, `project:${file.projectId}`, 'file.updated', file.id, { clientVisible: file.sharedWithClient });
    return { file: { ...file, currentVersion: next }, version: version!, reopenedApprovals: reopened };
  });
}

const listSchema = z.object({
  projectId: z.uuid().optional(),
  taskId: z.uuid().optional(),
  requestId: z.uuid().optional(),
  kind: z.enum(['attachment', 'deliverable']).optional(),
  q: z.string().trim().max(100).optional(),
});

export async function listFiles(actor: Actor, input: unknown = {}) {
  const f = parse(listSchema, input);
  return withTenant(actor.orgId, async (tx) => {
    let isClient = actor.role === 'client';
    if (f.projectId) isClient = (await getProjectAccess(tx, actor, f.projectId)).isClient;
    const viaRequest = Boolean(f.requestId);
    if (f.requestId) await getRequestAccess(tx, actor, f.requestId);
    const rows = await tx
      .select({
        id: files.id,
        name: files.name,
        description: files.description,
        kind: files.kind,
        projectId: files.projectId,
        projectKey: projects.key,
        projectName: projects.name,
        taskId: files.taskId,
        requestId: files.requestId,
        sharedWithClient: files.sharedWithClient,
        currentVersion: files.currentVersion,
        updatedAt: files.updatedAt,
        versionId: fileVersions.id,
        mimeType: fileVersions.mimeType,
        sizeBytes: fileVersions.sizeBytes,
        hasPreview: sql<boolean>`${fileVersions.previewKey} is not null`,
        uploadedByName: users.name,
        approvalStatus: sql<string | null>`(select a.status from ${approvals} a where a.file_id = ${files.id} and a.status <> 'superseded' order by a.created_at desc limit 1)`,
      })
      .from(files)
      .leftJoin(projects, eq(projects.id, files.projectId))
      .innerJoin(fileVersions, and(eq(fileVersions.fileId, files.id), eq(fileVersions.version, files.currentVersion)))
      .leftJoin(users, eq(users.id, fileVersions.uploadedBy))
      .where(
        and(
          eq(files.orgId, actor.orgId),
          isNull(files.deletedAt),
          viaRequest ? undefined : visibleProjectsSql(actor),
          viaRequest ? undefined : isNull(files.requestId),
          isClient ? eq(files.sharedWithClient, true) : undefined,
          f.projectId ? eq(files.projectId, f.projectId) : undefined,
          f.taskId ? eq(files.taskId, f.taskId) : undefined,
          f.requestId ? eq(files.requestId, f.requestId) : undefined,
          f.kind ? eq(files.kind, f.kind) : undefined,
          f.q ? sql`${files.name} ilike ${'%' + f.q + '%'}` : undefined,
        ),
      )
      .orderBy(desc(files.updatedAt))
      .limit(300);
    return rows.map((r) => ({ ...r, previewable: PREVIEWABLE.has(r.mimeType) }));
  });
}

export async function getFile(actor: Actor, fileId: string) {
  return withTenant(actor.orgId, async (tx) => {
    const [file] = await tx.select().from(files).where(eq(files.id, fileId));
    if (!file || file.deletedAt) throw notFound('That file');
    const fa = await getFileAccess(tx, actor, file);
    const versions = await tx
      .select({ version: fileVersions, uploadedByName: users.name, uploadedByColor: users.avatarColor })
      .from(fileVersions)
      .leftJoin(users, eq(users.id, fileVersions.uploadedBy))
      .where(eq(fileVersions.fileId, file.id))
      .orderBy(desc(fileVersions.version));
    const fileApprovals = await tx
      .select({ id: approvals.id, title: approvals.title, status: approvals.status, round: approvals.round, fileVersionId: approvals.fileVersionId, createdAt: approvals.createdAt })
      .from(approvals)
      .where(eq(approvals.fileId, file.id))
      .orderBy(desc(approvals.createdAt));
    const [task] = file.taskId ? await tx.select({ id: tasks.id, number: tasks.number, title: tasks.title }).from(tasks).where(eq(tasks.id, file.taskId)) : [];
    const [request] = file.requestId ? await tx.select({ id: requests.id, number: requests.number, title: requests.title }).from(requests).where(eq(requests.id, file.requestId)) : [];
    return {
      file,
      project: fa.project ? { id: fa.project.project.id, key: fa.project.project.key, name: fa.project.project.name, portalEnabled: fa.project.project.portalEnabled, clientAccountId: fa.project.project.clientAccountId } : null,
      access: { isClient: fa.isClient, canUpload: fa.canUpload, canDelete: fa.canDelete, canShare: fa.canShare, canRequestApproval: Boolean(fa.project?.can('approval.create')) && file.kind === 'deliverable' },
      versions: versions.map((v) => ({ ...v.version, uploadedByName: v.uploadedByName, uploadedByColor: v.uploadedByColor, previewable: PREVIEWABLE.has(v.version.mimeType) })),
      approvals: fileApprovals,
      task: task ?? null,
      request: request ?? null,
    };
  });
}

/**
 * Resolves a file version for download after checking access. Used by the download route.
 * Returns NOT_FOUND for anything the actor can't see, so IDs can't be probed.
 */
export async function getDownload(actor: Actor, versionId: string, opts: { preview?: boolean } = {}) {
  return withTenant(actor.orgId, async (tx) => {
    const [row] = await tx
      .select({ version: fileVersions, file: files })
      .from(fileVersions)
      .innerJoin(files, eq(files.id, fileVersions.fileId))
      .where(eq(fileVersions.id, versionId));
    if (!row || row.file.deletedAt) throw notFound('That file');
    await getFileAccess(tx, actor, row.file);
    if (row.version.status === 'quarantined') throw notFound('That file');
    const key = opts.preview && row.version.previewKey ? row.version.previewKey : row.version.storageKey;
    const mimeType = opts.preview && row.version.previewKey ? 'image/webp' : row.version.mimeType;
    return { storageKey: key, mimeType, name: row.version.originalName, sizeBytes: row.version.sizeBytes, inline: PREVIEWABLE.has(mimeType), sha256: row.version.sha256 };
  });
}

export async function updateFile(actor: Actor, input: unknown) {
  const data = parse(z.object({ fileId: z.uuid(), name: z.string().trim().min(1).max(180).optional(), description: z.string().trim().max(1000).nullable().optional(), sharedWithClient: z.boolean().optional(), kind: z.enum(['attachment', 'deliverable']).optional() }), input);
  return withTenant(actor.orgId, async (tx) => {
    const [file] = await tx.select().from(files).where(and(eq(files.id, data.fileId), isNull(files.deletedAt)));
    if (!file) throw notFound('That file');
    const fa = await getFileAccess(tx, actor, file);
    if (!fa.canUpload || fa.isClient) throw notFound('That file');
    if (data.sharedWithClient !== undefined && data.sharedWithClient !== file.sharedWithClient) {
      if (!fa.canShare || !fa.project) throw validation({ sharedWithClient: 'Only project managers can change client sharing.' });
      if (data.sharedWithClient && !fa.project.project.clientAccountId) throw validation({ sharedWithClient: 'Link this project to a client first.' });
    }
    const [updated] = await tx
      .update(files)
      .set({
        name: data.name ? sanitizeFileName(data.name) : file.name,
        description: data.description !== undefined ? data.description : file.description,
        sharedWithClient: data.sharedWithClient ?? file.sharedWithClient,
        kind: data.kind ?? file.kind,
        updatedAt: new Date(),
      })
      .where(eq(files.id, file.id))
      .returning();
    if (data.sharedWithClient !== undefined && data.sharedWithClient !== file.sharedWithClient) {
      await recordActivity(tx, actor, {
        projectId: file.projectId,
        verb: data.sharedWithClient ? 'shared' : 'unshared',
        entityType: 'file',
        entityId: file.id,
        summary: data.sharedWithClient ? `shared ${file.name} with the client` : `stopped sharing ${file.name} with the client`,
        clientVisible: Boolean(data.sharedWithClient),
      });
    }
    if (file.projectId) await publish(tx, actor.orgId, `project:${file.projectId}`, 'file.updated', file.id, { clientVisible: true });
    return updated!;
  });
}

/** Soft delete; the worker purges bytes 30 days later unless restored. */
export async function setFileDeleted(actor: Actor, input: unknown) {
  const data = parse(z.object({ fileId: z.uuid(), deleted: z.boolean() }), input);
  return withTenant(actor.orgId, async (tx) => {
    const [file] = await tx.select().from(files).where(eq(files.id, data.fileId));
    if (!file) throw notFound('That file');
    const fa = await getFileAccess(tx, actor, file);
    if (!fa.canDelete) throw notFound('That file');
    await tx.update(files).set({ deletedAt: data.deleted ? new Date() : null, updatedAt: new Date() }).where(eq(files.id, file.id));
    if (data.deleted) {
      // Pending reviews of a deleted file can no longer be decided.
      await tx.update(approvals).set({ status: 'canceled', updatedAt: new Date() }).where(and(eq(approvals.fileId, file.id), eq(approvals.status, 'pending')));
    }
    await recordActivity(tx, actor, { projectId: file.projectId, verb: data.deleted ? 'deleted' : 'restored', entityType: 'file', entityId: file.id, summary: `${data.deleted ? 'deleted' : 'restored'} ${file.name}` });
    if (file.projectId) await publish(tx, actor.orgId, `project:${file.projectId}`, 'file.updated', file.id, { clientVisible: file.sharedWithClient });
  });
}

export async function storageUsage(actor: Actor) {
  return withTenant(actor.orgId, async (tx) => {
    const [org] = await tx.select({ quotaMb: organizations.storageQuotaMb }).from(organizations).where(eq(organizations.id, actor.orgId));
    const [{ used, count }] = (await tx
      .select({ used: sql<number>`coalesce(sum(${fileVersions.sizeBytes}), 0)::bigint`, count: sql<number>`count(*)::int` })
      .from(fileVersions)
      .where(eq(fileVersions.orgId, actor.orgId))) as [{ used: number; count: number }];
    return { usedBytes: Number(used), quotaBytes: (org?.quotaMb ?? 1024) * 1048576, versionCount: count };
  });
}

