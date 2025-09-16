import { getTranslations } from 'next-intl/server';
import { getMyWorkCounts, listStatuses, listTasks } from '@orqivanta/core';
import { SampleDataBadge } from '@/components/domain/badges';
import { MyWorkView } from '@/components/tasks/my-work-view';
import { PageHeader } from '@/components/ui/primitives';
import { requireActor } from '@/lib/session';
import type { StatusOption } from '@/components/tasks/types';

export async function generateMetadata() {
  const t = await getTranslations('myWork');
  return { title: t('title') };
}

export default async function MyWorkPage({ params, searchParams }: { params: Promise<{ org: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { org } = await params;
  const sp = await searchParams;
  const actor = await requireActor(org);
  const t = await getTranslations('myWork');
  const dueParam = Array.isArray(sp.due) ? sp.due[0] : sp.due;
  const due = dueParam === 'overdue' || dueParam === 'week' || dueParam === 'today' ? dueParam : undefined;
  const scope = (Array.isArray(sp.scope) ? sp.scope[0] : sp.scope) === 'watching' ? 'watching' : 'assigned';

  const [counts, result] = await Promise.all([
    getMyWorkCounts(actor),
    listTasks(actor, {
      assignee: scope === 'assigned' ? 'me' : undefined,
      watching: scope === 'watching' ? true : undefined,
      categories: ['backlog', 'unstarted', 'started', 'review'],
      due,
      sort: 'due',
      limit: 300,
    }),
  ]);

  const projectIds = [...new Set(result.tasks.map((tk) => tk.projectId))];
  const statusLists = await Promise.all(projectIds.map((id) => listStatuses(actor, id)));
  const statusesByProject: Record<string, StatusOption[]> = {};
  projectIds.forEach((id, i) => {
    statusesByProject[id] = (statusLists[i] ?? []).map((s) => ({ id: s.id, name: s.name, category: s.category, position: s.position }));
  });

  return (
    <div className="mx-auto max-w-[1000px] px-4 py-8 sm:px-6 lg:px-10">
      <PageHeader title={t('title')} description={t('description')} actions={actor.isDemo ? <SampleDataBadge /> : null} />
      <MyWorkView
        org={org}
        tasks={result.tasks.map((tk) => ({ ...tk, statusCategory: tk.statusCategory as never }))}
        statusesByProject={statusesByProject}
        counts={{ assigned: counts.assigned, overdue: counts.overdue, dueThisWeek: counts.dueThisWeek, watching: counts.watching }}
        due={due ?? null}
        scope={scope}
        truncated={result.truncated}
      />
    </div>
  );
}
