'use server';

import {
  addProjectMembers,
  changeProjectMemberRole,
  createDocument,
  createProject,
  deleteMilestone,
  deleteProject,
  postProjectUpdate,
  removeProjectMember,
  saveMilestone,
  setFavorite,
  setPortalEnabled,
  setProjectArchived,
  suggestProjectKey,
  updateProject,
} from '@orqivanta/core';
import { run } from '@/lib/action';
import { actorFor } from '@/lib/session';

export async function createProjectAction(org: string, input: unknown) {
  return run(async () => {
    const p = await createProject(await actorFor(org), input);
    return { id: p.id, key: p.key };
  });
}

/** Pure helper exposed for the "New project" dialog, so the rule lives in one place. */
export async function suggestKeyAction(name: string) {
  return suggestProjectKey(String(name).slice(0, 80));
}

export async function updateProjectAction(org: string, input: unknown) {
  return run(async () => {
    const p = await updateProject(await actorFor(org), input);
    return { id: p.id, key: p.key, version: p.version };
  });
}

export async function setFavoriteAction(org: string, input: { entityType: 'project'; entityId: string; favorite: boolean }) {
  return run(async () => {
    await setFavorite(await actorFor(org), input);
    return true;
  });
}

export async function setProjectArchivedAction(org: string, input: { projectId: string; archived: boolean }) {
  return run(async () => {
    await setProjectArchived(await actorFor(org), input);
    return true;
  });
}

export async function deleteProjectAction(org: string, input: { projectId: string; confirmKey: string }) {
  return run(async () => {
    await deleteProject(await actorFor(org), input);
    return true;
  });
}

export async function setPortalEnabledAction(org: string, input: { projectId: string; enabled: boolean }) {
  return run(async () => {
    await setPortalEnabled(await actorFor(org), input);
    return true;
  });
}

export async function addProjectMembersAction(org: string, input: { projectId: string; userIds: string[]; role: 'manager' | 'contributor' | 'viewer' }) {
  return run(async () => {
    await addProjectMembers(await actorFor(org), input);
    return true;
  });
}

export async function changeProjectMemberRoleAction(org: string, input: { projectId: string; userId: string; role: 'manager' | 'contributor' | 'viewer' }) {
  return run(async () => {
    await changeProjectMemberRole(await actorFor(org), input);
    return true;
  });
}

export async function removeProjectMemberAction(org: string, input: { projectId: string; userId: string }) {
  return run(async () => {
    await removeProjectMember(await actorFor(org), input);
    return true;
  });
}

export async function saveMilestoneAction(org: string, input: unknown) {
  return run(async () => {
    const m = await saveMilestone(await actorFor(org), input);
    return { id: m.id };
  });
}

export async function deleteMilestoneAction(org: string, input: { projectId: string; milestoneId: string }) {
  return run(async () => {
    await deleteMilestone(await actorFor(org), input);
    return true;
  });
}

export async function postProjectUpdateAction(org: string, input: unknown) {
  return run(async () => {
    const u = await postProjectUpdate(await actorFor(org), input);
    return { id: u.id };
  });
}

export async function createProjectDocumentAction(org: string, input: { projectId: string; title?: string }) {
  return run(async () => {
    const d = await createDocument(await actorFor(org), input);
    return { id: d.id };
  });
}
