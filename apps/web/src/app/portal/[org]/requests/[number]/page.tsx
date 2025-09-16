import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { ArrowLeft, CircleHelp, Download, Paperclip } from 'lucide-react';
import { listComments, listEntityTimeline, listFiles, getRequestByNumber } from '@orqivanta/core';
import { CommentThread } from '@/components/comments/thread';
import { RequestStatusBadge } from '@/components/domain/badges';
import { FormattedDate, RelativeTime } from '@/components/domain/dates';
import { FileIcon } from '@/components/files/file-icon';
import { downloadUrl, formatBytes } from '@/components/files/format';
import { PortalCard, PortalCardHeader, PortalFacts, PortalPageHeader } from '@/components/portal/portal-ui';
import { RequestAttachments } from '@/components/portal/request-attachments';
import { Notice } from '@/components/ui/primitives';
import { orNotFound, requirePortal } from '@/components/portal/portal-session';

export async function generateMetadata({ params }: { params: Promise<{ org: string; number: string }> }) {
  const { number } = await params;
  const t = await getTranslations('portal.requests');
  return { title: t('detailEyebrow', { number: `#${number}` }) };
}

export default async function PortalRequestPage({ params }: { params: Promise<{ org: string; number: string }> }) {
  const { org, number } = await params;
  const n = Number(number);
  if (!Number.isInteger(n) || n < 1) notFound();
  const { actor, viewer, user, preview } = await requirePortal(org);
  const t = await getTranslations('portal.requests');
  const base = `/portal/${org}`;

  const detail = await orNotFound(getRequestByNumber(viewer, n));
  const r = detail.request;
  const [{ comments, context }, timeline, attachments] = await Promise.all([
    listComments(viewer, { type: 'request', id: r.id }),
    listEntityTimeline(viewer, { type: 'request', id: r.id }),
    listFiles(viewer, { requestId: r.id }),
  ]);

  const answers = (detail.form?.fields ?? []).filter((f) => r.answers[f.key] !== undefined && r.answers[f.key] !== '');

  return (
    <div className="mx-auto max-w-[1120px] px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <Link href={`${base}/requests`} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-3 hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> {t('title')}
      </Link>
      <PortalPageHeader className="mt-4" eyebrow={t('detailEyebrow', { number: `#${r.number}` })} title={r.title} action={<RequestStatusBadge status={r.status} client />} />

      {r.status === 'needs_info' ? (
        <Notice tone="attention" icon={<CircleHelp />} className="mt-6">
          <strong className="font-semibold">{t('needsInfo')}</strong> {t('needsInfoHint')}
        </Notice>
      ) : null}

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-8">
        <div className="flex flex-col gap-6">
          {r.details ? (
            <PortalCard>
              <PortalCardHeader title={t('yourRequest')} />
              <p className="px-5 py-4 text-[14px] leading-relaxed whitespace-pre-wrap text-ink">{r.details}</p>
            </PortalCard>
          ) : null}

          {answers.length ? (
            <PortalCard>
              <PortalCardHeader title={t('answers')} />
              <div className="px-5 py-4">
                <PortalFacts items={answers.map((f) => ({ label: f.label, value: String(r.answers[f.key]) }))} />
              </div>
            </PortalCard>
          ) : null}

          <PortalCard>
            <PortalCardHeader title={t('attachments')} description={preview ? undefined : t('attachHint')} />
            <div className="flex flex-col gap-3 px-5 py-4">
              {attachments.length ? (
                <ul className="flex flex-col divide-y divide-line">
                  {attachments.map((f) => (
                    <li key={f.id} className="flex items-center gap-3 py-2.5">
                      <FileIcon mimeType={f.mimeType} />
                      <span className="min-w-0 flex-1 truncate text-[14px] text-ink">{f.name}</span>
                      <span className="shrink-0 text-[12px] text-ink-3">{formatBytes(f.sizeBytes)}</span>
                      <a href={downloadUrl(f.versionId)} className="inline-flex items-center gap-1 text-[13px] font-medium text-accent hover:underline">
                        <Download className="size-3.5" aria-hidden /> {t('download')}
                        <span className="sr-only">: {f.name}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="flex items-center gap-2 text-[13px] text-ink-3">
                  <Paperclip className="size-4" aria-hidden /> {t('noAttachments')}
                </p>
              )}
              {!preview ? <RequestAttachments org={org} requestId={r.id} /> : null}
            </div>
          </PortalCard>

          <PortalCard>
            <PortalCardHeader title={t('conversation')} description={t('conversationHint', { org: actor.orgName })} />
            <div className="px-5 py-5">
              <CommentThread
                org={org}
                parent={{ type: 'request', id: r.id }}
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
            <PortalCardHeader title={t('timeline')} />
            <div className="px-5 py-4">
              <PortalFacts
                items={[
                  { label: t('sent'), value: <FormattedDate date={r.createdAt} withTime /> },
                  ...(detail.project ? [{ label: t('project'), value: detail.project.portalEnabled ? <Link href={`${base}/projects/${detail.project.key}`} className="text-accent hover:underline">{detail.project.name}</Link> : detail.project.name }] : []),
                  ...(detail.convertedTask ? [{ label: t('linkedTask'), value: `${detail.convertedTask.projectKey}-${detail.convertedTask.number} · ${detail.convertedTask.title}` }] : []),
                  ...(r.closureReason ? [{ label: t('closureReason'), value: r.closureReason }] : []),
                  ...(detail.duplicateOf ? [{ label: t('duplicateOf', { number: detail.duplicateOf.number }), value: detail.duplicateOf.title }] : []),
                ]}
              />
              {timeline.length ? (
                <ol className="mt-5 flex flex-col gap-3 border-t border-line pt-4">
                  {timeline.map((e) => (
                    <li key={e.id} className="flex flex-col gap-0.5">
                      <span className="text-[13px] text-ink">
                        <span className="font-medium">{e.actorName ?? actor.orgName}</span> {e.summary}
                      </span>
                      <RelativeTime date={e.createdAt} className="text-[12px] text-ink-3" />
                    </li>
                  ))}
                </ol>
              ) : null}
            </div>
          </PortalCard>
        </aside>
      </div>
    </div>
  );
}
