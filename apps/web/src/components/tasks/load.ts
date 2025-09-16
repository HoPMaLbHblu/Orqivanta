import 'server-only';
import { AppError, getTask, getTaskFormContext, listComments, listFiles } from '@orqivanta/core';
import type { OrgActor } from '@/lib/session';

/**
 * Everything the task detail view needs, for the full page and the side panel alike.
 * Returns null when the task doesn't exist or isn't visible, so callers decide between a
 * 404 page and a "not found" panel.
 */
export async function loadTaskDetail(actor: OrgActor, ref: string) {
  let detail;
  try {
    detail = await getTask(actor, ref);
  } catch (err) {
    if (err instanceof AppError && (err.code === 'NOT_FOUND' || err.code === 'FORBIDDEN')) return null;
    throw err;
  }
  const deleted = Boolean(detail.task.deletedAt);
  const [thread, attachments, context] = await Promise.all([
    deleted ? Promise.resolve(null) : listComments(actor, { type: 'task', id: detail.task.id }),
    deleted ? Promise.resolve([]) : listFiles(actor, { projectId: detail.project.id, taskId: detail.task.id }),
    getTaskFormContext(actor, detail.project.id),
  ]);
  return {
    detail,
    thread,
    attachments,
    context,
    viewer: { userId: actor.userId, isAdmin: actor.role === 'owner' || actor.role === 'admin' },
  };
}

export type TaskDetailData = NonNullable<Awaited<ReturnType<typeof loadTaskDetail>>>;
