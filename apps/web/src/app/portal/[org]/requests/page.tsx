import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Inbox, MessageSquarePlus } from 'lucide-react';
import { listRequests } from '@orqivanta/core';
import { RequestStatusBadge } from '@/components/domain/badges';
import { RelativeTime } from '@/components/domain/dates';
import { PortalCard, PortalEmpty, PortalPageHeader } from '@/components/portal/portal-ui';
import { requirePortal } from '@/components/portal/portal-session';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';

const VIEWS = ['open', 'closed', 'all'] as const;
type View = (typeof VIEWS)[number];

export async function generateMetadata() {
  const t = await getTranslations('portal.requests');
  return { title: t('title') };
}

export default async function PortalRequestsPage({ params, searchParams }: { params: Promise<{ org: string }>; searchParams: Promise<{ view?: string }> }) {
  const { org } = await params;
  const { view: raw } = await searchParams;
  const view: View = (VIEWS as readonly string[]).includes(raw ?? '') ? (raw as View) : 'open';
  const { viewer, preview } = await requirePortal(org);
  const t = await getTranslations('portal.requests');
  const base = `/portal/${org}`;
  const requests = await listRequests(viewer, { view });
  const anyRequests = view === 'all' ? requests.length > 0 : (await listRequests(viewer, { view: 'all' })).length > 0;

  return (
    <div className="mx-auto max-w-[1120px] px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <PortalPageHeader
        title={t('title')}
        description={t('intro')}
        action={
          !preview ? (
            <Button variant="primary" asChild>
              <Link href={`${base}/requests/new`}>
                <MessageSquarePlus /> {t('new')}
              </Link>
            </Button>
          ) : null
        }
      />

      <nav aria-label={t('title')} className="mt-8 flex gap-1 border-b border-line">
        {VIEWS.map((v) => (
          <Link
            key={v}
            href={v === 'open' ? `${base}/requests` : `${base}/requests?view=${v}`}
            aria-current={view === v ? 'page' : undefined}
            className={cn('-mb-px inline-flex items-center border-b-2 px-3 pb-2.5 text-[14px] font-medium transition-colors', view === v ? 'border-accent text-ink' : 'border-transparent text-ink-3 hover:text-ink')}
          >
            {t(`filters.${v}`)}
          </Link>
        ))}
      </nav>

      <PortalCard className="mt-6">
        {requests.length ? (
          <ul className="divide-y divide-line">
            {requests.map((r) => (
              <li key={r.id}>
                <Link href={`${base}/requests/${r.number}`} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 hover:bg-surface-2">
                  <span className="min-w-0 flex-1 basis-full sm:basis-0">
                    <span className="block text-[15px] font-medium text-ink">{r.title}</span>
                    <span className="mt-0.5 block text-[12px] text-ink-3">
                      #{r.number} · {t('sent')} <RelativeTime date={r.createdAt} />
                      {r.projectName ? ` · ${r.projectName}` : ''}
                      {r.commentCount ? ` · ${t('replies', { count: r.commentCount })}` : ''}
                    </span>
                  </span>
                  <RequestStatusBadge status={r.status} client />
                  <RelativeTime date={r.updatedAt} className="text-[12px] text-ink-3" />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <PortalEmpty
            icon={<Inbox />}
            title={anyRequests ? t('emptyFiltered') : t('empty')}
            description={anyRequests ? undefined : t('emptyHint')}
            action={
              anyRequests ? (
                <Link href={`${base}/requests?view=all`} className="text-[13px] font-medium text-accent hover:underline">
                  {t('filters.all')}
                </Link>
              ) : !preview ? (
                <Button variant="primary" asChild>
                  <Link href={`${base}/requests/new`}>
                    <MessageSquarePlus /> {t('new')}
                  </Link>
                </Button>
              ) : null
            }
          />
        )}
      </PortalCard>
    </div>
  );
}
