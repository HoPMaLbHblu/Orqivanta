import { and, approvalReviewers, approvals, eq, isNull, sql, withTenant } from '@orqivanta/db';
import { canOrg, listFavorites, listMyOrgs, rememberActiveOrg, unreadCount } from '@orqivanta/core';
import { AppShell } from '@/components/shell/app-shell';
import { requireActor, requireUser } from '@/lib/session';

export default async function OrgLayout({ children, params }: { children: React.ReactNode; params: Promise<{ org: string }> }) {
  const { org } = await params;
  const user = await requireUser();
  const actor = await requireActor(org);
  const [orgs, unread, favorites, counts] = await Promise.all([
    listMyOrgs(user.id),
    unreadCount(actor),
    listFavorites(actor),
    withTenant(actor.orgId, async (tx) => {
      const [rv] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(approvalReviewers)
        .innerJoin(approvals, eq(approvals.id, approvalReviewers.approvalId))
        .where(and(eq(approvalReviewers.userId, actor.userId), isNull(approvalReviewers.decision), eq(approvals.status, 'pending')));
      const [rq] = await tx.execute<{ n: number }>(sql`select count(*)::int as n from requests where org_id = ${actor.orgId} and status = 'submitted'`).then((r) => r.rows);
      return { reviews: rv?.n ?? 0, requests: rq?.n ?? 0 };
    }),
    user.lastActiveOrgId !== actor.orgId ? rememberActiveOrg(user.id, actor.orgId) : null,
  ]);
  return (
    <AppShell
      data={{
        org: { slug: actor.orgSlug, name: actor.orgName, role: actor.role, isDemo: actor.isDemo },
        orgs: orgs.map((o) => ({ slug: o.slug, name: o.name, role: o.role, isDemo: o.isDemo })),
        user: { name: user.name, email: user.email, color: user.avatarColor },
        unread,
        reviewsWaiting: counts.reviews,
        openRequests: canOrg(actor.role, 'requests.triage') ? counts.requests : 0,
        favorites,
        canSeeSettings: canOrg(actor.role, 'org.update'),
        canSeeReports: canOrg(actor.role, 'reports.view'),
      }}
    >
      {children}
    </AppShell>
  );
}
