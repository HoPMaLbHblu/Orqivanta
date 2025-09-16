'use server';

import {
  changeMemberRole,
  createInvitations,
  createTeam,
  deleteLabel,
  deleteOrganization,
  deleteTeam,
  isSlugAvailable,
  removeMember,
  requestOrgExport,
  resendInvitation,
  restoreDeletedProject,
  revokeInvitation,
  saveForm,
  saveLabel,
  setMemberSuspended,
  transferOwnership,
  updateMemberTitle,
  updateOrganization,
  updateTeam,
} from '@orqivanta/core';
import { run } from '@/lib/action';
import { homePathFor } from '@/lib/routes';
import { actorFor, getSession } from '@/lib/session';

export async function checkSlugAction(slug: string, currentSlug?: string) {
  return run(async () => {
    if (!(await getSession())) return false;
    if (currentSlug && slug.trim().toLowerCase() === currentSlug) return true;
    return isSlugAvailable(slug);
  });
}

export async function updateOrganizationAction(org: string, input: { name: string; slug: string }) {
  return run(async () => {
    const o = await updateOrganization(await actorFor(org), input);
    return { slug: o.slug };
  });
}

export async function deleteOrganizationAction(org: string, confirmName: string) {
  return run(async () => {
    await deleteOrganization(await actorFor(org), { confirmName });
    const s = await getSession();
    return { to: s ? await homePathFor({ id: s.user.id, lastActiveOrgId: null }) : '/' };
  });
}

export async function transferOwnershipAction(org: string, userId: string) {
  return run(async () => {
    await transferOwnership(await actorFor(org), { userId });
    return true;
  });
}

export async function changeMemberRoleAction(org: string, input: { membershipId: string; role: 'admin' | 'member' | 'client'; clientAccountId?: string }) {
  return run(async () => {
    await changeMemberRole(await actorFor(org), input);
    return true;
  });
}

export async function setMemberSuspendedAction(org: string, input: { membershipId: string; suspended: boolean }) {
  return run(async () => {
    await setMemberSuspended(await actorFor(org), input);
    return true;
  });
}

export async function removeMemberAction(org: string, membershipId: string) {
  return run(async () => removeMember(await actorFor(org), { membershipId }));
}

export async function updateMemberTitleAction(org: string, input: { membershipId: string; title: string }) {
  return run(async () => {
    await updateMemberTitle(await actorFor(org), input);
    return true;
  });
}

export async function createInvitationsAction(org: string, input: { emails: string[]; role: 'admin' | 'member' | 'client'; clientAccountId?: string | null; message?: string | null }) {
  return run(async () => createInvitations(await actorFor(org), input));
}

export async function revokeInvitationAction(org: string, invitationId: string) {
  return run(async () => {
    await revokeInvitation(await actorFor(org), { invitationId });
    return true;
  });
}

export async function resendInvitationAction(org: string, invitationId: string) {
  return run(async () => resendInvitation(await actorFor(org), { invitationId }));
}

export async function saveTeamAction(org: string, input: { teamId?: string; name: string; description?: string | null; color?: string; memberIds: string[] }) {
  return run(async () => {
    const actor = await actorFor(org);
    const team = input.teamId ? await updateTeam(actor, input) : await createTeam(actor, input);
    return { id: team.id };
  });
}

export async function deleteTeamAction(org: string, teamId: string) {
  return run(async () => {
    await deleteTeam(await actorFor(org), { teamId });
    return true;
  });
}

export async function saveFormAction(org: string, input: unknown) {
  return run(async () => {
    const form = await saveForm(await actorFor(org), input);
    return { id: form.id };
  });
}

export async function saveLabelAction(org: string, input: { labelId?: string; name: string; color: string }) {
  return run(async () => {
    const l = await saveLabel(await actorFor(org), input);
    return { id: l.id };
  });
}

export async function deleteLabelAction(org: string, labelId: string) {
  return run(async () => {
    await deleteLabel(await actorFor(org), { labelId });
    return true;
  });
}

export async function requestExportAction(org: string) {
  return run(async () => {
    const job = await requestOrgExport(await actorFor(org));
    return { id: job.id };
  });
}

export async function restoreProjectAction(org: string, projectId: string) {
  return run(async () => {
    await restoreDeletedProject(await actorFor(org), { projectId });
    return true;
  });
}
