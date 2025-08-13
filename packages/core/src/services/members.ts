import { z } from 'zod';
import {
  and,
  approvalReviewers,
  asc,
  clientAccounts,
  eq,
  inArray,
  isNull,
  memberships,
  ne,
  projectMembers,
  projectStatuses,
  sessions,
  sql,
  taskWatchers,
  tasks,
  teamMembers,
  users,
  withTenant,
} from '@orqivanta/db';
import { forbidden, notFound, validation } from '../errors';
import { audit, notify, publish } from '../lib/events';
import { parse } from '../lib/validate';
import { assignableRoles, ROLE_LABELS, type Actor, type OrgRole } from '../permissions';
import { assertOrg } from './context';
import { recomputeApprovalStatus } from './approvals-core';

export async function listMembers(actor: Actor, opts: { includeClients?: boolean } = {}) {
  assertOrg(actor, 'members.view');
  return withTenant(actor.orgId, (tx) =>
    tx
      .select({
        membershipId: memberships.id,
        userId: users.id,
        name: users.name,
        email: users.email,
        avatarColor: users.avatarColor,
        role: memberships.role,
        status: memberships.status,
        title: memberships.title,
        clientAccountId: memberships.clientAccountId,
        clientName: clientAccounts.name,
        joinedAt: memberships.createdAt,
        lastSeenAt: sql<Date | null>`(select max(${sessions.lastSeenAt}) from ${sessions} where ${sessions.userId} = ${users.id})`,
      })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .leftJoin(clientAccounts, eq(clientAccounts.id, memberships.clientAccountId))
      .where(
        and(
          eq(memberships.orgId, actor.orgId),
          opts.includeClients ? undefined : ne(memberships.role, 'client'),
        ),
      )
      .orderBy(asc(users.name)),
  );
}

/** Lightweight list for pickers (assignees, reviewers, mentions). */
export async function listPeople(actor: Actor) {
  return withTenant(actor.orgId, (tx) =>
    tx
      .select({ id: users.id, name: users.name, email: users.email, avatarColor: users.avatarColor, role: memberships.role, clientAccountId: memberships.clientAccountId })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .where(and(eq(memberships.orgId, actor.orgId), eq(memberships.status, 'active')))
      .orderBy(asc(users.name)),
  );
}

async function loadTarget(actor: Actor, membershipId: string) {
  return withTenant(actor.orgId, async (tx) => {
    const [m] = await tx.select().from(memberships).where(eq(memberships.id, membershipId));
    if (!m) throw notFound('That member');
    return m;
  });
}

function assertCanManage(actor: Actor, target: { role: OrgRole; userId: string }) {
  assertOrg(actor, 'members.manage');
  if (target.role === 'owner') throw forbidden('The owner’s membership can only change through an ownership transfer.');
  if (target.role === 'admin' && actor.role !== 'owner') throw forbidden('Only the owner can change an admin.');
}

const roleSchema = z.object({ membershipId: z.uuid(), role: z.enum(['admin', 'member', 'client']), clientAccountId: z.uuid().optional() });

export async function changeMemberRole(actor: Actor, input: unknown) {
  const data = parse(roleSchema, input);
  const target = await loadTarget(actor, data.membershipId);
  assertCanManage(actor, target);
  if (!assignableRoles(actor.role).includes(data.role)) throw forbidden('You can’t assign that role.');
  if (data.role === 'client' && !data.clientAccountId) throw validation({ clientAccountId: 'Choose the client this contact belongs to.' });
  await withTenant(actor.orgId, async (tx) => {
    await tx
      .update(memberships)
      .set({ role: data.role, clientAccountId: data.role === 'client' ? data.clientAccountId! : null, updatedAt: new Date() })
      .where(eq(memberships.id, target.id));
    if (data.role === 'client') {
      // A client contact keeps no internal project roles or team memberships.
      await tx.delete(projectMembers).where(eq(projectMembers.userId, target.userId));
      await tx.delete(teamMembers).where(eq(teamMembers.userId, target.userId));
    }
    await audit(tx, actor, 'member.role_changed', { type: 'user', id: target.userId, metadata: { from: target.role, to: data.role } });
    await publish(tx, actor.orgId, `user:${target.userId}`, 'access.changed', null);
    await notify(tx, actor, {
      userIds: [target.userId],
      category: 'membership',
      title: `Your role is now ${ROLE_LABELS[data.role]}`,
      href: `/${actor.orgSlug}/home`,
    });
  });
}

export async function setMemberSuspended(actor: Actor, input: unknown) {
  const data = parse(z.object({ membershipId: z.uuid(), suspended: z.boolean() }), input);
  const target = await loadTarget(actor, data.membershipId);
  assertCanManage(actor, target);
  if (target.userId === actor.userId) throw forbidden('You can’t suspend yourself.');
  await withTenant(actor.orgId, async (tx) => {
    await tx
      .update(memberships)
      .set({ status: data.suspended ? 'suspended' : 'active', updatedAt: new Date() })
      .where(eq(memberships.id, target.id));
    await audit(tx, actor, data.suspended ? 'member.suspended' : 'member.reactivated', { type: 'user', id: target.userId });
    await publish(tx, actor.orgId, `user:${target.userId}`, 'access.changed', null);
  });
}

/**
 * Removes a member. Their open tasks become unassigned (recorded in task history),
 * their watches, project roles and team memberships end, and pending approvals they
 * were reviewing are re-evaluated without them. Comments and history stay.
 */
export async function removeMember(actor: Actor, input: unknown) {
  const data = parse(z.object({ membershipId: z.uuid() }), input);
  const target = await loadTarget(actor, data.membershipId);
  if (target.userId === actor.userId) {
    if (target.role === 'owner') throw forbidden('Transfer ownership before leaving the organization.');
  } else {
    assertCanManage(actor, target);
  }
  return withTenant(actor.orgId, async (tx) => {
    const openTasks = await tx
      .select({ id: tasks.id })
      .from(tasks)
      .innerJoin(projectStatuses, eq(projectStatuses.id, tasks.statusId))
      .where(
        and(
          eq(tasks.orgId, actor.orgId),
          eq(tasks.assigneeId, target.userId),
          isNull(tasks.deletedAt),
          sql`${projectStatuses.category} not in ('completed','canceled')`,
        ),
      );
    if (openTasks.length) {
      await tx.update(tasks).set({ assigneeId: null, updatedAt: new Date(), version: sql`${tasks.version} + 1` }).where(inArray(tasks.id, openTasks.map((t) => t.id)));
    }
    await tx.delete(taskWatchers).where(eq(taskWatchers.userId, target.userId));
    await tx.delete(projectMembers).where(eq(projectMembers.userId, target.userId));
    await tx.delete(teamMembers).where(eq(teamMembers.userId, target.userId));
    const pending = await tx
      .select({ approvalId: approvalReviewers.approvalId })
      .from(approvalReviewers)
      .where(and(eq(approvalReviewers.userId, target.userId), isNull(approvalReviewers.decision)));
    await tx
      .delete(approvalReviewers)
      .where(and(eq(approvalReviewers.userId, target.userId), isNull(approvalReviewers.decision)));
    for (const p of pending) await recomputeApprovalStatus(tx, actor, p.approvalId);
    await tx.delete(memberships).where(eq(memberships.id, target.id));
    await audit(tx, actor, target.userId === actor.userId ? 'member.left' : 'member.removed', {
      type: 'user',
      id: target.userId,
      metadata: { role: target.role, unassignedTasks: openTasks.length },
    });
    await publish(tx, actor.orgId, `user:${target.userId}`, 'access.changed', null);
    return { unassignedTasks: openTasks.length };
  });
}

export async function updateMemberTitle(actor: Actor, input: unknown) {
  const data = parse(z.object({ membershipId: z.uuid(), title: z.string().trim().max(60) }), input);
  const target = await loadTarget(actor, data.membershipId);
  if (target.userId !== actor.userId) assertOrg(actor, 'members.manage');
  await withTenant(actor.orgId, (tx) =>
    tx.update(memberships).set({ title: data.title || null }).where(eq(memberships.id, target.id)),
  );
}
