import { and, approvalReviewers, approvals, eq, inArray, projects, users, withTenant } from '@orqivanta/db';
import type { Actor } from '../permissions';
import { visibleProjectsSql } from './access';

/**
 * Reviewers and their decisions for a batch of approvals, for list views. Internal members
 * only, and only for approvals in projects the actor can see.
 */
export async function listReviewersFor(actor: Actor, approvalIds: string[]) {
  if (actor.role === 'client' || approvalIds.length === 0) return [];
  return withTenant(actor.orgId, (tx) =>
    tx
      .select({ approvalId: approvalReviewers.approvalId, userId: users.id, name: users.name, avatarColor: users.avatarColor, decision: approvalReviewers.decision, decidedAt: approvalReviewers.decidedAt })
      .from(approvalReviewers)
      .innerJoin(approvals, eq(approvals.id, approvalReviewers.approvalId))
      .innerJoin(projects, eq(projects.id, approvals.projectId))
      .innerJoin(users, eq(users.id, approvalReviewers.userId))
      .where(and(eq(approvals.orgId, actor.orgId), inArray(approvalReviewers.approvalId, approvalIds.slice(0, 300)), visibleProjectsSql(actor))),
  );
}
