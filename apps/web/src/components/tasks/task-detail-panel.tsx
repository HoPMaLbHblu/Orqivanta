import { getTranslations } from 'next-intl/server';
import { SearchX } from 'lucide-react';
import { EmptyState } from '@/components/ui/primitives';
import type { OrgActor } from '@/lib/session';
import { loadTaskDetail } from './load';
import { TaskDetail } from './task-detail';

/** Loads a task and renders its detail view; used by the full page and by the side panel. */
export async function TaskDetailPanel({ org, actor, taskRef, variant = 'panel' }: { org: string; actor: OrgActor; taskRef: string; variant?: 'page' | 'panel' }) {
  const data = await loadTaskDetail(actor, taskRef);
  const t = await getTranslations('tasks');
  if (!data) return <EmptyState icon={<SearchX />} title={t('notFound.title')} description={t('notFound.body')} />;
  const { detail } = data;
  return (
    <TaskDetail
      org={org}
      variant={variant}
      data={{
        task: {
          id: detail.task.id,
          number: detail.task.number,
          title: detail.task.title,
          description: detail.task.description,
          statusId: detail.task.statusId,
          priority: detail.task.priority,
          assigneeId: detail.task.assigneeId,
          dueDate: detail.task.dueDate,
          startDate: detail.task.startDate,
          milestoneId: detail.task.milestoneId,
          sharedWithClient: detail.task.sharedWithClient,
          version: detail.task.version,
          archivedAt: detail.task.archivedAt,
          deletedAt: detail.task.deletedAt,
          createdAt: detail.task.createdAt,
          updatedAt: detail.task.updatedAt,
        },
        ref: detail.ref,
        project: detail.project,
        access: detail.access,
        status: { id: detail.status.id, name: detail.status.name, category: detail.status.category },
        statuses: detail.statuses.map((s) => ({ id: s.id, name: s.name, category: s.category, position: s.position })),
        assignee: detail.assignee ?? null,
        creator: detail.creator ?? null,
        labels: detail.labels,
        watchers: detail.watchers,
        isWatching: detail.isWatching,
        subtasks: detail.subtasks.map((s) => ({ id: s.id, number: s.number, title: s.title, statusCategory: s.statusCategory, statusName: s.statusName, assigneeName: s.assigneeName, assigneeColor: s.assigneeColor, dueDate: s.dueDate })),
        parent: detail.parent ? { id: detail.parent.id, number: detail.parent.number, title: detail.parent.title } : null,
        checklist: detail.checklist.map((c) => ({ id: c.id, text: c.text, done: c.done })),
        blockedBy: detail.blockedBy.map((b) => ({ id: b.id, number: b.number, title: b.title, projectKey: b.projectKey, statusCategory: b.statusCategory })),
        blocking: detail.blocking.map((b) => ({ id: b.id, number: b.number, title: b.title, projectKey: b.projectKey, statusCategory: b.statusCategory })),
        history: detail.history,
        milestone: detail.milestone,
        sourceRequest: detail.sourceRequest,
      }}
      context={{
        people: data.context.people.map((p) => ({ id: p.id, name: p.name, avatarColor: p.avatarColor })),
        milestones: data.context.milestones.map((m) => ({ id: m.id, name: m.name })),
        labels: data.context.labels,
      }}
      attachments={data.attachments.map((f) => ({ id: f.id, name: f.name, mimeType: f.mimeType, sizeBytes: f.sizeBytes, currentVersion: f.currentVersion }))}
      thread={data.thread ? { comments: data.thread.comments, context: data.thread.context } : null}
      viewer={data.viewer}
    />
  );
}
