import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Stamp } from 'lucide-react';
import { listApprovals } from '@orqivanta/core';
import { ApprovalStatusBadge } from '@/components/domain/badges';
import { DueDate } from '@/components/domain/dates';
import { loadProject } from '@/components/projects/load';
import { Card, CardHeader, EmptyState } from '@/components/ui/primitives';

export async function generateMetadata({ params }: { params: Promise<{ org: string; key: string }> }) {
  const { org, key } = await params;
  const [{ project }, t] = await Promise.all([loadProject(org, key), getTranslations('projects')]);
  return { title: `${t('tabs.approvals')} · ${project.name}` };
}

export default async function ProjectApprovalsPage({ params }: { params: Promise<{ org: string; key: string }> }) {
  const { org, key } = await params;
  const { actor, project } = await loadProject(org, key);
  const t = await getTranslations('projects');
  const approvals = await listApprovals(actor, { projectId: project.id, view: 'all' });
  return (
    <Card className="max-w-3xl">
      <CardHeader title={t('approvals.title')} description={t('approvals.hint')} />
      {approvals.length ? (
        <ul className="divide-y divide-line">
          {approvals.map((a) => (
            <li key={a.id}>
              <Link href={`/${org}/approvals/${a.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 hover:bg-surface-2">
                <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{a.title}</span>
                {a.subjectName ? <span className="truncate text-[12px] text-ink-3">{a.subjectName}</span> : null}
                <span className="text-[12px] tabular-nums text-ink-3">{t('approvals.decided', { decided: a.decidedCount, total: a.reviewerCount })}</span>
                <ApprovalStatusBadge status={a.status} />
                {a.dueDate ? <DueDate date={a.dueDate} done={a.status !== 'pending'} short /> : null}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState compact icon={<Stamp />} title={t('approvals.empty')} description={t('approvals.emptyBody')} />
      )}
    </Card>
  );
}
