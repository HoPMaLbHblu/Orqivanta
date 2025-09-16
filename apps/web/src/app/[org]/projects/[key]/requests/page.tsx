import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Inbox } from 'lucide-react';
import { listProjectRequests } from '@orqivanta/core';
import { RequestStatusBadge } from '@/components/domain/badges';
import { RelativeTime } from '@/components/domain/dates';
import { loadProject } from '@/components/projects/load';
import { Card, CardHeader, EmptyState, Mono } from '@/components/ui/primitives';

export async function generateMetadata({ params }: { params: Promise<{ org: string; key: string }> }) {
  const { org, key } = await params;
  const [{ project }, t] = await Promise.all([loadProject(org, key), getTranslations('projects')]);
  return { title: `${t('tabs.requests')} · ${project.name}` };
}

export default async function ProjectRequestsPage({ params }: { params: Promise<{ org: string; key: string }> }) {
  const { org, key } = await params;
  const { actor, project } = await loadProject(org, key);
  const t = await getTranslations('projects');
  const requests = await listProjectRequests(actor, project.id);
  return (
    <Card className="max-w-3xl">
      <CardHeader title={t('requests.title')} description={t('requests.hint')} />
      {requests.length ? (
        <ul className="divide-y divide-line">
          {requests.map((r) => (
            <li key={r.id}>
              <Link href={`/${org}/requests/${r.number}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2">
                <Mono className="w-12 shrink-0">#{r.number}</Mono>
                <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{r.title}</span>
                <RequestStatusBadge status={r.status} />
                <span className="hidden text-[12px] text-ink-3 sm:block">
                  <RelativeTime date={r.createdAt} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState compact icon={<Inbox />} title={t('requests.empty')} description={t('requests.emptyBody')} />
      )}
    </Card>
  );
}
