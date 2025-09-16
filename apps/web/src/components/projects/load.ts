import 'server-only';
import { cache } from 'react';
import { notFound } from 'next/navigation';
import { AppError, getProjectByKey, getProjectOverview, listFavorites } from '@orqivanta/core';
import { requireActor } from '@/lib/session';

/**
 * The project for a /projects/[key] route, loaded once per request and shared by the
 * layout and its tabs. Unknown keys and projects the viewer can't open both become a 404.
 */
export const loadProject = cache(async (org: string, key: string) => {
  const actor = await requireActor(org);
  try {
    const access = await getProjectByKey(actor, key);
    const [overview, favorites] = await Promise.all([getProjectOverview(actor, access.project.id), listFavorites(actor)]);
    const can = {
      edit: access.can('project.update') && !access.project.archivedAt,
      archive: access.can('project.archive'),
      delete: access.can('project.delete'),
      manageMembers: access.can('project.manageMembers'),
      postUpdate: access.can('project.postUpdate') && !access.project.archivedAt,
      share: access.can('project.shareWithClient'),
      milestones: access.can('milestone.manage') && !access.project.archivedAt,
      createTask: access.can('task.create') && !access.project.archivedAt,
      editTask: access.can('task.update') && !access.project.archivedAt,
      createDocument: access.can('document.create') && !access.project.archivedAt,
      upload: access.can('file.upload') && !access.project.archivedAt,
    };
    return {
      actor,
      project: access.project,
      role: access.role,
      can,
      overview,
      isFavorite: favorites.some((f) => f.entityType === 'project' && f.entityId === access.project.id),
    };
  } catch (err) {
    if (err instanceof AppError && (err.code === 'NOT_FOUND' || err.code === 'FORBIDDEN')) notFound();
    throw err;
  }
});

export type LoadedProject = Awaited<ReturnType<typeof loadProject>>;
