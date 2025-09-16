import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Building2, ExternalLink, FolderKanban, Inbox, Stamp, Users } from 'lucide-react';
import { canOrg, listClients } from '@orqivanta/core';
import { SampleDataBadge } from '@/components/domain/badges';
import { ClientsToolbar } from '@/components/clients/clients-toolbar';
import { Card, EmptyState, PageHeader } from '@/components/ui/primitives';
import { requireActor } from '@/lib/session';

export async function generateMetadata() {
  const t = await getTranslations('clients');
  return { title: t('title') };
}

export default async function ClientsPage({ params, searchParams }: { params: Promise<{ org: string }>; searchParams: Promise<{ archived?: string }> }) {
  const { org } = await params;
  const sp = await searchParams;
  const actor = await requireActor(org);
  if (!canOrg(actor.role, 'clients.view')) notFound();
  const t = await getTranslations('clients');
  const showArchived = sp.archived === '1';
  const all = await listClients(actor, { includeArchived: true });
  const rows = all.filter((c) => (showArchived ? true : !c.archivedAt));
  const canManage = canOrg(actor.role, 'clients.manage');
  const base = `/${org}/clients`;

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-8 sm:px-6 lg:px-10">
      <PageHeader title={t('title')} description={t('description')} actions={actor.isDemo ? <SampleDataBadge /> : null} />

      <ClientsToolbar org={org} canManage={canManage} showArchived={showArchived} archivedCount={all.filter((c) => c.archivedAt).length} />

      {rows.length ? (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {rows.map((c) => (
            <li key={c.id}>
              <Card className="h-full transition-colors hover:border-line-strong">
                <div className="flex flex-col gap-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <Link href={`${base}/${c.id}`} className="min-w-0 text-[15px] font-medium text-ink hover:underline">
                      {c.name}
                    </Link>
                    {c.archivedAt ? <span className="shrink-0 rounded-full border border-line px-2 text-[11px] text-ink-3">{t('archived')}</span> : null}
                  </div>
                  {c.website ? (
                    <a href={c.website} target="_blank" rel="noopener noreferrer" className="inline-flex w-fit items-center gap-1 text-[12px] text-ink-3 hover:text-ink">
                      {c.website.replace(/^https?:\/\//, '')} <ExternalLink className="size-3" aria-hidden />
                    </a>
                  ) : null}
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[12px] text-ink-3 sm:grid-cols-4">
                    <div>
                      <dt className="flex items-center gap-1">
                        <Users className="size-3.5" aria-hidden /> {t('contacts')}
                      </dt>
                      <dd className="mt-0.5 text-[14px] tabular-nums text-ink">{c.contactCount}</dd>
                    </div>
                    <div>
                      <dt className="flex items-center gap-1">
                        <FolderKanban className="size-3.5" aria-hidden /> {t('projects')}
                      </dt>
                      <dd className="mt-0.5 text-[14px] tabular-nums text-ink">{c.projectCount}</dd>
                    </div>
                    <div>
                      <dt className="flex items-center gap-1">
                        <Inbox className="size-3.5" aria-hidden /> {t('openRequests')}
                      </dt>
                      <dd className="mt-0.5 text-[14px] tabular-nums text-ink">{c.openRequestCount}</dd>
                    </div>
                    <div>
                      <dt className="flex items-center gap-1">
                        <Stamp className="size-3.5" aria-hidden /> {t('pendingApprovals')}
                      </dt>
                      <dd className="mt-0.5 text-[14px] tabular-nums text-ink">{c.pendingApprovalCount}</dd>
                    </div>
                  </dl>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <Card className="mt-4">
          <EmptyState
            icon={<Building2 />}
            title={all.length ? t('emptyFiltered') : t('emptyTitle')}
            description={all.length ? t('emptyFilteredHint') : canManage ? t('emptyHint') : t('emptyHintViewer')}
          />
        </Card>
      )}
    </div>
  );
}
