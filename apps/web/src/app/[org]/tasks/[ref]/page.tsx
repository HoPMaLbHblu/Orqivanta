import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { parseTaskRef, recordView } from '@orqivanta/core';
import { loadTaskDetail } from '@/components/tasks/load';
import { TaskDetailPanel } from '@/components/tasks/task-detail-panel';
import { Notice } from '@/components/ui/primitives';
import { requireActor } from '@/lib/session';

export async function generateMetadata({ params }: { params: Promise<{ org: string; ref: string }> }) {
  const { org, ref } = await params;
  const actor = await requireActor(org);
  const data = await loadTaskDetail(actor, ref);
  if (!data) return {};
  return { title: `${data.detail.ref} ${data.detail.task.title}` };
}

export default async function TaskPage({ params }: { params: Promise<{ org: string; ref: string }> }) {
  const { org, ref } = await params;
  if (!parseTaskRef(ref)) notFound();
  const actor = await requireActor(org);
  const data = await loadTaskDetail(actor, ref);
  if (!data) notFound();
  const t = await getTranslations('tasks');
  await recordView(actor, 'task', data.detail.task.id);

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-6 sm:px-6 lg:px-10">
      <nav aria-label={t('breadcrumb')} className="mb-3 text-[12px] text-ink-3">
        <Link href={`/${org}/projects`} className="hover:text-ink hover:underline">
          {t('projects')}
        </Link>
        <span aria-hidden className="mx-1.5">/</span>
        <Link href={`/${org}/projects/${data.detail.project.key}/tasks`} className="hover:text-ink hover:underline">
          {data.detail.project.name}
        </Link>
      </nav>
      {data.detail.task.deletedAt ? (
        <Notice tone="attention" className="mb-4">
          {t('deletedNotice')}
        </Notice>
      ) : null}
      {/* The same component renders the side panel, so both stay identical. */}
      <TaskDetailPanel org={org} actor={actor} taskRef={ref} variant="page" />
    </div>
  );
}
