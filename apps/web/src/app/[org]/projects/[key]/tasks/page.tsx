import { getTranslations } from 'next-intl/server';
import { getTaskFormContext, listSavedViews, listStatuses, listTasks, parseTaskRef } from '@orqivanta/core';
import { loadProject } from '@/components/projects/load';
import { parseTaskQuery, toCoreFilter } from '@/components/tasks/filters';
import { TaskDetailPanel } from '@/components/tasks/task-detail-panel';
import { TaskWorkspace } from '@/components/tasks/task-workspace';

export async function generateMetadata({ params }: { params: Promise<{ org: string; key: string }> }) {
  const { org, key } = await params;
  const [{ project }, t] = await Promise.all([loadProject(org, key), getTranslations('tasks')]);
  return { title: `${t('title')} · ${project.name}` };
}

export default async function ProjectTasksPage({ params, searchParams }: { params: Promise<{ org: string; key: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { org, key } = await params;
  const sp = await searchParams;
  const { actor, project, can, role } = await loadProject(org, key);
  const query = parseTaskQuery(sp);
  const layout = (Array.isArray(sp.view) ? sp.view[0] : sp.view) === 'board' ? 'board' : 'list';
  const taskParam = Array.isArray(sp.task) ? sp.task[0] : sp.task;
  const activeRef = taskParam && parseTaskRef(taskParam) ? taskParam.toUpperCase() : null;

  const [result, statuses, context, views] = await Promise.all([
    listTasks(actor, toCoreFilter(query, project.id)),
    listStatuses(actor, project.id),
    getTaskFormContext(actor, project.id),
    role === 'client' ? Promise.resolve([]) : listSavedViews(actor, project.id),
  ]);

  return (
    <TaskWorkspace
      org={org}
      projectId={project.id}
      layout={layout}
      query={query}
      tasks={result.tasks.map((tk) => ({ ...tk, statusCategory: tk.statusCategory as never }))}
      statuses={statuses.map((s) => ({ id: s.id, name: s.name, category: s.category, position: s.position }))}
      context={{ people: context.people.map((p) => ({ id: p.id, name: p.name, avatarColor: p.avatarColor })), labels: context.labels, milestones: context.milestones.map((m) => ({ id: m.id, name: m.name })) }}
      savedViews={views.map((v) => ({ id: v.id, name: v.name, layout: v.layout as 'list' | 'board', query: v.query, shared: v.shared, mine: v.userId === actor.userId }))}
      canEdit={can.editTask}
      canCreate={can.createTask}
      canSaveViews={role !== 'client'}
      truncated={result.truncated}
      activeRef={activeRef}
    >
      {activeRef ? <TaskDetailPanel org={org} actor={actor} taskRef={activeRef} /> : null}
    </TaskWorkspace>
  );
}
