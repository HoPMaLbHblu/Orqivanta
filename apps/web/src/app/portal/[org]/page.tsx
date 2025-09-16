import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { ArrowRight, CircleHelp, FileText, FolderOpen, Inbox, MessageSquarePlus, Stamp } from 'lucide-react';
import { listApprovals, listFiles, listPortalUpdates, listProjects, listRequests } from '@orqivanta/core';
import { DueDate, RelativeTime } from '@/components/domain/dates';
import { HealthBadge, RequestStatusBadge } from '@/components/domain/badges';
import { ProgressBar } from '@/components/domain/progress';
import { toneInk } from '@/components/domain/tone';
import { FileIcon } from '@/components/files/file-icon';
import { PortalCard, PortalCardHeader, PortalEmpty, PortalSection } from '@/components/portal/portal-ui';
import { UpdateCard } from '@/components/portal/update-card';
import { requirePortal } from '@/components/portal/portal-session';

export async function generateMetadata() {
  const t = await getTranslations('portal');
  return { title: t('title') };
}

export default async function PortalHomePage({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const { user, actor, viewer, account, preview } = await requirePortal(org);
  const t = await getTranslations('portal.home');
  const tp = await getTranslations('portal');
  const base = `/portal/${org}`;

  const [projects, approvals, requests, updates, files] = await Promise.all([
    listProjects(viewer),
    listApprovals(viewer, { view: 'open' }),
    listRequests(viewer, { view: 'all' }),
    listPortalUpdates(viewer, { limit: 3 }),
    listFiles(viewer, {}),
  ]);

  const mine = approvals.filter((a) => a.amReviewer && !a.myDecision);
  const otherOpen = approvals.filter((a) => !(a.amReviewer && !a.myDecision));
  const needsAnswer = requests.filter((r) => r.status === 'needs_info');
  const openRequests = requests.filter((r) => !['completed', 'declined', 'duplicate'].includes(r.status));
  const firstName = user.name.split(' ')[0] ?? user.name;

  return (
    <div className="mx-auto max-w-[1120px] px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <header className="max-w-2xl">
        <h1 className="font-serif text-[36px] leading-[1.1] tracking-[-0.01em] text-ink sm:text-[44px]">
          {preview && account ? account.name : t('greeting', { name: firstName })}
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-2">{t('intro', { org: actor.orgName })}</p>
      </header>

      <PortalSection title={t('needsYou')} description={t('needsYouHint')} className="mt-10">
        {mine.length || needsAnswer.length || (preview && otherOpen.length) ? (
          <ul className="flex flex-col gap-3">
            {mine.map((a) => (
              <li key={a.id}>
                <Link href={`${base}/approvals/${a.id}`} className="group flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-attention/40 bg-attention-soft/40 px-4 py-3.5 transition-colors hover:border-attention/70">
                  <Stamp className="size-5 shrink-0 text-attention" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-medium text-ink">{a.title}</span>
                    <span className="mt-0.5 block text-[13px] text-ink-2">
                      {a.projectName} · {a.subjectName}
                      {a.round > 1 ? ` · ${t('round', { round: a.round })}` : ''}
                    </span>
                  </span>
                  {a.dueDate ? <DueDate date={a.dueDate} className="text-[13px]" /> : null}
                  <span className="inline-flex items-center gap-1 text-[13px] font-medium text-accent group-hover:underline">
                    {t('openReview')} <ArrowRight className="size-3.5" aria-hidden />
                  </span>
                </Link>
              </li>
            ))}
            {needsAnswer.map((r) => (
              <li key={r.id}>
                <Link href={`${base}/requests/${r.number}`} className="group flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-attention/40 bg-attention-soft/40 px-4 py-3.5 transition-colors hover:border-attention/70">
                  <CircleHelp className="size-5 shrink-0 text-attention" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-medium text-ink">{r.title}</span>
                    <span className="mt-0.5 block text-[13px] text-ink-2">{t('waitingOnYou')}</span>
                  </span>
                  <span className="inline-flex items-center gap-1 text-[13px] font-medium text-accent group-hover:underline">
                    {t('answerQuestion')} <ArrowRight className="size-3.5" aria-hidden />
                  </span>
                </Link>
              </li>
            ))}
            {preview
              ? otherOpen.map((a) => (
                  <li key={a.id}>
                    <Link href={`${base}/approvals/${a.id}`} className="group flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-line bg-surface px-4 py-3.5 transition-colors hover:border-line-strong">
                      <Stamp className="size-5 shrink-0 text-ink-3" aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[15px] font-medium text-ink">{a.title}</span>
                        <span className="mt-0.5 block text-[13px] text-ink-2">
                          {a.projectName} · {a.subjectName}
                        </span>
                      </span>
                      {a.dueDate ? <DueDate date={a.dueDate} className="text-[13px]" /> : null}
                    </Link>
                  </li>
                ))
              : null}
          </ul>
        ) : (
          <PortalCard>
            <PortalEmpty icon={<Stamp />} title={t('allClear')} description={t('allClearHint')} />
          </PortalCard>
        )}
      </PortalSection>

      <div className="mt-12 grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
          <PortalCard>
            <PortalCardHeader title={t('projects')} description={t('projectsHint')} />
            {projects.length ? (
              <ul className="divide-y divide-line">
                {projects.map((p) => (
                  <li key={p.id}>
                    <Link href={`${base}/projects/${p.key}`} className="block px-5 py-4 hover:bg-surface-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: toneInk(p.color) }} aria-hidden />
                        <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-ink">{p.name}</span>
                        <HealthBadge health={p.health} source={p.healthSource} />
                      </div>
                      <div className="mt-2.5 flex flex-wrap items-center gap-3 pl-[18px]">
                        <ProgressBar value={p.stats.progress} label={t('progressOf', { name: p.name })} className="min-w-40 flex-1" />
                        {p.dueDate ? <DueDate date={p.dueDate} /> : null}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <PortalEmpty icon={<FolderOpen />} title={t('noProjects')} description={t('noProjectsHint', { org: actor.orgName })} />
            )}
          </PortalCard>

          <PortalCard>
            <PortalCardHeader
              title={t('recentRequests')}
              action={
                <div className="flex items-center gap-3">
                  <Link href={`${base}/requests`} className="text-[13px] font-medium text-accent hover:underline">
                    {t('allRequests')}
                  </Link>
                </div>
              }
            />
            {openRequests.length || requests.length ? (
              <ul className="divide-y divide-line">
                {(openRequests.length ? openRequests : requests).slice(0, 5).map((r) => (
                  <li key={r.id}>
                    <Link href={`${base}/requests/${r.number}`} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-5 py-3.5 hover:bg-surface-2">
                      <span className="min-w-0 flex-1 truncate text-[14px] text-ink">{r.title}</span>
                      <RequestStatusBadge status={r.status} client />
                      <RelativeTime date={r.updatedAt} className="w-full text-[12px] text-ink-3 sm:w-auto" />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <PortalEmpty
                icon={<Inbox />}
                title={t('noRequests')}
                description={t('noRequestsHint')}
                action={
                  !preview ? (
                    <Link href={`${base}/requests/new`} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-accent hover:underline">
                      <MessageSquarePlus className="size-4" aria-hidden /> {t('newRequest')}
                    </Link>
                  ) : null
                }
              />
            )}
          </PortalCard>
        </div>

        <div className="flex flex-col gap-6">
          <PortalCard>
            <PortalCardHeader
              title={t('latestUpdates')}
              action={
                <Link href={`${base}/updates`} className="text-[13px] font-medium text-accent hover:underline">
                  {t('allUpdates')}
                </Link>
              }
            />
            {updates.length ? (
              <ul className="divide-y divide-line">
                {updates.map((u) => (
                  <li key={u.id} className="px-5 py-4">
                    <UpdateCard update={u} href={`${base}/projects/${u.projectKey}`} compact />
                  </li>
                ))}
              </ul>
            ) : (
              <PortalEmpty icon={<FileText />} title={t('noUpdates')} />
            )}
          </PortalCard>

          {files.length ? (
            <PortalCard>
              <PortalCardHeader
                title={t('deliverables')}
                action={
                  <Link href={`${base}/deliverables`} className="text-[13px] font-medium text-accent hover:underline">
                    {t('allDeliverables')}
                  </Link>
                }
              />
              <ul className="divide-y divide-line">
                {files.slice(0, 5).map((f) => (
                  <li key={f.id}>
                    <Link href={`${base}/files/${f.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-surface-2">
                      <FileIcon mimeType={f.mimeType} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] text-ink">{f.name}</span>
                        <span className="block truncate text-[12px] text-ink-3">{f.projectName}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </PortalCard>
          ) : null}
        </div>
      </div>

      {!preview ? (
        <p className="mt-12 text-[13px] text-ink-3">
          {tp('requests.intro')}{' '}
          <Link href={`${base}/requests/new`} className="font-medium text-accent hover:underline">
            {t('newRequest')}
          </Link>
        </p>
      ) : null}
    </div>
  );
}
