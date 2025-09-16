import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { ArrowUpRight, ChevronLeft, Clock, FileText, Flag, History } from 'lucide-react';
import { AppError, getApproval, IMAGE_TYPES, listComments, listEntityTimeline, listPeople, PREVIEWABLE } from '@orqivanta/core';
import { CommentThread } from '@/components/comments/thread';
import { ActivityList } from '@/components/domain/activity-list';
import { ApprovalStatusBadge, type ApprovalStatus } from '@/components/domain/badges';
import { DueDate, FormattedDate } from '@/components/domain/dates';
import { DecisionPanel, ManagePanel, ReviewerList, RoundHistory } from '@/components/approvals/approval-detail';
import { inlineUrl, previewUrl } from '@/components/files/format';
import { RichText } from '@/components/rich-text/render';
import { Card, CardHeader, Mono, Notice } from '@/components/ui/primitives';
import { requireActor } from '@/lib/session';

async function load(org: string, id: string) {
  const actor = await requireActor(org);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  try {
    return { actor, data: await getApproval(actor, id) };
  } catch (err) {
    if (err instanceof AppError && (err.code === 'NOT_FOUND' || err.code === 'FORBIDDEN')) notFound();
    throw err;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ org: string; id: string }> }) {
  const { org, id } = await params;
  const { data } = await load(org, id);
  return { title: data.approval.title };
}

export default async function ApprovalPage({ params }: { params: Promise<{ org: string; id: string }> }) {
  const { org, id } = await params;
  const { actor, data } = await load(org, id);
  const t = await getTranslations('approvals');
  const a = data.approval;
  const [thread, timeline, people] = await Promise.all([
    listComments(actor, { type: 'approval', id: a.id }),
    listEntityTimeline(actor, { type: 'approval', id: a.id }),
    listPeople(actor),
  ]);
  const status = a.status as ApprovalStatus;
  const base = `/${org}`;
  const mentionable = people.map((p) => ({ id: p.id, name: p.name, color: p.avatarColor }));
  const undecided = data.reviewers.filter((r) => !r.decision);
  const isImage = data.file ? IMAGE_TYPES.has(data.file.mimeType) : false;
  const isPdf = data.file?.mimeType === 'application/pdf';
  const previewable = data.file ? PREVIEWABLE.has(data.file.mimeType) : false;

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6 lg:px-10">
      <Link href={`${base}/approvals`} className="inline-flex items-center gap-1 text-[13px] text-ink-3 hover:text-ink">
        <ChevronLeft className="size-4" aria-hidden /> {t('title')}
      </Link>

      <header className="mt-3 flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <ApprovalStatusBadge status={status} />
          <Mono>{t('roundN', { round: a.round })}</Mono>
          <span className="text-[12px] text-ink-3">{t(`rule.${a.rule}`)}</span>
        </div>
        <h1 className="text-[22px] leading-snug font-semibold tracking-[-0.01em] text-ink">{a.title}</h1>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-ink-3">
          <Link href={`${base}/projects/${data.project.key}`} className="font-medium text-ink-2 hover:text-ink hover:underline">
            {data.project.name}
          </Link>
          {data.createdByName ? (
            <>
              <span aria-hidden>·</span>
              <span>{t('requestedBy', { name: data.createdByName })}</span>
            </>
          ) : null}
          <span aria-hidden>·</span>
          <FormattedDate date={a.createdAt} withTime />
          {a.dueDate ? (
            <>
              <span aria-hidden>·</span>
              <DueDate date={a.dueDate} done={status !== 'pending'} />
            </>
          ) : null}
        </p>
      </header>

      {data.newerRound ? (
        <Notice className="mt-4" tone="attention" icon={<History />}>
          {t('newerRoundNotice', { round: data.newerRound.round })}{' '}
          <Link href={`${base}/approvals/${data.newerRound.id}`} className="inline-flex items-center gap-1 font-medium underline">
            {t('openNewerRound')} <ArrowUpRight className="size-3.5" aria-hidden />
          </Link>
        </Notice>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card className="overflow-hidden">
            <CardHeader
              title={t('underReview')}
              description={data.file ? t('pinnedToVersion', { version: data.file.version }) : data.document ? t('pinnedToDocVersion', { version: data.document.version }) : t('pinnedMilestone')}
              action={
                data.file ? (
                  <Link href={`${base}/files/${data.file.id}`} className="text-[12px] font-medium text-accent hover:underline">
                    {t('openFile')}
                  </Link>
                ) : data.document ? (
                  <Link href={`${base}/documents/${data.document.id}`} className="text-[12px] font-medium text-accent hover:underline">
                    {t('openDocument')}
                  </Link>
                ) : null
              }
            />
            {data.file ? (
              <div className="flex flex-col gap-3 p-4">
                <p className="flex flex-wrap items-center gap-2 text-[13px] text-ink">
                  <span className="font-medium">{data.file.name}</span>
                  <Mono>v{data.file.version}</Mono>
                  {data.file.latestVersion > data.file.version ? <span className="text-[12px] text-attention">{t('notLatest', { latest: data.file.latestVersion })}</span> : null}
                </p>
                {data.file.note ? <p className="text-[13px] text-ink-2">{data.file.note}</p> : null}
                {isImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previewUrl(data.file.versionId)} alt={t('previewAlt', { name: data.file.name })} className="max-h-[520px] w-full rounded-md border border-line bg-surface-2 object-contain" />
                ) : isPdf ? (
                  <iframe src={inlineUrl(data.file.versionId)} title={t('previewAlt', { name: data.file.name })} className="h-[520px] w-full rounded-md border border-line bg-surface-2" />
                ) : (
                  <p className="rounded-md border border-line bg-surface-2 px-3 py-6 text-center text-[13px] text-ink-3">{t('noPreview')}</p>
                )}
                {!previewable ? null : null}
              </div>
            ) : data.document ? (
              <div className="p-4">
                <p className="mb-2 flex items-center gap-2 text-[13px] text-ink">
                  <FileText className="size-4 text-ink-3" aria-hidden />
                  <span className="font-medium">{data.document.title}</span>
                  <Mono>v{data.document.version}</Mono>
                </p>
                <div className="max-h-[520px] overflow-y-auto rounded-md border border-line bg-surface-2 px-4 py-3">
                  <RichText doc={data.document.content} />
                </div>
              </div>
            ) : data.milestone ? (
              <div className="flex flex-col gap-2 p-4">
                <p className="flex items-center gap-2 text-[13px] font-medium text-ink">
                  <Flag className="size-4 text-ink-3" aria-hidden />
                  {data.milestone.name}
                </p>
                {data.milestone.dueDate ? (
                  <p className="text-[13px] text-ink-2">
                    {t('milestoneDue')} <FormattedDate date={data.milestone.dueDate} />
                  </p>
                ) : null}
                {data.milestone.description ? <p className="text-[13px] whitespace-pre-wrap text-ink-2">{data.milestone.description}</p> : null}
              </div>
            ) : (
              <p className="p-4 text-[13px] text-ink-3">{t('subjectMissing')}</p>
            )}
            {a.instructions ? (
              <div className="border-t border-line px-4 py-3">
                <h3 className="mb-1 text-[12px] font-medium text-ink-3">{t('instructions')}</h3>
                <p className="text-[13px] whitespace-pre-wrap text-ink">{a.instructions}</p>
              </div>
            ) : null}
          </Card>

          <Card className="p-4">
            <CommentThread org={org} parent={{ type: 'approval', id: a.id }} comments={thread.comments} context={thread.context} people={mentionable} currentUserId={actor.userId} isAdmin={actor.role === 'owner' || actor.role === 'admin'} title={t('discussion')} />
          </Card>

          <Card>
            <CardHeader title={t('historyTitle')} />
            <div className="px-4">
              <ActivityList items={timeline.filter((e) => e.verb !== 'commented')} orgSlug={org} showProject={false} emptyLabel={t('historyEmpty')} />
            </div>
          </Card>
        </div>

        <aside className="flex flex-col gap-4" aria-label={t('sidebarLabel')}>
          {data.access.canDecide ? <DecisionPanel org={org} approvalId={a.id} rule={a.rule as 'any' | 'all'} /> : null}
          {data.access.isReviewer && !data.access.canDecide && status === 'pending' ? (
            <Notice tone="success" icon={<Clock />}>
              {t('youDecided')}
            </Notice>
          ) : null}
          <ReviewerList reviewers={data.reviewers.map((r) => ({ ...r, decidedAt: r.decidedAt ?? null }))} myUserId={actor.userId} rule={a.rule as 'any' | 'all'} status={status} />
          {data.access.canManage && status === 'pending' ? (
            <ManagePanel
              org={org}
              approvalId={a.id}
              undecided={undecided.map((r) => ({ userId: r.userId, name: r.name }))}
              candidates={people.filter((p) => p.role !== 'client' && !data.reviewers.some((r) => r.userId === p.id)).map((p) => ({ id: p.id, name: p.name }))}
              lastReminderAt={a.lastReminderAt ? a.lastReminderAt.toISOString() : null}
            />
          ) : null}
          <RoundHistory org={org} rounds={data.previousRounds.map((r) => ({ id: r.id, round: r.round, status: r.status as ApprovalStatus, createdAt: new Date(r.created_at).toISOString(), fileVersion: r.file_version }))} currentRound={a.round} newerRound={data.newerRound} />
        </aside>
      </div>
    </div>
  );
}
