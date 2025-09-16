import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { ArrowUpRight, ChevronLeft, CircleCheck, Copy, FolderKanban, Paperclip, SquareCheck } from 'lucide-react';
import { AppError, CLOSED_REQUEST_STATUSES, getRequestByNumber, listComments, listEntityTimeline, listPeople, listProjects, PROJECT_TEMPLATES, type RequestStatus } from '@orqivanta/core';
import { CommentThread } from '@/components/comments/thread';
import { ActivityList } from '@/components/domain/activity-list';
import { Avatar } from '@/components/domain/avatar';
import { PriorityIcon, RequestStatusBadge, type Priority } from '@/components/domain/badges';
import { FormattedDate, RelativeTime } from '@/components/domain/dates';
import { ConvertPanel, DuplicatePanel, PropertiesPanel, TriagePanel } from '@/components/requests/request-actions';
import { RequestAnswers } from '@/components/requests/answers';
import { Card, CardHeader, Mono, Notice } from '@/components/ui/primitives';
import { requireActor } from '@/lib/session';

async function load(org: string, number: string) {
  const n = Number(number);
  if (!Number.isInteger(n) || n < 1 || n > 1e9) notFound();
  const actor = await requireActor(org);
  try {
    return { actor, data: await getRequestByNumber(actor, n) };
  } catch (err) {
    if (err instanceof AppError && (err.code === 'NOT_FOUND' || err.code === 'FORBIDDEN')) notFound();
    throw err;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ org: string; number: string }> }) {
  const { org, number } = await params;
  const { data } = await load(org, number);
  return { title: `#${data.request.number} ${data.request.title}` };
}

export default async function RequestPage({ params }: { params: Promise<{ org: string; number: string }> }) {
  const { org, number } = await params;
  const { actor, data } = await load(org, number);
  const t = await getTranslations('requests');
  const r = data.request;
  const [thread, timeline, people, projects] = await Promise.all([
    listComments(actor, { type: 'request', id: r.id }),
    listEntityTimeline(actor, { type: 'request', id: r.id }),
    listPeople(actor),
    listProjects(actor, { status: 'active' }),
  ]);
  const status = r.status as RequestStatus;
  const closed = CLOSED_REQUEST_STATUSES.includes(status);
  const internalPeople = people.filter((p) => p.role !== 'client');
  const mentionable = people.filter((p) => p.role !== 'client' || (r.clientAccountId && p.clientAccountId === r.clientAccountId)).map((p) => ({ id: p.id, name: p.name, color: p.avatarColor }));
  const projectOptions = projects.filter((p) => !r.clientAccountId || !p.clientAccountId || p.clientAccountId === r.clientAccountId).map((p) => ({ id: p.id, key: p.key, name: p.name, clientAccountId: p.clientAccountId }));
  const base = `/${org}`;

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6 lg:px-10">
      <Link href={`${base}/requests`} className="inline-flex items-center gap-1 text-[13px] text-ink-3 hover:text-ink">
        <ChevronLeft className="size-4" aria-hidden /> {t('backToRequests')}
      </Link>

      <header className="mt-3 flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Mono className="text-[13px]">#{r.number}</Mono>
          <RequestStatusBadge status={status} />
          {r.priority !== 'none' ? <PriorityIcon priority={r.priority as Priority} withLabel /> : null}
        </div>
        <h1 className="text-[22px] leading-snug font-semibold tracking-[-0.01em] text-ink">{r.title}</h1>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-ink-3">
          {data.client ? (
            <Link href={`${base}/clients/${data.client.id}`} className="font-medium text-ink-2 hover:text-ink hover:underline">
              {data.client.name}
            </Link>
          ) : (
            <span>{t('internalRequest')}</span>
          )}
          <span aria-hidden>·</span>
          <span className="inline-flex items-center gap-1.5">
            {data.submittedBy ? <Avatar name={data.submittedBy.name} color={data.submittedBy.avatarColor} size="xs" title="" /> : null}
            {t('submittedBy', { name: data.submittedBy?.name ?? t('formerMember') })}
          </span>
          <RelativeTime date={r.createdAt} />
          {data.form ? (
            <>
              <span aria-hidden>·</span>
              <span>{t('viaForm', { name: data.form.name })}</span>
            </>
          ) : null}
        </p>
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-6">
          {data.duplicateOf ? (
            <Notice tone="neutral" icon={<Copy />}>
              {t.rich('duplicateOf', {
                link: () => (
                  <Link className="font-medium text-accent hover:underline" href={`${base}/requests/${data.duplicateOf!.number}`}>
                    #{data.duplicateOf!.number} {data.duplicateOf!.title}
                  </Link>
                ),
              })}
            </Notice>
          ) : closed && r.closureReason ? (
            <Notice tone={status === 'declined' ? 'neutral' : 'success'} icon={<CircleCheck />}>
              <span className="font-medium">{t('closureReason')}:</span> {r.closureReason}
            </Notice>
          ) : null}

          {data.convertedTask || data.convertedProject ? (
            <Notice tone="info" icon={data.convertedTask ? <SquareCheck /> : <FolderKanban />}>
              {data.convertedTask ? (
                <Link href={`${base}/tasks/${data.convertedTask.projectKey}-${data.convertedTask.number}`} className="inline-flex items-center gap-1 hover:underline">
                  {t('convertedToTask')} <span className="font-mono text-[12px]">{`${data.convertedTask.projectKey}-${data.convertedTask.number}`}</span> {data.convertedTask.title}
                  <ArrowUpRight className="size-3.5" aria-hidden />
                </Link>
              ) : (
                <Link href={`${base}/projects/${data.convertedProject!.key}`} className="inline-flex items-center gap-1 hover:underline">
                  {t('convertedToProject', { name: data.convertedProject!.name })}
                  <ArrowUpRight className="size-3.5" aria-hidden />
                </Link>
              )}
            </Notice>
          ) : null}

          <Card>
            <CardHeader title={t('detailsTitle')} />
            <div className="flex flex-col gap-4 px-4 py-4">
              {r.details ? <p className="text-[14px] leading-relaxed whitespace-pre-wrap text-ink">{r.details}</p> : <p className="text-[13px] text-ink-3">{t('noDetails')}</p>}
              <RequestAnswers fields={data.form?.fields ?? []} answers={r.answers as Record<string, unknown>} />
              {r.dueDate ? (
                <p className="text-[13px] text-ink-2">
                  <span className="text-ink-3">{t('neededBy')}:</span> <FormattedDate date={r.dueDate} />
                </p>
              ) : null}
            </div>
            {data.attachments.length ? (
              <div className="border-t border-line px-4 py-3">
                <h3 className="mb-2 text-[12px] font-medium text-ink-3">{t('attachments')}</h3>
                <ul className="flex flex-col gap-1">
                  {data.attachments.map((f) => (
                    <li key={f.id}>
                      <Link href={`${base}/files/${f.id}`} className="inline-flex items-center gap-1.5 text-[13px] text-accent hover:underline">
                        <Paperclip className="size-3.5" aria-hidden /> {f.name}
                        {f.currentVersion > 1 ? <span className="text-ink-3">v{f.currentVersion}</span> : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Card>

          <Card className="p-4">
            <p className="mb-4 -mt-1 text-[12px] text-ink-3">{r.clientAccountId ? t('threadHintClient') : t('threadHintInternal')}</p>
            <CommentThread
              org={org}
              parent={{ type: 'request', id: r.id }}
              comments={thread.comments}
              context={thread.context}
              people={mentionable}
              currentUserId={actor.userId}
              isAdmin={actor.role === 'owner' || actor.role === 'admin'}
              title={t('threadTitle')}
            />
          </Card>

          <Card>
            <CardHeader title={t('timelineTitle')} />
            <div className="px-4">
              <ActivityList items={timeline.filter((e) => e.verb !== 'commented')} orgSlug={org} showProject={false} emptyLabel={t('timelineEmpty')} />
            </div>
          </Card>
        </div>

        {data.access.canTriage ? (
          <aside className="flex flex-col gap-4" aria-label={t('triageLabel')}>
            <TriagePanel org={org} request={{ id: r.id, version: r.version, status, hasClient: Boolean(r.clientAccountId), converted: Boolean(data.convertedTask || data.convertedProject) }} />
            <PropertiesPanel
              org={org}
              request={{ id: r.id, version: r.version, ownerId: r.ownerId, priority: r.priority as Priority, dueDate: r.dueDate, projectId: r.projectId }}
              people={internalPeople.map((p) => ({ id: p.id, name: p.name }))}
              projects={projectOptions}
              currentProject={data.project}
            />
            {!closed || data.convertedTask || data.convertedProject ? (
              <ConvertPanel
                org={org}
                request={{ id: r.id, title: r.title, dueDate: r.dueDate, projectId: r.projectId, hasClient: Boolean(r.clientAccountId), ownerId: r.ownerId }}
                convertedTask={data.convertedTask ? { ref: `${data.convertedTask.projectKey}-${data.convertedTask.number}`, title: data.convertedTask.title } : null}
                convertedProject={data.convertedProject}
                closed={closed}
                projects={projectOptions}
                people={internalPeople.map((p) => ({ id: p.id, name: p.name }))}
                templates={PROJECT_TEMPLATES.map((tpl) => ({ id: tpl.id, name: tpl.name }))}
              />
            ) : null}
            {status !== 'duplicate' ? <DuplicatePanel org={org} request={{ id: r.id, number: r.number }} similar={data.similar.map((s) => ({ id: s.id, number: s.number, title: s.title, status: s.status as RequestStatus }))} /> : null}
          </aside>
        ) : null}
      </div>
    </div>
  );
}
