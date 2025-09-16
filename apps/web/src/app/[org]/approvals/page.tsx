import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { FileText, Flag, Image as ImageIcon, Stamp } from 'lucide-react';
import { listApprovals, listReviewersFor } from '@orqivanta/core';
import { ApprovalStatusBadge, SampleDataBadge, type ApprovalStatus } from '@/components/domain/badges';
import { DueDate } from '@/components/domain/dates';
import { ReviewerChips } from '@/components/approvals/reviewer-chips';
import { ViewTabs } from '@/components/requests/view-tabs';
import { Card, EmptyState, PageHeader } from '@/components/ui/primitives';
import { requireActor } from '@/lib/session';

export async function generateMetadata() {
  const t = await getTranslations('approvals');
  return { title: t('title') };
}

const VIEWS = ['awaiting_me', 'pending', 'decided', 'all'] as const;
type View = (typeof VIEWS)[number];
const CORE_VIEW: Record<View, 'awaiting_me' | 'open' | 'decided' | 'all'> = { awaiting_me: 'awaiting_me', pending: 'open', decided: 'decided', all: 'all' };

export default async function ApprovalsPage({ params, searchParams }: { params: Promise<{ org: string }>; searchParams: Promise<{ view?: string }> }) {
  const { org } = await params;
  const sp = await searchParams;
  const actor = await requireActor(org);
  const t = await getTranslations('approvals');
  const view: View = VIEWS.includes(sp.view as View) ? (sp.view as View) : 'pending';
  const [rows, awaitingCount, pendingCount] = await Promise.all([
    listApprovals(actor, { view: CORE_VIEW[view] }),
    listApprovals(actor, { view: 'awaiting_me' }).then((r) => r.length),
    listApprovals(actor, { view: 'open' }).then((r) => r.length),
  ]);
  const reviewers = await listReviewersFor(actor, rows.map((r) => r.id));
  const base = `/${org}/approvals`;

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6 lg:px-10">
      <PageHeader title={t('title')} description={t('description')} actions={actor.isDemo ? <SampleDataBadge /> : null} />

      <ViewTabs
        className="mt-6"
        label={t('views.label')}
        items={VIEWS.map((v) => ({
          href: v === 'pending' ? base : `${base}?view=${v}`,
          label: t(`views.${v}`),
          active: v === view,
          count: v === 'awaiting_me' ? awaitingCount : v === 'pending' ? pendingCount : undefined,
          attention: v === 'awaiting_me',
        }))}
      />

      <Card className="mt-4 overflow-hidden">
        {rows.length ? (
          <ul className="divide-y divide-line">
            {rows.map((a) => {
              const Icon = a.fileId ? ImageIcon : a.documentId ? FileText : Flag;
              const mine = reviewers.filter((r) => r.approvalId === a.id);
              return (
                <li key={a.id}>
                  <Link href={`${base}/${a.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 hover:bg-surface-2">
                    <span className="flex min-w-0 flex-1 basis-64 items-start gap-2.5">
                      <Icon className="mt-0.5 size-4 shrink-0 text-ink-3" aria-hidden />
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-medium text-ink">{a.title}</span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12px] text-ink-3">
                          <span className="truncate">{a.subjectName ?? t('subjectMissing')}</span>
                          <span aria-hidden>·</span>
                          <span>{a.projectKey}</span>
                          {a.round > 1 ? (
                            <>
                              <span aria-hidden>·</span>
                              <span>{t('roundN', { round: a.round })}</span>
                            </>
                          ) : null}
                        </span>
                      </span>
                    </span>
                    <ReviewerChips reviewers={mine} myUserId={actor.userId} />
                    <span className="w-[140px] shrink-0">
                      <ApprovalStatusBadge status={a.status as ApprovalStatus} />
                    </span>
                    <span className="w-24 shrink-0 text-right">
                      <DueDate date={a.dueDate} done={a.status !== 'pending'} short className="justify-end" />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState icon={<Stamp />} title={t(`emptyView.${view}`)} description={t('emptyHint')} />
        )}
      </Card>
      <p className="mt-3 text-[12px] text-ink-3">{t('createdFromItems')}</p>
    </div>
  );
}
