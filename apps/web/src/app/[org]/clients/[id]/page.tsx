import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { ChevronLeft, ExternalLink, FolderKanban, Inbox, Lock, Stamp, UserRound } from 'lucide-react';
import { AppError, canOrg, getClient } from '@orqivanta/core';
import { RequestStatusBadge, SampleDataBadge, type RequestStatus } from '@/components/domain/badges';
import { Avatar } from '@/components/domain/avatar';
import { DueDate, FormattedDate, RelativeTime } from '@/components/domain/dates';
import { ClientHeaderActions } from '@/components/clients/client-header-actions';
import { InviteContactPanel } from '@/components/clients/invite-contact';
import { Card, CardHeader, EmptyState, Mono, Notice } from '@/components/ui/primitives';
import { requireActor } from '@/lib/session';

async function load(org: string, id: string) {
  const actor = await requireActor(org);
  if (!canOrg(actor.role, 'clients.view') || !/^[0-9a-f-]{36}$/i.test(id)) notFound();
  try {
    return { actor, data: await getClient(actor, id) };
  } catch (err) {
    if (err instanceof AppError && (err.code === 'NOT_FOUND' || err.code === 'FORBIDDEN')) notFound();
    throw err;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ org: string; id: string }> }) {
  const { org, id } = await params;
  const { data } = await load(org, id);
  return { title: data.client.name };
}

export default async function ClientPage({ params }: { params: Promise<{ org: string; id: string }> }) {
  const { org, id } = await params;
  const { actor, data } = await load(org, id);
  const t = await getTranslations('clients');
  const c = data.client;
  const base = `/${org}`;
  const portalProjects = data.projects.filter((p) => p.portalEnabled);
  const activeContacts = data.contacts.filter((x) => x.status === 'active');

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-8 sm:px-6 lg:px-10">
      <Link href={`${base}/clients`} className="inline-flex items-center gap-1 text-[13px] text-ink-3 hover:text-ink">
        <ChevronLeft className="size-4" aria-hidden /> {t('title')}
      </Link>

      <header className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[22px] font-semibold tracking-[-0.01em] text-ink">{c.name}</h1>
            {c.archivedAt ? <span className="rounded-full border border-line px-2 text-[11px] text-ink-3">{t('archived')}</span> : null}
            {actor.isDemo ? <SampleDataBadge /> : null}
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[13px] text-ink-3">
            {c.website ? (
              <a href={c.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-ink">
                {c.website.replace(/^https?:\/\//, '')} <ExternalLink className="size-3" aria-hidden />
              </a>
            ) : null}
            <span>
              {t('clientSince')} <FormattedDate date={c.createdAt} />
            </span>
          </p>
        </div>
        {data.canManage ? <ClientHeaderActions org={org} client={{ id: c.id, name: c.name, website: c.website, internalNotes: c.internalNotes, archived: Boolean(c.archivedAt) }} /> : null}
      </header>

      {c.archivedAt ? (
        <Notice className="mt-4" tone="neutral" icon={<Lock />}>
          {t('archivedNotice')}
        </Notice>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader title={t('contactsTitle')} description={t('contactsHint')} />
            {data.contacts.length || data.pendingInvites.length ? (
              <ul className="divide-y divide-line">
                {data.contacts.map((p) => (
                  <li key={p.membershipId} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                    <Avatar name={p.name} color={p.avatarColor} size="sm" title="" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-ink">{p.name}</span>
                      <span className="block truncate text-[12px] text-ink-3">{p.email}</span>
                    </span>
                    {p.title ? <span className="text-[12px] text-ink-3">{p.title}</span> : null}
                    <span className={p.status === 'active' ? 'text-[12px] text-success' : 'text-[12px] text-ink-3'}>{p.status === 'active' ? t('statusActive') : t('statusSuspended')}</span>
                  </li>
                ))}
                {data.pendingInvites.map((inv) => (
                  <li key={inv.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                    <span className="flex size-6 items-center justify-center rounded-full bg-surface-2 text-ink-3">
                      <UserRound className="size-3.5" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13px] text-ink-2">{inv.email}</span>
                    <span className="text-[12px] text-ink-3">
                      {t('inviteExpires')} <RelativeTime date={inv.expiresAt} />
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState compact icon={<UserRound />} title={t('noContacts')} description={t('noContactsHint')} />
            )}
          </Card>

          <Card>
            <CardHeader
              title={t('projectsTitle')}
              action={
                <Link href={`${base}/projects?client=${c.id}`} className="text-[12px] font-medium text-accent hover:underline">
                  {t('allProjects')}
                </Link>
              }
            />
            {data.projects.length ? (
              <ul className="divide-y divide-line">
                {data.projects.map((p) => (
                  <li key={p.id}>
                    <Link href={`${base}/projects/${p.key}`} className="flex flex-wrap items-center gap-3 px-4 py-2.5 hover:bg-surface-2">
                      <Mono className="w-12">{p.key}</Mono>
                      <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{p.name}</span>
                      {p.portalEnabled ? <span className="rounded-full bg-accent-soft px-2 text-[11px] font-medium text-accent">{t('portalOn')}</span> : null}
                      <DueDate date={p.dueDate} short />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState compact icon={<FolderKanban />} title={t('noProjects')} />
            )}
          </Card>

          <Card>
            <CardHeader
              title={t('openRequestsTitle')}
              action={
                <Link href={`${base}/requests?view=all`} className="text-[12px] font-medium text-accent hover:underline">
                  {t('allRequests')}
                </Link>
              }
            />
            {data.openRequests.length ? (
              <ul className="divide-y divide-line">
                {data.openRequests.map((r) => (
                  <li key={r.id}>
                    <Link href={`${base}/requests/${r.number}`} className="flex flex-wrap items-center gap-3 px-4 py-2.5 hover:bg-surface-2">
                      <Mono className="w-10">#{r.number}</Mono>
                      <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{r.title}</span>
                      <RequestStatusBadge status={r.status as RequestStatus} />
                      <RelativeTime date={r.createdAt} className="text-[12px] text-ink-3" />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState compact icon={<Inbox />} title={t('noRequests')} />
            )}
          </Card>
        </div>

        <aside className="flex flex-col gap-4" aria-label={t('sidebarLabel')}>
          {data.canManage ? <InviteContactPanel org={org} clientId={c.id} archived={Boolean(c.archivedAt)} /> : null}

          <Card>
            <CardHeader title={t('portalTitle')} description={t('portalHint')} />
            <dl className="flex flex-col gap-2 px-4 py-3 text-[13px]">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-ink-3">{t('portalContacts')}</dt>
                <dd className="tabular-nums text-ink">{activeContacts.length}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-ink-3">{t('portalProjects')}</dt>
                <dd className="tabular-nums text-ink">
                  {portalProjects.length} / {data.projects.length}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-ink-3">{t('waitingOnClient')}</dt>
                <dd className="tabular-nums text-ink">{data.waitingOnClient.length}</dd>
              </div>
            </dl>
            {data.waitingOnClient.length ? (
              <ul className="border-t border-line">
                {data.waitingOnClient.map((a) => (
                  <li key={a.id}>
                    <Link href={`${base}/approvals/${a.id}`} className="flex items-center gap-2 px-4 py-2 text-[13px] hover:bg-surface-2">
                      <Stamp className="size-3.5 text-attention" aria-hidden />
                      <span className="min-w-0 flex-1 truncate text-ink-2">{a.title}</span>
                      <DueDate date={a.dueDate} short />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
            {!portalProjects.length ? <p className="border-t border-line px-4 py-2 text-[12px] text-ink-3">{t('noPortalProjects')}</p> : null}
          </Card>

          <Card>
            <CardHeader title={t('notesTitle')} description={t('notesInternal')} />
            <div className="px-4 py-3">
              {c.internalNotes ? (
                <p className="text-[13px] leading-relaxed whitespace-pre-wrap text-ink">{c.internalNotes}</p>
              ) : (
                <p className="text-[13px] text-ink-3">{data.canManage ? t('notesEmptyManage') : t('notesEmpty')}</p>
              )}
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
