import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { ArrowLeft, Download, FileText, Flag, Megaphone, Paperclip, Stamp } from 'lucide-react';
import { getPortalProject, getProjectByKey, listApprovals, listDocuments, listFiles, listProjectRequests } from '@orqivanta/core';
import { ApprovalStatusBadge, Badge, HealthBadge, RequestStatusBadge } from '@/components/domain/badges';
import { DueDate, RelativeTime } from '@/components/domain/dates';
import { ProgressBar } from '@/components/domain/progress';
import { FileIcon } from '@/components/files/file-icon';
import { downloadUrl, formatBytes } from '@/components/files/format';
import { PortalCard, PortalCardHeader, PortalEmpty, PortalPageHeader } from '@/components/portal/portal-ui';
import { UpdateCard } from '@/components/portal/update-card';
import { orNotFound, requirePortal } from '@/components/portal/portal-session';

export async function generateMetadata({ params }: { params: Promise<{ org: string; key: string }> }) {
  const { org, key } = await params;
  const { viewer } = await requirePortal(org);
  const access = await orNotFound(getProjectByKey(viewer, key)).catch(() => null);
  return { title: access?.project.name ?? key.toUpperCase() };
}

export default async function PortalProjectPage({ params }: { params: Promise<{ org: string; key: string }> }) {
  const { org, key } = await params;
  const { viewer } = await requirePortal(org);
  const t = await getTranslations('portal.project');
  const tm = await getTranslations('enums.milestoneStatus');
  const base = `/portal/${org}`;

  const access = await orNotFound(getProjectByKey(viewer, key));
  const projectId = access.project.id;
  const [overview, files, documents, approvals, requests] = await Promise.all([
    getPortalProject(viewer, projectId),
    listFiles(viewer, { projectId }),
    listDocuments(viewer, { projectId }),
    listApprovals(viewer, { projectId, view: 'all' }),
    listProjectRequests(viewer, projectId),
  ]);
  const p = overview.project;

  return (
    <div className="mx-auto max-w-[1120px] px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <Link href={base} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-3 hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> {t('backToHome')}
      </Link>
      <PortalPageHeader
        className="mt-4"
        eyebrow={t('eyebrow')}
        title={p.name}
        description={p.description ?? undefined}
        action={<HealthBadge health={overview.health} source={overview.healthSource} />}
      />

      <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-3 rounded-xl border border-line bg-surface px-5 py-4">
        <div className="min-w-56 flex-1">
          <p className="text-[12px] font-medium tracking-wide text-ink-3 uppercase">{t('progress')}</p>
          <div className="mt-2 flex items-center gap-3">
            <ProgressBar value={overview.stats.progress} label={t('progressOf', { name: p.name })} className="flex-1" />
          </div>
          <p className="mt-1.5 text-[12px] text-ink-3">{t('sharedTasksHint', { done: overview.stats.completed, total: overview.stats.total })}</p>
        </div>
        {p.dueDate ? (
          <div>
            <p className="text-[12px] font-medium tracking-wide text-ink-3 uppercase">{t('due')}</p>
            <DueDate date={p.dueDate} className="mt-2 text-[14px]" />
          </div>
        ) : null}
      </div>
      <p className="mt-3 text-[13px] text-ink-3">{t('onlyShared')}</p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:gap-8">
        <div className="flex flex-col gap-6">
          <PortalCard>
            <PortalCardHeader title={t('milestones')} />
            {overview.milestones.length ? (
              <ul className="divide-y divide-line">
                {overview.milestones.map((m) => (
                  <li key={m.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5">
                    <Flag className="size-4 shrink-0 text-ink-3" aria-hidden />
                    <span className="min-w-0 flex-1 basis-full sm:basis-0">
                      <span className="block text-[14px] font-medium text-ink">{m.name}</span>
                      {m.description ? <span className="mt-0.5 block text-[13px] text-ink-3">{m.description}</span> : null}
                    </span>
                    <Badge tone={m.status === 'done' ? 'success' : m.status === 'missed' ? 'danger' : m.status === 'in_progress' ? 'info' : 'neutral'}>{tm(m.status)}</Badge>
                    {m.dueDate ? <DueDate date={m.dueDate} done={m.status === 'done'} /> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <PortalEmpty icon={<Flag />} title={t('noMilestones')} />
            )}
          </PortalCard>

          <PortalCard>
            <PortalCardHeader title={t('deliverables')} />
            {files.length ? (
              <ul className="divide-y divide-line">
                {files.map((f) => (
                  <li key={f.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5">
                    <FileIcon mimeType={f.mimeType} className="size-5" />
                    <span className="min-w-0 flex-1 basis-full sm:basis-0">
                      <Link href={`${base}/files/${f.id}`} className="block truncate text-[14px] font-medium text-ink hover:underline">
                        {f.name}
                      </Link>
                      <span className="mt-0.5 block text-[12px] text-ink-3">
                        v{f.currentVersion} · {formatBytes(f.sizeBytes)} · <RelativeTime date={f.updatedAt} />
                      </span>
                    </span>
                    <a href={downloadUrl(f.versionId)} className="inline-flex items-center gap-1 text-[13px] font-medium text-accent hover:underline">
                      <Download className="size-3.5" aria-hidden /> <span className="sr-only">{f.name}</span>
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <PortalEmpty icon={<Paperclip />} title={t('noDeliverables')} />
            )}
          </PortalCard>

          {documents.length ? (
            <PortalCard>
              <PortalCardHeader title={t('documents')} />
              <ul className="divide-y divide-line">
                {documents.map((d) => (
                  <li key={d.id} className="flex items-center gap-3 px-5 py-3.5">
                    <FileText className="size-4 shrink-0 text-ink-3" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] text-ink">{d.title}</span>
                      <span className="mt-0.5 block text-[12px] text-ink-3">
                        <RelativeTime date={d.updatedAt} />
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </PortalCard>
          ) : null}
        </div>

        <aside className="flex flex-col gap-6">
          <PortalCard>
            <PortalCardHeader title={t('updates')} />
            {overview.updates.length ? (
              <ul className="divide-y divide-line">
                {overview.updates.map((u) => (
                  <li key={u.id} className="px-5 py-4">
                    <UpdateCard update={u} showProject={false} />
                  </li>
                ))}
              </ul>
            ) : (
              <PortalEmpty icon={<Megaphone />} title={t('noUpdates')} />
            )}
          </PortalCard>

          <PortalCard>
            <PortalCardHeader title={t('approvals')} />
            {approvals.length ? (
              <ul className="divide-y divide-line">
                {approvals.map((a) => (
                  <li key={a.id}>
                    <Link href={`${base}/approvals/${a.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-5 py-3.5 hover:bg-surface-2">
                      <Stamp className="size-4 shrink-0 text-ink-3" aria-hidden />
                      <span className="min-w-0 flex-1 text-[14px] text-ink">{a.title}</span>
                      <ApprovalStatusBadge status={a.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <PortalEmpty icon={<Stamp />} title={t('noApprovals')} />
            )}
          </PortalCard>

          {requests.length ? (
            <PortalCard>
              <PortalCardHeader title={t('requests')} />
              <ul className="divide-y divide-line">
                {requests.map((r) => (
                  <li key={r.id}>
                    <Link href={`${base}/requests/${r.number}`} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-5 py-3.5 hover:bg-surface-2">
                      <span className="min-w-0 flex-1 text-[14px] text-ink">{r.title}</span>
                      <RequestStatusBadge status={r.status} client />
                    </Link>
                  </li>
                ))}
              </ul>
            </PortalCard>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
