import { approvalReviewers, approvals, eq, type Tx } from '@orqivanta/db';
import type { Actor } from '../permissions';
import { publish } from '../lib/events';

export type ReviewDecision = 'approved' | 'changes_requested' | 'rejected';
export type ApprovalOutcome = 'pending' | 'approved' | 'changes_requested' | 'rejected';

/**
 * The approval rule, as a pure function:
 * - "all": every reviewer must approve. One rejection rejects; one change request
 *   sends it back. Otherwise it stays pending until everyone has approved.
 * - "any": the first approval approves. If everyone has decided without approving,
 *   a change request outranks a rejection.
 * With no reviewers left (for example after someone was removed), it stays pending.
 */
export function evaluateApproval(rule: 'any' | 'all', decisions: (ReviewDecision | null)[]): ApprovalOutcome {
  if (decisions.length === 0) return 'pending';
  if (rule === 'all') {
    if (decisions.includes('rejected')) return 'rejected';
    if (decisions.includes('changes_requested')) return 'changes_requested';
    return decisions.every((d) => d === 'approved') ? 'approved' : 'pending';
  }
  if (decisions.includes('approved')) return 'approved';
  if (decisions.some((d) => d === null)) return 'pending';
  return decisions.includes('changes_requested') ? 'changes_requested' : 'rejected';
}

/** Re-evaluates a pending approval after reviewers or decisions changed. */
export async function recomputeApprovalStatus(tx: Tx, actor: Pick<Actor, 'orgId' | 'userId'>, approvalId: string) {
  const [approval] = await tx.select().from(approvals).where(eq(approvals.id, approvalId));
  if (!approval || approval.status !== 'pending') return approval?.status ?? null;
  const reviewers = await tx.select().from(approvalReviewers).where(eq(approvalReviewers.approvalId, approvalId));
  const outcome = evaluateApproval(approval.rule, reviewers.map((r) => r.decision));
  if (outcome !== 'pending') {
    await tx
      .update(approvals)
      .set({ status: outcome, decidedAt: new Date(), updatedAt: new Date(), version: approval.version + 1 })
      .where(eq(approvals.id, approvalId));
    await publish(tx, actor.orgId, `project:${approval.projectId}`, 'approval.updated', approvalId, { status: outcome });
  }
  return outcome;
}
