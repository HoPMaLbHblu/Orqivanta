import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Inbox, MessageSquare, Plus, SearchX } from 'lucide-react';
import { canOrg, CLOSED_REQUEST_STATUSES, listRequests, OPEN_REQUEST_STATUSES, type RequestStatus } from '@orqivanta/core';
import { Avatar } from '@/components/domain/avatar';
import { RequestStatusBadge, SampleDataBadge } from '@/components/domain/badges';
import { RelativeTime } from '@/components/domain/dates';
import { SearchForm, ViewTabs } from '@/components/requests/view-tabs';
import { LinkButton } from '@/components/requests/link-button';
import { Card, EmptyState, Mono, PageHeader } from '@/components/ui/primitives';
import { requireActor } from '@/lib/session';

export async function generateMetadata() {
  const t = await getTranslations('requests');
  return { title: t('title') };
}

const VIEWS = ['open', 'mine', 'submitted', 'needs_info', 'in_review', 'closed', 'all'] as const;
type View = (typeof VIEWS)[number];

type Row = Awaited<ReturnType<typeof listRequests>>[number];

function matches(view: View, r: Row, userId: string) {
  const status = r.status as RequestStatus;
  switch (view) {
    case 'open':
      return OPEN_REQUEST_STATUSES.includes(status);
    case 'mine':
      return r.ownerId === userId && OPEN_REQUEST_STATUSES.includes(status);
    case 'closed':
      return CLOSED_REQUEST_STATUSES.includes(status);
    case 'all':
      return true;
    default:
      return status === view;
  }
}

export default async function RequestsPage({ params, searchParams }: { params: Promise<{ org: string }>; searchParams: Promise<{ view?: string; q?: string; new?: string }> }) {
  const { org } = await params;
  const sp = await searchParams;
  if (sp.new) redirect(`/${org}/requests/new`);
  const actor = await requireActor(org);
  if (!canOrg(actor.role, 'requests.triage')) notFound();
  const t = await getTranslations('requests');
  const view: View = VIEWS.includes(sp.view as View) ? (sp.view as View) : 'open';
  const q = sp.q?.trim().slice(0, 100) || undefined;
  const all = await listRequests(actor, { view: 'all', q });
  const rows = all.filter((r) => matches(view, r, actor.userId));
  const base = `/${org}/requests`;
  const hrefFor = (v: View) => {
    const s = new URLSearchParams();
    if (v !== 'open') s.set('view', v);
    if (q) s.set('q', q);
    return s.size ? `${base}?${s}` : base;
  };
  const anyAtAll = all.length > 0 || Boolean(q);

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6 lg:px-10">
      <PageHeader
        title={t('title')}
        description={t('description')}
        actions={
          <>
            {actor.isDemo ? <SampleDataBadge /> : null}
            <LinkButton href={`${base}/new`} variant="primary" size="sm">
              <Plus /> {t('new')}
            </LinkButton>
          </>
        }
      />

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <ViewTabs
          label={t('views.label')}
          className="min-w-0 flex-1"
          items={VIEWS.map((v) => ({ href: hrefFor(v), label: t(`views.${v}`), active: v === view, count: v === 'all' || v === 'closed' ? undefined : all.filter((r) => matches(v, r, actor.userId)).length, attention: v === 'submitted' }))}
        />
        <div className="sm:pb-1.5">
          <SearchForm action={base} q={q} view={view === 'open' ? undefined : view} label={t('search')} placeholder={t('searchPlaceholder')} />
        </div>
      </div>

      <Card className="mt-4 overflow-hidden">
        {rows.length ? (
          <>
            <div className="hidden grid-cols-[64px_minmax(0,1fr)_160px_130px_90px] gap-3 border-b border-line bg-surface-2 px-4 py-2 text-[12px] font-medium text-ink-3 md:grid" aria-hidden>
              <span>{t('columns.number')}</span>
              <span>{t('columns.request')}</span>
              <span>{t('columns.client')}</span>
              <span>{t('columns.status')}</span>
              <span className="text-right">{t('columns.age')}</span>
            </div>
            <ul className="divide-y divide-line">
              {rows.map((r) => (
                <li key={r.id}>
                  <Link href={`${base}/${r.number}`} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1.5 px-4 py-2.5 hover:bg-surface-2 md:grid-cols-[64px_minmax(0,1fr)_160px_130px_90px] md:items-center">
                    <Mono className="hidden md:block">#{r.number}</Mono>
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        <Mono className="md:hidden">#{r.number}</Mono>
                        <span className="truncate text-[13px] font-medium text-ink">{r.title}</span>
                      </span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12px] text-ink-3">
                        {r.formName ? <span>{r.formName}</span> : null}
                        {r.category ? <span>· {r.category}</span> : null}
                        {r.projectKey ? <span>· {r.projectKey}</span> : null}
                        {r.commentCount ? (
                          <span className="inline-flex items-center gap-0.5">
                            · <MessageSquare className="size-3" aria-hidden /> <span className="sr-only">{t('comments')}</span>
                            {r.commentCount}
                          </span>
                        ) : null}
                      </span>
                    </span>
                    <span className="col-start-1 flex min-w-0 items-center gap-2 text-[13px] text-ink-2 md:col-start-auto">
                      <span className="truncate">{r.clientName ?? <span className="text-ink-3">{t('internalRequest')}</span>}</span>
                    </span>
                    <span className="col-start-2 row-start-1 md:col-start-auto md:row-start-auto">
                      <RequestStatusBadge status={r.status as RequestStatus} />
                    </span>
                    <span className="col-start-2 row-start-2 flex items-center justify-end gap-2 text-[12px] text-ink-3 md:col-start-auto md:row-start-auto">
                      {r.ownerName ? <Avatar name={r.ownerName} size="xs" title={t('ownedBy', { name: r.ownerName })} /> : null}
                      <RelativeTime date={r.createdAt} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        ) : anyAtAll && (q || all.length) ? (
          <EmptyState
            icon={<SearchX />}
            title={q ? t('emptyFiltered', { q }) : t(`emptyView.${view}`)}
            description={q ? t('emptyFilteredHint') : undefined}
            action={
              q ? (
                <Link href={view === 'open' ? base : `${base}?view=${view}`} className="text-[13px] font-medium text-accent hover:underline">
                  {t('clearSearch')}
                </Link>
              ) : null
            }
          />
        ) : (
          <EmptyState
            icon={<Inbox />}
            title={t('emptyTitle')}
            description={t('emptyHint')}
            action={
              <LinkButton href={`${base}/new`} variant="primary" size="sm">
                <Plus /> {t('new')}
              </LinkButton>
            }
          />
        )}
      </Card>
    </div>
  );
}
