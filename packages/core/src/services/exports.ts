import { gzipSync } from 'node:zlib';
import {
  and,
  approvalReviewers,
  approvals,
  clientAccounts,
  comments,
  dataExports,
  desc,
  documents,
  eq,
  fileVersions,
  files,
  memberships,
  milestones,
  organizations,
  outbox,
  projectMembers,
  projectStatuses,
  projects,
  requestForms,
  requests,
  tasks,
  teams,
  users,
  withSystem,
  withTenant,
} from '@orqivanta/db';
import { notFound, precondition } from '../errors';
import { audit, notify } from '../lib/events';
import { rateLimit } from '../lib/rate-limit';
import type { Actor } from '../permissions';
import { newStorageKey, storage } from '../storage';
import { assertOrg } from './context';

/** Queues a full organization export. The worker builds it outside the request. */
export async function requestOrgExport(actor: Actor) {
  assertOrg(actor, 'org.export');
  await rateLimit(`org-export:${actor.orgId}`, 3, 86400);
  return withTenant(actor.orgId, async (tx) => {
    const [job] = await tx.insert(dataExports).values({ orgId: actor.orgId, requestedBy: actor.userId }).returning();
    await tx.insert(outbox).values({ orgId: actor.orgId, type: 'org.export', payload: { exportId: job!.id } });
    await audit(tx, actor, 'org.export_requested', { type: 'export', id: job!.id });
    return job!;
  });
}

export async function listExports(actor: Actor) {
  assertOrg(actor, 'org.export');
  return withTenant(actor.orgId, (tx) =>
    tx
      .select({ id: dataExports.id, status: dataExports.status, sizeBytes: dataExports.sizeBytes, error: dataExports.error, createdAt: dataExports.createdAt, completedAt: dataExports.completedAt, requestedByName: users.name })
      .from(dataExports)
      .leftJoin(users, eq(users.id, dataExports.requestedBy))
      .where(eq(dataExports.orgId, actor.orgId))
      .orderBy(desc(dataExports.createdAt))
      .limit(10),
  );
}

export async function getExportDownload(actor: Actor, exportId: string) {
  assertOrg(actor, 'org.export');
  const [job] = await withTenant(actor.orgId, (tx) => tx.select().from(dataExports).where(and(eq(dataExports.id, exportId), eq(dataExports.orgId, actor.orgId))));
  if (!job || job.status !== 'ready' || !job.storageKey) throw notFound('That export');
  if (Date.now() - (job.completedAt?.getTime() ?? 0) > 7 * 86400_000) throw precondition('This export has expired. Request a new one.');
  return { storageKey: job.storageKey, name: `orqivanta-export-${job.createdAt.toISOString().slice(0, 10)}.json.gz` };
}

/** Worker: builds the export as gzipped JSON. File bytes are listed by metadata, not embedded. */
export async function buildOrgExport(exportId: string) {
  const [job] = await withSystem((tx) => tx.select().from(dataExports).where(eq(dataExports.id, exportId)));
  if (!job || job.status !== 'queued') return;
  const orgId = job.orgId;
  try {
    const data = await withTenant(orgId, async (tx) => {
      const [org] = await tx.select().from(organizations).where(eq(organizations.id, orgId));
      const people = await tx
        .select({ id: users.id, name: users.name, email: users.email, role: memberships.role, status: memberships.status, clientAccountId: memberships.clientAccountId })
        .from(memberships)
        .innerJoin(users, eq(users.id, memberships.userId))
        .where(eq(memberships.orgId, orgId));
      return {
        format: 'orqivanta-export',
        version: 1,
        exportedAt: new Date().toISOString(),
        organization: { id: org!.id, name: org!.name, slug: org!.slug, createdAt: org!.createdAt },
        members: people,
        teams: await tx.select().from(teams).where(eq(teams.orgId, orgId)),
        clients: await tx.select().from(clientAccounts).where(eq(clientAccounts.orgId, orgId)),
        projects: await tx.select().from(projects).where(eq(projects.orgId, orgId)),
        projectMembers: await tx.select().from(projectMembers).where(eq(projectMembers.orgId, orgId)),
        statuses: await tx.select().from(projectStatuses).where(eq(projectStatuses.orgId, orgId)),
        milestones: await tx.select().from(milestones).where(eq(milestones.orgId, orgId)),
        tasks: (await tx.select().from(tasks).where(eq(tasks.orgId, orgId))).map(({ search: _s, ...t }) => t),
        documents: (await tx.select().from(documents).where(eq(documents.orgId, orgId))).map(({ search: _s, ...d }) => d),
        files: (await tx.select().from(files).where(eq(files.orgId, orgId))).map(({ search: _s, ...f }) => f),
        fileVersions: (await tx.select().from(fileVersions).where(eq(fileVersions.orgId, orgId))).map(({ storageKey: _k, previewKey: _p, ...v }) => v),
        requestForms: await tx.select().from(requestForms).where(eq(requestForms.orgId, orgId)),
        requests: (await tx.select().from(requests).where(eq(requests.orgId, orgId))).map(({ search: _s, ...r }) => r),
        approvals: await tx.select().from(approvals).where(eq(approvals.orgId, orgId)),
        approvalReviewers: await tx.select().from(approvalReviewers).where(eq(approvalReviewers.orgId, orgId)),
        comments: await tx.select().from(comments).where(eq(comments.orgId, orgId)),
      };
    });
    const buf = gzipSync(Buffer.from(JSON.stringify(data)));
    const key = newStorageKey('x');
    await storage.put(key, buf);
    await withTenant(orgId, async (tx) => {
      await tx.update(dataExports).set({ status: 'ready', storageKey: key, sizeBytes: buf.length, completedAt: new Date() }).where(eq(dataExports.id, exportId));
      const [org] = await tx.select({ slug: organizations.slug }).from(organizations).where(eq(organizations.id, orgId));
      if (job.requestedBy) {
        await notify(tx, { orgId, userId: '' }, {
          userIds: [job.requestedBy],
          category: 'membership',
          title: 'Your data export is ready',
          body: 'Download it from Settings → Data export within 7 days.',
          href: `/${org!.slug}/settings/export`,
        });
      }
    });
  } catch (err) {
    await withTenant(orgId, (tx) => tx.update(dataExports).set({ status: 'failed', error: err instanceof Error ? err.message : 'Export failed', completedAt: new Date() }).where(eq(dataExports.id, exportId)));
    throw err;
  }
}
