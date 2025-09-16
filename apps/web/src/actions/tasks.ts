'use server';

import {
  addDependency,
  bulkUpdateTasks,
  createTask,
  deleteChecklistItem,
  deleteTask,
  deleteView,
  duplicateTask,
  moveTask,
  removeDependency,
  restoreTask,
  saveChecklistItem,
  saveView,
  setWatching,
  updateTask,
} from '@orqivanta/core';
import { run } from '@/lib/action';
import { actorFor } from '@/lib/session';

export async function createTaskAction(org: string, input: unknown) {
  return run(async () => {
    const t = await createTask(await actorFor(org), input);
    return { id: t.id, ref: t.ref };
  });
}

export async function updateTaskAction(org: string, input: unknown) {
  return run(async () => {
    const r = await updateTask(await actorFor(org), input);
    return { version: r.task.version, changed: r.changed };
  });
}

export async function moveTaskAction(org: string, input: { taskId: string; version: number; statusId: string; afterId: string | null }) {
  return run(async () => {
    const t = await moveTask(await actorFor(org), input);
    return { version: t.version, position: t.position, statusId: t.statusId };
  });
}

export async function bulkUpdateTasksAction(org: string, input: unknown) {
  return run(async () => bulkUpdateTasks(await actorFor(org), input));
}

export async function deleteTaskAction(org: string, taskId: string) {
  return run(async () => deleteTask(await actorFor(org), { taskId }));
}

export async function restoreTaskAction(org: string, taskId: string) {
  return run(async () => {
    await restoreTask(await actorFor(org), { taskId });
    return true;
  });
}

export async function duplicateTaskAction(org: string, taskId: string) {
  return run(async () => {
    const t = await duplicateTask(await actorFor(org), { taskId });
    return { id: t.id, ref: t.ref };
  });
}

export async function setWatchingAction(org: string, input: { taskId: string; watching: boolean }) {
  return run(async () => {
    await setWatching(await actorFor(org), input);
    return true;
  });
}

export async function saveChecklistItemAction(org: string, input: { taskId: string; itemId?: string; text?: string; done?: boolean }) {
  return run(async () => {
    const i = await saveChecklistItem(await actorFor(org), input);
    return { id: i.id };
  });
}

export async function deleteChecklistItemAction(org: string, input: { taskId: string; itemId: string }) {
  return run(async () => {
    await deleteChecklistItem(await actorFor(org), input);
    return true;
  });
}

export async function addDependencyAction(org: string, input: { blockerRef: string; blockedId: string }) {
  return run(async () => {
    await addDependency(await actorFor(org), input);
    return true;
  });
}

export async function removeDependencyAction(org: string, input: { blockerId: string; blockedId: string }) {
  return run(async () => {
    await removeDependency(await actorFor(org), input);
    return true;
  });
}

export async function saveViewAction(org: string, input: unknown) {
  return run(async () => {
    const v = await saveView(await actorFor(org), input);
    return { id: v.id };
  });
}

export async function deleteViewAction(org: string, viewId: string) {
  return run(async () => {
    await deleteView(await actorFor(org), { viewId });
    return true;
  });
}
