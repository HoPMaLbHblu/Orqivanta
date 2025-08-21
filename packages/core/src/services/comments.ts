import { z } from 'zod';
import {
  and,
  approvalReviewers,
  asc,
  commentReactions,
  comments,
  eq,
  inArray,
  isNull,
  projects,
  taskWatchers,
  tasks,
  users,
  withTenant,
  type Tx,
} from '@orqivanta/db';
import { forbidden, notFound, validation } from '../errors';
import { notify, publish, recordActivity } from '../lib/events';
import { extractMentions, richTextToPlain, sanitizeRichText, truncate } from '../lib/richtext';
import { parse } from '../lib/validate';
import type { Actor } from '../permissions';
import { approvalHref, getApprovalAccess } from './approvals';
import { getDocAccess } from './documents';
import { clientContactIds } from './projects';
import { getRequestAccess, onRequestComment, requestHref } from './requests';
import { taskHref, taskRef, userCanAccessProject } from './tasks';
import { getProjectAccess, assertItemVisible } from './access';

export type CommentParent =
  | { type: 'task'; id: string }
  | { type: 'document'; id: string }
  | { type: 'request'; id: string }
  | { type: 'approval'; id: string };

interface ParentContext {
  isClient: boolean;
  /** Whether client-visible comments are possible here (item shared with a client). */
  clientThread: boolean;
  canInternal: boolean;
  canClient: boolean;
  projectId: string | null;
  title: string;
  internalHref: string;
  portalHref: string | null;
  /** People to notify about new comments (besides mentions). */
  followers: string[];
  clientAccountId: string | null;
  column: 'taskId' | 'documentId' | 'requestId' | 'approvalId';
}

async function resolveParent(tx: Tx, actor: Actor, parent: CommentParent): Promise<ParentContext> {
  switch (parent.type) {
    case 'task': {
      const [task] = await tx.select().from(tasks).where(and(eq(tasks.id, parent.id), isNull(tasks.deletedAt)));
      if (!task) throw notFound('That task');
      const access = await getProjectAccess(tx, actor, task.projectId);
      assertItemVisible(access, task.sharedWithClient, 'That task');
      const watchers = await tx.select({ userId: taskWatchers.userId }).from(taskWatchers).where(eq(taskWatchers.taskId, task.id));
      const clientThread = task.sharedWithClient && access.project.portalEnabled && Boolean(access.project.clientAccountId);
      return {
        isClient: access.isClient,
        clientThread,
        canInternal: access.can('comment.internal'),
        canClient: clientThread && access.can('comment.client'),
        projectId: task.projectId,
        title: `${taskRef(access.project.key, task.number)} ${truncate(task.title, 60)}`,
        internalHref: taskHref(actor.orgSlug, access.project.key, task.number),
        portalHref: `/portal/${actor.orgSlug}/projects/${access.project.key}?task=${task.number}`,
        followers: watchers.map((w) => w.userId),
        clientAccountId: access.project.clientAccountId,
        column: 'taskId',
      };
    }
    case 'document': {
      const a = await getDocAccess(tx, actor, parent.id);
      const clientThread = a.doc.sharedWithClient && Boolean(a.project?.project.portalEnabled);
      return {
        isClient: a.isClient,
        clientThread,
        canInternal: !a.isClient,
        canClient: clientThread && (a.isClient || Boolean(a.project?.can('comment.client'))),
        projectId: a.doc.projectId,
        title: truncate(a.doc.title, 80),
        internalHref: `/${actor.orgSlug}/documents/${a.doc.id}`,
        portalHref: `/portal/${actor.orgSlug}/documents/${a.doc.id}`,
        followers: [a.doc.createdBy, a.doc.updatedBy].filter((x): x is string => Boolean(x)),
        clientAccountId: a.project?.project.clientAccountId ?? null,
        column: 'documentId',
      };
    }
    case 'request': {
      const a = await getRequestAccess(tx, actor, parent.id);
      const r = a.request;
      return {
        isClient: a.isClient,
        clientThread: Boolean(r.clientAccountId),
        canInternal: !a.isClient,
        canClient: Boolean(r.clientAccountId),
        projectId: r.projectId,
        title: `request #${r.number} ${truncate(r.title, 60)}`,
        internalHref: requestHref(actor.orgSlug, r.number),
        portalHref: requestHref(actor.orgSlug, r.number, true),
        followers: [r.ownerId, r.submittedBy].filter((x): x is string => Boolean(x)),
        clientAccountId: r.clientAccountId,
        column: 'requestId',
      };
    }
    case 'approval': {
      const a = await getApprovalAccess(tx, actor, parent.id);
      const reviewers = await tx.select({ userId: approvalReviewers.userId }).from(approvalReviewers).where(eq(approvalReviewers.approvalId, parent.id));
      const [p] = await tx.select().from(projects).where(eq(projects.id, a.approval.projectId));
      const clientReviewers: string[] = [];
      for (const r of reviewers) if ((await userCanAccessProject(tx, p!, r.userId)) === 'client') clientReviewers.push(r.userId);
      const clientThread = clientReviewers.length > 0 || a.isClient;
      return {
        isClient: a.isClient,
        clientThread,
        canInternal: !a.isClient,
        canClient: clientThread,
        projectId: a.approval.projectId,
        title: truncate(a.approval.title, 80),
        internalHref: approvalHref(actor.orgSlug, a.approval.id),
        portalHref: approvalHref(actor.orgSlug, a.approval.id, true),
        followers: [a.approval.createdBy, ...reviewers.map((r) => r.userId)].filter((x): x is string => Boolean(x)),
        clientAccountId: p!.clientAccountId,
        column: 'approvalId',
      };
    }
  }
}

const parentSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('task'), id: z.uuid() }),
  z.object({ type: z.literal('document'), id: z.uuid() }),
  z.object({ type: z.literal('request'), id: z.uuid() }),
  z.object({ type: z.literal('approval'), id: z.uuid() }),
]);

export async function listComments(actor: Actor, parentInput: unknown) {
  const parent = parse(parentSchema, parentInput);
  return withTenant(actor.orgId, async (tx) => {
    const ctx = await resolveParent(tx, actor, parent);
    const col = comments[ctx.column];
    const rows = await tx
      .select({
        id: comments.id,
        parentId: comments.parentId,
        authorId: comments.authorId,
        authorName: users.name,
        authorColor: users.avatarColor,
        body: comments.body,
        visibility: comments.visibility,
        resolvedAt: comments.resolvedAt,
        editedAt: comments.editedAt,
        deletedAt: comments.deletedAt,
        createdAt: comments.createdAt,
      })
      .from(comments)
      .leftJoin(users, eq(users.id, comments.authorId))
      .where(and(eq(col, parent.id), ctx.isClient ? eq(comments.visibility, 'client') : undefined))
      .orderBy(asc(comments.createdAt));
    const ids = rows.map((r) => r.id);
    const reactions = ids.length
      ? await tx.select({ commentId: commentReactions.commentId, emoji: commentReactions.emoji, userId: commentReactions.userId }).from(commentReactions).where(inArray(commentReactions.commentId, ids))
      : [];
    const authorRoles = new Map<string, 'client' | 'internal'>();
    if (ctx.clientAccountId) {
      const contacts = await clientContactIds(tx, ctx.clientAccountId);
      contacts.forEach((c) => authorRoles.set(c, 'client'));
    }
    return {
      comments: rows.map((r) => ({
        ...r,
        // Deleted comments keep their place in the thread but lose their content.
        body: r.deletedAt ? null : r.body,
        authorIsClient: r.authorId ? authorRoles.get(r.authorId) === 'client' : false,
        reactions: Object.entries(
          reactions
            .filter((x) => x.commentId === r.id)
            .reduce<Record<string, string[]>>((acc, x) => ((acc[x.emoji] ??= []).push(x.userId), acc), {}),
        ).map(([emoji, userIds]) => ({ emoji, count: userIds.length, mine: userIds.includes(actor.userId) })),
      })),
      context: { isClient: ctx.isClient, clientThread: ctx.clientThread, canInternal: ctx.canInternal, canClient: ctx.canClient },
    };
  });
}

const createSchema = z.object({
  parent: parentSchema,
  body: z.unknown(),
  visibility: z.enum(['internal', 'client']).default('internal'),
  replyToId: z.uuid().nullable().optional(),
});

/**
 * Posts a comment. Clients can only post client-visible comments; internal users choose.
 * Mentions notify only people who can see the comment (a client never gets a mention
 * from an internal comment).
 */
export async function createComment(actor: Actor, input: unknown) {
  const data = parse(createSchema, input);
  return withTenant(actor.orgId, async (tx) => {
    const ctx = await resolveParent(tx, actor, data.parent);
    const visibility = ctx.isClient ? 'client' : data.visibility;
    if (visibility === 'client' && !ctx.canClient) throw validation({ visibility: 'This item isn’t shared with a client, so the comment must stay internal.' });
    if (visibility === 'internal' && !ctx.canInternal) throw forbidden('You can’t comment here.');
    const body = sanitizeRichText(data.body);
    const text = richTextToPlain(body);
    if (!text.trim()) throw validation({ body: 'Write a comment first.' });
    if (text.length > 10000) throw validation({ body: 'Keep comments under 10,000 characters.' });
    if (data.replyToId) {
      const [p] = await tx.select().from(comments).where(eq(comments.id, data.replyToId));
      if (!p || p[ctx.column] !== data.parent.id) throw validation({ replyToId: 'You can only reply within the same thread.' });
      if (ctx.isClient && p.visibility !== 'client') throw notFound('That comment');
    }
    const mentions = extractMentions(body);
    const [comment] = await tx
      .insert(comments)
      .values({ orgId: actor.orgId, [ctx.column]: data.parent.id, parentId: data.replyToId ?? null, authorId: actor.userId, body, bodyText: text, visibility, mentions })
      .returning();

    const clientIds = ctx.clientAccountId ? await clientContactIds(tx, ctx.clientAccountId) : [];
    const canSee = async (userId: string) => {
      const isClientUser = clientIds.includes(userId);
      if (isClientUser) return visibility === 'client';
      if (ctx.projectId) {
        const [p] = await tx.select().from(projects).where(eq(projects.id, ctx.projectId));
        const role = p ? await userCanAccessProject(tx, p, userId) : null;
        if (ctx.column === 'requestId') return true;
        return Boolean(role);
      }
      return true;
    };
    const mentioned: string[] = [];
    for (const id of mentions) if (await canSee(id)) mentioned.push(id);
    const split = (ids: string[]) => ({ internal: ids.filter((i) => !clientIds.includes(i)), client: ids.filter((i) => clientIds.includes(i)) });
    const m = split(mentioned);
    const snippet = truncate(text, 160);
    await notify(tx, actor, { userIds: m.internal, category: 'mention', title: `Mentioned in ${ctx.title}`, body: snippet, href: ctx.internalHref, entityId: comment!.id });
    if (ctx.portalHref) await notify(tx, actor, { userIds: m.client, category: 'mention', title: `Mentioned in ${ctx.title}`, body: snippet, href: ctx.portalHref, entityId: comment!.id });

    const followers = ctx.followers.filter((f) => !mentioned.includes(f));
    const visibleFollowers: string[] = [];
    for (const f of followers) if (await canSee(f)) visibleFollowers.push(f);
    const fl = split(visibleFollowers);
    await notify(tx, actor, { userIds: fl.internal, category: 'comment', title: `New comment on ${ctx.title}`, body: snippet, href: ctx.internalHref, entityId: data.parent.id, dedupeKey: `comments:${data.parent.id}` });
    if (ctx.portalHref) await notify(tx, actor, { userIds: fl.client, category: 'comment', title: `New comment on ${ctx.title}`, body: snippet, href: ctx.portalHref, entityId: data.parent.id, dedupeKey: `comments:${data.parent.id}` });
    // A client's comment on a request reaches the triage owner even if nobody follows it.
    if (ctx.column === 'requestId') await onRequestComment(tx, actor, data.parent.id, visibility);

    if (data.parent.type === 'task' && !ctx.isClient) {
      await tx.insert(taskWatchers).values({ orgId: actor.orgId, taskId: data.parent.id, userId: actor.userId }).onConflictDoNothing();
    }
    await recordActivity(tx, actor, {
      projectId: ctx.projectId,
      verb: 'commented',
      entityType: data.parent.type,
      entityId: data.parent.id,
      summary: `commented on ${ctx.title}`,
      clientVisible: visibility === 'client',
    });
    const channel = ctx.projectId ? (`project:${ctx.projectId}` as const) : ('org' as const);
    await publish(tx, actor.orgId, channel, 'comment.created', data.parent.id, { parentType: data.parent.type, clientVisible: visibility === 'client', clientAccountId: ctx.clientAccountId });
    return comment!;
  });
}

async function loadOwnComment(tx: Tx, actor: Actor, commentId: string) {
  const [c] = await tx.select().from(comments).where(eq(comments.id, commentId));
  if (!c || c.deletedAt) throw notFound('That comment');
  const parent: CommentParent = c.taskId
    ? { type: 'task', id: c.taskId }
    : c.documentId
      ? { type: 'document', id: c.documentId }
      : c.requestId
        ? { type: 'request', id: c.requestId }
        : { type: 'approval', id: c.approvalId! };
  const ctx = await resolveParent(tx, actor, parent);
  if (ctx.isClient && c.visibility !== 'client') throw notFound('That comment');
  return { c, ctx, parent };
}

export async function editComment(actor: Actor, input: unknown) {
  const data = parse(z.object({ commentId: z.uuid(), body: z.unknown() }), input);
  return withTenant(actor.orgId, async (tx) => {
    const { c, ctx } = await loadOwnComment(tx, actor, data.commentId);
    if (c.authorId !== actor.userId) throw forbidden('You can only edit your own comments.');
    const body = sanitizeRichText(data.body);
    const text = richTextToPlain(body);
    if (!text.trim()) throw validation({ body: 'A comment can’t be empty. Delete it instead.' });
    await tx.update(comments).set({ body, bodyText: text, editedAt: new Date(), mentions: extractMentions(body) }).where(eq(comments.id, c.id));
    await publish(tx, actor.orgId, ctx.projectId ? `project:${ctx.projectId}` : 'org', 'comment.updated', c.id, { clientVisible: c.visibility === 'client' });
  });
}

export async function deleteComment(actor: Actor, input: unknown) {
  const { commentId } = parse(z.object({ commentId: z.uuid() }), input);
  return withTenant(actor.orgId, async (tx) => {
    const { c, ctx } = await loadOwnComment(tx, actor, commentId);
    const isAdmin = actor.role === 'owner' || actor.role === 'admin';
    if (c.authorId !== actor.userId && !isAdmin) throw forbidden('You can only delete your own comments.');
    await tx.update(comments).set({ deletedAt: new Date() }).where(eq(comments.id, c.id));
    await publish(tx, actor.orgId, ctx.projectId ? `project:${ctx.projectId}` : 'org', 'comment.updated', c.id, { clientVisible: c.visibility === 'client' });
  });
}

export async function setCommentResolved(actor: Actor, input: unknown) {
  const data = parse(z.object({ commentId: z.uuid(), resolved: z.boolean() }), input);
  return withTenant(actor.orgId, async (tx) => {
    const { c, ctx } = await loadOwnComment(tx, actor, data.commentId);
    if (ctx.isClient && c.authorId !== actor.userId) throw forbidden();
    await tx.update(comments).set({ resolvedAt: data.resolved ? new Date() : null }).where(eq(comments.id, c.id));
    await publish(tx, actor.orgId, ctx.projectId ? `project:${ctx.projectId}` : 'org', 'comment.updated', c.id, { clientVisible: c.visibility === 'client' });
  });
}

const EMOJI = ['👍', '🎉', '❤️', '👀', '✅', '😄'];
export const REACTION_EMOJI = EMOJI;

export async function toggleReaction(actor: Actor, input: unknown) {
  const data = parse(z.object({ commentId: z.uuid(), emoji: z.enum(EMOJI as [string, ...string[]]) }), input);
  return withTenant(actor.orgId, async (tx) => {
    const { c, ctx } = await loadOwnComment(tx, actor, data.commentId);
    const [existing] = await tx.select().from(commentReactions).where(and(eq(commentReactions.commentId, c.id), eq(commentReactions.userId, actor.userId), eq(commentReactions.emoji, data.emoji)));
    if (existing) await tx.delete(commentReactions).where(and(eq(commentReactions.commentId, c.id), eq(commentReactions.userId, actor.userId), eq(commentReactions.emoji, data.emoji)));
    else await tx.insert(commentReactions).values({ orgId: actor.orgId, commentId: c.id, userId: actor.userId, emoji: data.emoji });
    await publish(tx, actor.orgId, ctx.projectId ? `project:${ctx.projectId}` : 'org', 'comment.updated', c.id, { clientVisible: c.visibility === 'client' });
  });
}

