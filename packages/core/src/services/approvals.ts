import { z } from 'zod';
import {
  and,
  approvalReviewers,
  approvals,
  desc,
  documentVersions,
  documents,
  eq,
  fileVersions,
  files,
  inArray,
  isNull,
  milestones,
  projects,
  sql,
  users,
  withTenant,
  type Tx,
} from '@orqivanta/db';
import { forbidden, notFound, precondition, validation } from '../errors';
import { notify, publish, recordActivity } from '../lib/events';
import { rateLimit } from '../lib/rate-limit';
import { parse, zOptionalDate } from '../lib/validate';
import type { Actor } from '../permissions';
import { assertItemVisible, getProjectAccess, visibleProjectsSql, type ProjectAccess } from './access';
import { recomputeApprovalStatus, type ReviewDecision } from './approvals-core';
import { snapshotDocument } from './documents';
import { userCanAccessProject } from './tasks';

export { evaluateApproval } from './approvals-core';

type ApprovalRow = typeof approvals.$inferSelect;

/** Is the approval's subject shared with the client? Client reviewers need this. */
async function subjectShared(tx: Tx, a: Pick<ApprovalRow, 'fileId' | 'documentId' | 'milestoneId'>) {
  if (a.fileId) return Boolean((await tx.select({ s: files.sharedWithClient }).from(files).where(eq(files.id, a.fileId)))[0]?.s);
  if (a.documentId) return Boolean((await tx.select({ s: documents.sharedWithClient }).from(documents).where(eq(documents.id, a.documentId)))[0]?.s);
  if (a.milestoneId) return Boolean((await tx.select({ s: milestones.sharedWithClient }).from(milestones).where(eq(milestones.id, a.milestoneId)))[0]?.s);
  return false;
}

export interface ApprovalAccess {
  approval: ApprovalRow;
  project: ProjectAccess;
  isReviewer: boolean;
  isClient: boolean;
}

/** Clients see an approval only if they are a reviewer on it, or its subject is shared with them. */
export async function getApprovalAccess(tx: Tx, actor: Actor, approvalId: string): Promise<ApprovalAccess> {
  const [approval] = await tx.select().from(approvals).where(eq(approvals.id, approvalId));
  if (!approval || approval.orgId !== actor.orgId) throw notFound('That approval');
  const project = await getProjectAccess(tx, actor, approval.projectId);
  const [rev] = await tx.select().from(approvalReviewers).where(and(eq(approvalReviewers.approvalId, approvalId), eq(approvalReviewers.userId, actor.userId)));
  if (project.isClient && !rev) assertItemVisible(project, await subjectShared(tx, approval), 'That approval');
  return { approval, project, isReviewer: Boolean(rev), isClient: project.isClient };
}

export const approvalHref = (orgSlug: string, id: string, client = false) => (client ? `/portal/${orgSlug}/approvals/${id}` : `/${orgSlug}/approvals/${id}`);

async function notifyReviewers(tx: Tx, actor: Actor, project: ProjectAccess['project'], approval: ApprovalRow, userIds: string[], title: string, body?: string) {
  const internal: string[] = [];
  const client: string[] = [];
  for (const id of userIds) {
    const role = await userCanAccessProject(tx, project, id);
    if (role === 'client') client.push(id);
    else if (role) internal.push(id);
  }
  await notify(tx, actor, { userIds: internal, category: 'approval', title, body, href: approvalHref(actor.orgSlug, approval.id), entityId: approval.id, dedupeKey: `approval:${approval.id}` });
  await notify(tx, actor, { userIds: client, category: 'approval', title, body, href: approvalHref(actor.orgSlug, approval.id, true), entityId: approval.id, dedupeKey: `approval:${approval.id}` });
}

const createSchema = z
  .object({
    projectId: z.uuid(),
    title: z.string().trim().min(1, 'Give the review a title.').max(200),
    instructions: z.string().trim().max(2000).optional().nullable(),
    fileId: z.uuid().optional(),
    fileVersionId: z.uuid().optional(),
    documentId: z.uuid().optional(),
    milestoneId: z.uuid().optional(),
    reviewerIds: z.array(z.uuid()).min(1, 'Choose at least one reviewer.').max(20),
    rule: z.enum(['any', 'all']).default('all'),
    dueDate: zOptionalDate,
  })
  .refine((d) => [d.fileId || d.fileVersionId, d.documentId, d.milestoneId].filter(Boolean).length === 1, {
    message: 'Choose exactly one thing to review.',
    path: ['subject'],
  });

/**
 * Requests a review of an exact version. For documents, the current content is frozen into
 * a version snapshot first, so later edits never change what the reviewers approved.
 */
export async function createApproval(actor: Actor, input: unknown) {
  const data = parse(createSchema, input);
  return withTenant(actor.orgId, async (tx) => {
    const access = await getProjectAccess(tx, actor, data.projectId);
    if (!access.can('approval.create')) throw notFound('That project');
    const subject: Partial<typeof approvals.$inferInsert> = {};
    let shared = false;
    let subjectLabel = '';
    if (data.fileId || data.fileVersionId) {
      const [row] = data.fileVersionId
        ? await tx.select({ v: fileVersions, f: files }).from(fileVersions).innerJoin(files, eq(files.id, fileVersions.fileId)).where(eq(fileVersions.id, data.fileVersionId))
        : await tx.select({ v: fileVersions, f: files }).from(files).innerJoin(fileVersions, and(eq(fileVersions.fileId, files.id), eq(fileVersions.version, files.currentVersion))).where(eq(files.id, data.fileId!));
      if (!row || row.f.projectId !== data.projectId || row.f.deletedAt) throw validation({ subject: 'That file isn’t in this project.' });
      subject.fileVersionId = row.v.id;
      subject.fileId = row.f.id;
      shared = row.f.sharedWithClient;
      subjectLabel = `${row.f.name} (v${row.v.version})`;
      const [open] = await tx.select({ id: approvals.id }).from(approvals).where(and(eq(approvals.fileVersionId, row.v.id), eq(approvals.status, 'pending')));
      if (open) throw validation({ subject: 'This version already has a review in progress.' });
    } else if (data.documentId) {
      const [doc] = await tx.select().from(documents).where(and(eq(documents.id, data.documentId), isNull(documents.deletedAt)));
      if (!doc || doc.projectId !== data.projectId) throw validation({ subject: 'That document isn’t in this project.' });
      const snap = await snapshotDocument(tx, actor, doc.id, 'Sent for review');
      subject.documentVersionId = snap.id;
      subject.documentId = doc.id;
      shared = doc.sharedWithClient;
      subjectLabel = `${doc.title} (v${snap.version})`;
    } else if (data.milestoneId) {
      const [m] = await tx.select().from(milestones).where(and(eq(milestones.id, data.milestoneId), eq(milestones.projectId, data.projectId)));
      if (!m) throw validation({ subject: 'That milestone isn’t in this project.' });
      subject.milestoneId = m.id;
      shared = m.sharedWithClient;
      subjectLabel = m.name;
    }

    const reviewerIds = [...new Set(data.reviewerIds)];
    for (const id of reviewerIds) {
      const role = await userCanAccessProject(tx, access.project, id);
      if (!role) throw validation({ reviewerIds: 'Every reviewer must be able to open this project.' });
      if (role === 'client' && !shared) throw validation({ reviewerIds: 'Share the item with the client before asking a client contact to review it.' });
    }

    const [approval] = await tx
      .insert(approvals)
      .values({ orgId: actor.orgId, projectId: data.projectId, title: data.title, instructions: data.instructions ?? null, rule: data.rule, dueDate: data.dueDate, createdBy: actor.userId, ...subject })
      .returning();
    await tx.insert(approvalReviewers).values(reviewerIds.map((userId) => ({ orgId: actor.orgId, approvalId: approval!.id, userId })));
    await recordActivity(tx, actor, {
      projectId: data.projectId,
      verb: 'requested_review',
      entityType: 'approval',
      entityId: approval!.id,
      summary: `requested approval of ${subjectLabel}`,
      clientVisible: shared,
    });
    await notifyReviewers(tx, actor, access.project, approval!, reviewerIds, `Review requested: ${data.title}`, `${subjectLabel} in ${access.project.name}${data.dueDate ? ` · due ${data.dueDate}` : ''}`);
    await publish(tx, actor.orgId, `project:${data.projectId}`, 'approval.created', approval!.id, { clientVisible: shared });
    return approval!;
  });
}

const decideSchema = z.object({
  approvalId: z.uuid(),
  decision: z.enum(['approved', 'changes_requested', 'rejected']),
  comment: z.string().trim().max(2000).optional().nullable(),
});

/** Records the actor's decision. Only assigned reviewers can decide, once, while pending. */
export async function decideApproval(actor: Actor, input: unknown) {
  const data = parse(decideSchema, input);
  if ((data.decision === 'changes_requested' || data.decision === 'rejected') && !data.comment) {
    throw validation({ comment: 'Explain what needs to change so the team can act on it.' });
  }
  return withTenant(actor.orgId, async (tx) => {
    const a = await getApprovalAccess(tx, actor, data.approvalId);
    if (!a.isReviewer) throw forbidden('Only the assigned reviewers can decide on this.');
    // Lock the approval row so concurrent decisions are evaluated one at a time.
    const [locked] = await tx.select().from(approvals).where(eq(approvals.id, a.approval.id)).for('update');
    if (locked!.status !== 'pending') throw precondition(locked!.status === 'superseded' ? 'A newer version was submitted. Review the latest round instead.' : 'This review is already closed.');
    const [mine] = await tx.select().from(approvalReviewers).where(and(eq(approvalReviewers.approvalId, a.approval.id), eq(approvalReviewers.userId, actor.userId)));
    if (mine?.decision) throw precondition('You already recorded a decision on this round.');
    await tx
      .update(approvalReviewers)
      .set({ decision: data.decision as ReviewDecision, comment: data.comment ?? null, decidedAt: new Date() })
      .where(and(eq(approvalReviewers.approvalId, a.approval.id), eq(approvalReviewers.userId, actor.userId)));
    const outcome = await recomputeApprovalStatus(tx, actor, a.approval.id);
    const [me] = await tx.select({ name: users.name }).from(users).where(eq(users.id, actor.userId));
    const verb = data.decision === 'approved' ? 'approved' : data.decision === 'rejected' ? 'rejected' : 'requested changes on';
    const shared = await subjectShared(tx, a.approval);
    await recordActivity(tx, actor, {
      projectId: a.approval.projectId,
      verb: data.decision,
      entityType: 'approval',
      entityId: a.approval.id,
      summary: `${verb} ${a.approval.title}`,
      data: { comment: data.comment ?? null },
      clientVisible: shared || a.isClient,
    });
    const reviewers = await tx.select({ userId: approvalReviewers.userId }).from(approvalReviewers).where(eq(approvalReviewers.approvalId, a.approval.id));
    const title =
      outcome && outcome !== 'pending'
        ? `${a.approval.title} was ${outcome === 'approved' ? 'approved' : outcome === 'rejected' ? 'rejected' : 'sent back for changes'}`
        : `${me?.name ?? 'A reviewer'} ${verb} ${a.approval.title}`;
    await notifyReviewers(tx, actor, a.project.project, a.approval, [a.approval.createdBy, ...reviewers.map((r) => r.userId)].filter((x): x is string => Boolean(x)), title, data.comment ?? undefined);
    await publish(tx, actor.orgId, `project:${a.approval.projectId}`, 'approval.updated', a.approval.id, { clientVisible: true });
    return { status: outcome };
  });
}

export async function cancelApproval(actor: Actor, input: unknown) {
  const { approvalId } = parse(z.object({ approvalId: z.uuid() }), input);
  return withTenant(actor.orgId, async (tx) => {
    const a = await getApprovalAccess(tx, actor, approvalId);
    if (!a.project.can('approval.cancel') && a.approval.createdBy !== actor.userId) throw forbidden();
    if (a.approval.status !== 'pending') throw precondition('Only pending reviews can be canceled.');
    await tx.update(approvals).set({ status: 'canceled', updatedAt: new Date(), version: a.approval.version + 1 }).where(eq(approvals.id, approvalId));
    await recordActivity(tx, actor, { projectId: a.approval.projectId, verb: 'canceled', entityType: 'approval', entityId: approvalId, summary: `canceled the review ${a.approval.title}` });
    await publish(tx, actor.orgId, `project:${a.approval.projectId}`, 'approval.updated', approvalId, { clientVisible: true });
  });
}

/** Sends a reminder to reviewers who haven't decided. Limited to once a day per approval. */
export async function remindReviewers(actor: Actor, input: unknown) {
  const { approvalId } = parse(z.object({ approvalId: z.uuid() }), input);
  await rateLimit(`approval-remind:${approvalId}`, 1, 86400);
  return withTenant(actor.orgId, async (tx) => {
    const a = await getApprovalAccess(tx, actor, approvalId);
    if (a.isClient || !a.project.can('approval.create')) throw forbidden();
    if (a.approval.status !== 'pending') throw precondition('This review is already closed.');
    const waiting = await tx.select({ userId: approvalReviewers.userId }).from(approvalReviewers).where(and(eq(approvalReviewers.approvalId, approvalId), isNull(approvalReviewers.decision)));
    await notifyReviewers(tx, actor, a.project.project, a.approval, waiting.map((w) => w.userId), `Reminder: ${a.approval.title} is waiting for your review`);
    await tx.update(approvals).set({ lastReminderAt: new Date() }).where(eq(approvals.id, approvalId));
    return { reminded: waiting.length };
  });
}

/** Replaces a reviewer who hasn't decided yet (e.g. they're away). */
export async function reassignReviewer(actor: Actor, input: unknown) {
  const data = parse(z.object({ approvalId: z.uuid(), fromUserId: z.uuid(), toUserId: z.uuid() }), input);
  return withTenant(actor.orgId, async (tx) => {
    const a = await getApprovalAccess(tx, actor, data.approvalId);
    if (a.isClient || !a.project.can('approval.create')) throw forbidden();
    if (a.approval.status !== 'pending') throw precondition('This review is already closed.');
    const [from] = await tx.select().from(approvalReviewers).where(and(eq(approvalReviewers.approvalId, data.approvalId), eq(approvalReviewers.userId, data.fromUserId)));
    if (!from) throw notFound('That reviewer');
    if (from.decision) throw precondition('That reviewer already decided.');
    const role = await userCanAccessProject(tx, a.project.project, data.toUserId);
    if (!role) throw validation({ toUserId: 'The new reviewer must be able to open this project.' });
    if (role === 'client' && !(await subjectShared(tx, a.approval))) throw validation({ toUserId: 'Share the item with the client first.' });
    await tx.delete(approvalReviewers).where(and(eq(approvalReviewers.approvalId, data.approvalId), eq(approvalReviewers.userId, data.fromUserId)));
    await tx.insert(approvalReviewers).values({ orgId: actor.orgId, approvalId: data.approvalId, userId: data.toUserId }).onConflictDoNothing();
    await recordActivity(tx, actor, { projectId: a.approval.projectId, verb: 'reassigned', entityType: 'approval', entityId: data.approvalId, summary: `reassigned a reviewer on ${a.approval.title}` });
    await notifyReviewers(tx, actor, a.project.project, a.approval, [data.toUserId], `Review requested: ${a.approval.title}`);
    await recomputeApprovalStatus(tx, actor, data.approvalId);
    await publish(tx, actor.orgId, `project:${a.approval.projectId}`, 'approval.updated', data.approvalId, { clientVisible: true });
  });
}

/**
 * A new file version materially changes a deliverable. Reviews of an older version that are
 * still open (pending, or sent back for changes) are marked superseded and a new round with
 * the same reviewers starts on the new version. Approved or rejected rounds stay as history;
 * the team can request a fresh review of the new version explicitly.
 */
export async function reopenApprovalsForFile(tx: Tx, actor: Actor, file: typeof files.$inferSelect, version: typeof fileVersions.$inferSelect) {
  if (!file.projectId) return 0;
  const open = await tx
    .select()
    .from(approvals)
    .where(and(eq(approvals.fileId, file.id), inArray(approvals.status, ['pending', 'changes_requested']), sql`${approvals.fileVersionId} <> ${version.id}`));
  const [project] = await tx.select().from(projects).where(eq(projects.id, file.projectId));
  let reopened = 0;
  for (const old of open) {
    const reviewers = await tx.select({ userId: approvalReviewers.userId }).from(approvalReviewers).where(eq(approvalReviewers.approvalId, old.id));
    await tx.update(approvals).set({ status: 'superseded', updatedAt: new Date(), version: old.version + 1 }).where(eq(approvals.id, old.id));
    const [next] = await tx
      .insert(approvals)
      .values({
        orgId: old.orgId,
        projectId: old.projectId,
        title: old.title,
        instructions: old.instructions,
        fileId: file.id,
        fileVersionId: version.id,
        rule: old.rule,
        dueDate: old.dueDate,
        previousId: old.id,
        round: old.round + 1,
        createdBy: actor.userId,
      })
      .returning();
    if (reviewers.length) await tx.insert(approvalReviewers).values(reviewers.map((r) => ({ orgId: old.orgId, approvalId: next!.id, userId: r.userId })));
    await recordActivity(tx, actor, {
      projectId: old.projectId,
      verb: 'reopened',
      entityType: 'approval',
      entityId: next!.id,
      summary: `submitted version ${version.version} of ${file.name} for review (round ${next!.round})`,
      clientVisible: file.sharedWithClient,
    });
    await notifyReviewers(tx, actor, project!, next!, reviewers.map((r) => r.userId), `New version to review: ${old.title}`, `${file.name} v${version.version}${version.note ? ` — ${version.note}` : ''}`);
    await publish(tx, actor.orgId, `project:${old.projectId}`, 'approval.created', next!.id, { clientVisible: file.sharedWithClient });
    reopened++;
  }
  return reopened;
}

const listSchema = z.object({
  projectId: z.uuid().optional(),
  view: z.enum(['awaiting_me', 'open', 'decided', 'all']).default('open'),
});

export async function listApprovals(actor: Actor, input: unknown = {}) {
  const f = parse(listSchema, input);
  return withTenant(actor.orgId, async (tx) => {
    if (f.projectId) await getProjectAccess(tx, actor, f.projectId);
    const isClient = actor.role === 'client';
    const rows = await tx
      .select({
        id: approvals.id,
        title: approvals.title,
        status: approvals.status,
        rule: approvals.rule,
        round: approvals.round,
        dueDate: approvals.dueDate,
        createdAt: approvals.createdAt,
        decidedAt: approvals.decidedAt,
        projectId: approvals.projectId,
        projectKey: projects.key,
        projectName: projects.name,
        fileId: approvals.fileId,
        documentId: approvals.documentId,
        milestoneId: approvals.milestoneId,
        subjectName: sql<string>`coalesce((select f.name || ' v' || fv.version from ${fileVersions} fv join ${files} f on f.id = fv.file_id where fv.id = ${approvals.fileVersionId}), (select dv.title || ' v' || dv.version from ${documentVersions} dv where dv.id = ${approvals.documentVersionId}), (select m.name from ${milestones} m where m.id = ${approvals.milestoneId}))`,
        reviewerCount: sql<number>`(select count(*)::int from ${approvalReviewers} r where r.approval_id = ${approvals.id})`,
        decidedCount: sql<number>`(select count(*)::int from ${approvalReviewers} r where r.approval_id = ${approvals.id} and r.decision is not null)`,
        myDecision: sql<string | null>`(select r.decision from ${approvalReviewers} r where r.approval_id = ${approvals.id} and r.user_id = ${actor.userId})`,
        amReviewer: sql<boolean>`exists (select 1 from ${approvalReviewers} r where r.approval_id = ${approvals.id} and r.user_id = ${actor.userId})`,
        createdByName: users.name,
      })
      .from(approvals)
      .innerJoin(projects, eq(projects.id, approvals.projectId))
      .leftJoin(users, eq(users.id, approvals.createdBy))
      .where(
        and(
          eq(approvals.orgId, actor.orgId),
          visibleProjectsSql(actor),
          f.projectId ? eq(approvals.projectId, f.projectId) : undefined,
          isClient
            ? sql`(exists (select 1 from ${approvalReviewers} r where r.approval_id = ${approvals.id} and r.user_id = ${actor.userId})
                or exists (select 1 from ${files} f where f.id = ${approvals.fileId} and f.shared_with_client)
                or exists (select 1 from ${documents} d where d.id = ${approvals.documentId} and d.shared_with_client)
                or exists (select 1 from ${milestones} m where m.id = ${approvals.milestoneId} and m.shared_with_client))`
            : undefined,
          f.view === 'awaiting_me'
            ? and(eq(approvals.status, 'pending'), sql`exists (select 1 from ${approvalReviewers} r where r.approval_id = ${approvals.id} and r.user_id = ${actor.userId} and r.decision is null)`)
            : f.view === 'open'
              ? eq(approvals.status, 'pending')
              : f.view === 'decided'
                ? inArray(approvals.status, ['approved', 'changes_requested', 'rejected'])
                : sql`${approvals.status} <> 'superseded'`,
        ),
      )
      .orderBy(sql`${approvals.dueDate} asc nulls last`, desc(approvals.createdAt))
      .limit(200);
    return rows;
  });
}

export async function getApproval(actor: Actor, approvalId: string) {
  return withTenant(actor.orgId, async (tx) => {
    const a = await getApprovalAccess(tx, actor, approvalId);
    const ap = a.approval;
    const reviewers = await tx
      .select({ userId: users.id, name: users.name, avatarColor: users.avatarColor, decision: approvalReviewers.decision, comment: approvalReviewers.comment, decidedAt: approvalReviewers.decidedAt })
      .from(approvalReviewers)
      .innerJoin(users, eq(users.id, approvalReviewers.userId))
      .where(eq(approvalReviewers.approvalId, ap.id));
    const [fileVersion] = ap.fileVersionId
      ? await tx.select({ v: fileVersions, f: files }).from(fileVersions).innerJoin(files, eq(files.id, fileVersions.fileId)).where(eq(fileVersions.id, ap.fileVersionId))
      : [];
    const [docVersion] = ap.documentVersionId ? await tx.select().from(documentVersions).where(eq(documentVersions.id, ap.documentVersionId)) : [];
    const [milestone] = ap.milestoneId ? await tx.select().from(milestones).where(eq(milestones.id, ap.milestoneId)) : [];
    // Earlier rounds of the same review chain, newest first.
    const rounds = await tx.execute<{ id: string; round: number; status: string; created_at: Date; file_version: number | null }>(sql`
      with recursive chain as (
        select id, previous_id, round, status, created_at, file_version_id from approvals where id = ${ap.previousId}
        union all
        select a.id, a.previous_id, a.round, a.status, a.created_at, a.file_version_id from approvals a join chain c on a.id = c.previous_id
      )
      select c.id, c.round, c.status, c.created_at, fv.version as file_version from chain c left join file_versions fv on fv.id = c.file_version_id order by c.round desc`);
    const [newer] = await tx.select({ id: approvals.id, round: approvals.round }).from(approvals).where(eq(approvals.previousId, ap.id));
    const [creator] = ap.createdBy ? await tx.select({ name: users.name }).from(users).where(eq(users.id, ap.createdBy)) : [];
    return {
      approval: ap,
      project: { id: a.project.project.id, key: a.project.project.key, name: a.project.project.name },
      access: { isClient: a.isClient, isReviewer: a.isReviewer, canDecide: a.isReviewer && ap.status === 'pending' && !reviewers.find((r) => r.userId === actor.userId)?.decision, canManage: !a.isClient && a.project.can('approval.create') },
      reviewers,
      file: fileVersion ? { id: fileVersion.f.id, name: fileVersion.f.name, versionId: fileVersion.v.id, version: fileVersion.v.version, latestVersion: fileVersion.f.currentVersion, mimeType: fileVersion.v.mimeType, sizeBytes: fileVersion.v.sizeBytes, note: fileVersion.v.note, hasPreview: Boolean(fileVersion.v.previewKey) } : null,
      document: docVersion ? { id: docVersion.documentId, versionId: docVersion.id, version: docVersion.version, title: docVersion.title, content: docVersion.content } : null,
      milestone: milestone ?? null,
      previousRounds: rounds.rows,
      newerRound: newer ?? null,
      createdByName: creator?.name ?? null,
    };
  });
}
