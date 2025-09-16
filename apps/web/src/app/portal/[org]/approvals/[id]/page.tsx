import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { ArrowLeft, CheckCircle2, Clock, Flag, RotateCcw, XCircle } from 'lucide-react';
import { getApproval, listComments } from '@orqivanta/core';
import { CommentThread } from '@/components/comments/thread';
import { ApprovalStatusBadge } from '@/components/domain/badges';
import { Avatar } from '@/components/domain/avatar';
import { DueDate, FormattedDate } from '@/components/domain/dates';
import { RichText } from '@/components/rich-text/render';
import { DecisionForm } from '@/components/portal/decision-form';
import { PortalCard, PortalCardHeader, PortalFacts, PortalPageHeader } from '@/components/portal/portal-ui';
import { VersionPreview } from '@/components/portal/version-preview';
import { orNotFound, requirePortal } from '@/components/portal/portal-session';
import { Notice } from '@/components/ui/primitives';

export async function generateMetadata({ params }: { params: Promise<{ org: string; id: string }> }) {
  const { org, id } = await params;
  const { viewer } = await requirePortal(org);
  const a = await orNotFound(getApproval(viewer, id)).catch(() => null);
  const t = await getTranslations('portal.approvals');
  return { title: a ? a.approval.title : t('title') };
}

const DECISION_ICON = { approved: CheckCircle2, changes_requested: RotateCcw, rejected: XCircle } as const;

export default async function PortalApprovalPage({ params }: { params: Promise<{ org: string; id: string }> }) {
  const { org, id } = await params;
  const { viewer, user, preview } = await requirePortal(org);
  const t = await getTranslations('portal.approvals');
  const td = await getTranslations('enums.decision');
  const ts = await getTranslations('enums.approvalStatus');
  const base = `/portal/${org}`;

  const detail = await orNotFound(getApproval(viewer, id));
  const a = detail.approval;
  const { comments, context } = await listComments(viewer, { type: 'approval', id: a.id });
  const mine = detail.reviewers.find((r) => r.userId === user.id);
  const canDecide = detail.access.canDecide && !preview;

  return (
    <div className="mx-auto max-w-[1120px] px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <Link href={`${base}/approvals`} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-3 hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> {t('title')}
      </Link>
      <PortalPageHeader
        className="mt-4"
        eyebrow={`${t('detailEyebrow')} · ${detail.project.name}${a.round > 1 ? ` · ${t('round', { round: a.round })}` : ''}`}
        title={a.title}
        action={<ApprovalStatusBadge status={a.status} />}
      />

      {a.status === 'superseded' ? (
        <Notice tone="info" icon={<RotateCcw />} className="mt-6">
          <strong className="font-semibold">{t('supersededTitle')}</strong> {t('supersededHint')}{' '}
          {detail.newerRound ? (
            <Link href={`${base}/approvals/${detail.newerRound.id}`} className="font-medium text-accent hover:underline">
              {t('newerRound', { round: detail.newerRound.round })}
            </Link>
          ) : null}
        </Notice>
      ) : null}

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:gap-8">
        <div className="flex flex-col gap-6">
          <section aria-label={t('preview')}>
            {detail.file ? (
              <VersionPreview file={detail.file} />
            ) : detail.document ? (
              <PortalCard>
                <PortalCardHeader title={detail.document.title} description={t('version', { version: detail.document.version })} />
                <div className="px-6 py-6">
                  <RichText doc={detail.document.content} className="text-[15px] leading-relaxed" />
                </div>
              </PortalCard>
            ) : detail.milestone ? (
              <PortalCard>
                <PortalCardHeader title={t('milestone')} />
                <div className="flex flex-col gap-2 px-5 py-4">
                  <p className="flex items-center gap-2 text-[16px] font-medium text-ink">
                    <Flag className="size-4 text-ink-3" aria-hidden /> {detail.milestone.name}
                  </p>
                  {detail.milestone.description ? <p className="text-[14px] leading-relaxed text-ink-2">{detail.milestone.description}</p> : null}
                  {detail.milestone.dueDate ? <DueDate date={detail.milestone.dueDate} /> : null}
                </div>
              </PortalCard>
            ) : null}
          </section>

          {a.instructions ? (
            <PortalCard>
              <PortalCardHeader title={t('instructions')} />
              <p className="px-5 py-4 text-[14px] leading-relaxed whitespace-pre-wrap text-ink">{a.instructions}</p>
            </PortalCard>
          ) : null}

          <PortalCard id="decide">
            <PortalCardHeader title={t('decide')} description={canDecide ? t('decideHint') : undefined} />
            <div className="px-5 py-5">
              {canDecide ? (
                <DecisionForm org={org} approvalId={a.id} />
              ) : mine?.decision ? (
                <p className="text-[14px] text-ink">
                  {t('decided', { decision: td(mine.decision).toLowerCase() })}{' '}
                  {mine.decidedAt ? (
                    <span className="text-ink-2">
                      {t('decidedOn')} <FormattedDate date={mine.decidedAt} withTime />
                    </span>
                  ) : null}
                  {mine.comment ? <span className="mt-2 block text-[14px] leading-relaxed text-ink-2">“{mine.comment}”</span> : null}
                </p>
              ) : a.status !== 'pending' ? (
                <p className="text-[14px] text-ink-2">
                  <span className="font-medium text-ink">{t('closedTitle')}</span> {t('closedHint')}
                </p>
              ) : (
                <p className="text-[14px] text-ink-2">
                  <span className="font-medium text-ink">{t('notReviewer')}</span> {t('notReviewerHint')}
                </p>
              )}
            </div>
          </PortalCard>

          <PortalCard>
            <PortalCardHeader title={t('discussion')} description={t('discussionHint')} />
            <div className="px-5 py-5">
              <CommentThread
                org={org}
                parent={{ type: 'approval', id: a.id }}
                comments={comments}
                context={preview ? { ...context, canInternal: false, canClient: false } : context}
                people={[]}
                currentUserId={user.id}
                title=""
              />
            </div>
          </PortalCard>
        </div>

        <aside className="flex flex-col gap-6">
          <PortalCard>
            <PortalCardHeader title={t('reviewers')} description={t(`rule.${a.rule}`)} />
            <ul className="divide-y divide-line">
              {detail.reviewers.map((r) => {
                const Icon = r.decision ? DECISION_ICON[r.decision] : Clock;
                return (
                  <li key={r.userId} className="flex items-start gap-3 px-5 py-3.5">
                    <Avatar name={r.name} color={r.avatarColor} size="md" title="" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-medium text-ink">
                        {r.name}
                        {r.userId === user.id ? ` · ${t('yourDecision')}` : ''}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-ink-2">
                        <Icon className={`size-3.5 ${r.decision === 'approved' ? 'text-success' : r.decision === 'rejected' ? 'text-danger' : r.decision ? 'text-info' : 'text-ink-3'}`} aria-hidden />
                        {r.decision ? td(r.decision) : t('notDecided')}
                      </p>
                      {r.comment ? <p className="mt-1.5 text-[13px] leading-relaxed text-ink-2">“{r.comment}”</p> : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </PortalCard>

          <PortalCard>
            <PortalCardHeader title={t('detailEyebrow')} />
            <div className="px-5 py-4">
              <PortalFacts
                items={[
                  { label: t('round', { round: a.round }), value: <ApprovalStatusBadge status={a.status} /> },
                  { label: t('dueLabel'), value: a.dueDate ? <DueDate date={a.dueDate} /> : t('noDue') },
                ]}
              />
              {detail.previousRounds.length ? (
                <div className="mt-5 border-t border-line pt-4">
                  <h3 className="text-[12px] font-medium tracking-wide text-ink-3 uppercase">{t('earlierRounds')}</h3>
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {detail.previousRounds.map((p) => (
                      <li key={p.id}>
                        <Link href={`${base}/approvals/${p.id}`} className="text-[13px] text-accent hover:underline">
                          {t('roundStatus', { round: p.round, status: ts(p.status as 'approved') })}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </PortalCard>
        </aside>
      </div>
    </div>
  );
}
