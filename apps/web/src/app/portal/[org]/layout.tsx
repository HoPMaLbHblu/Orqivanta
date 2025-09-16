import { and, approvalReviewers, approvals, eq, isNull, sql, withTenant } from '@orqivanta/db';
import { listNotifications, unreadCount } from '@orqivanta/core';
import { PortalShell } from '@/components/portal/portal-shell';
import { getPortalSession } from '@/components/portal/portal-session';

export default async function PortalLayout({ children, params }: { children: React.ReactNode; params: Promise<{ org: string }> }) {
  const { org } = await params;
  const { user, actor, viewer, account, preview } = await getPortalSession(org);

  // Counts and notifications belong to the signed-in person, so they are empty in preview.
  const [reviews, unread, notifications] = preview || !viewer
    ? [0, 0, { items: [] as never[] }]
    : await Promise.all([
        withTenant(actor.orgId, async (tx) => {
          const [row] = await tx
            .select({ n: sql<number>`count(*)::int` })
            .from(approvalReviewers)
            .innerJoin(approvals, eq(approvals.id, approvalReviewers.approvalId))
            .where(and(eq(approvalReviewers.userId, actor.userId), isNull(approvalReviewers.decision), eq(approvals.status, 'pending')));
          return row?.n ?? 0;
        }),
        unreadCount(actor),
        listNotifications(actor, { limit: 12 }),
      ]);

  return (
    <PortalShell
      data={{
        org: { slug: actor.orgSlug, name: actor.orgName, isDemo: actor.isDemo },
        account: account ? { name: account.name } : null,
        user: { name: user.name, email: user.email, color: user.avatarColor },
        preview,
        hasViewer: Boolean(viewer),
        reviewsWaiting: reviews,
        unread,
        notifications: notifications.items.map((n) => ({ id: n.id, title: n.title, body: n.body, href: n.href, readAt: n.readAt, createdAt: n.createdAt })),
        // Account settings live outside the portal; the link appears once that page exists.
        accountSettingsHref: null,
      }}
    >
      {children}
    </PortalShell>
  );
}
