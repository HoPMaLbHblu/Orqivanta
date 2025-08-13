import {
  and,
  eq,
  isNull,
  projectMembers,
  projects,
  sql,
  teamMembers,
  type Tx,
} from '@orqivanta/db';
import type { SQL } from '@orqivanta/db';
import { forbidden, notFound } from '../errors';
import {
  canProject,
  clientCanSeeItem,
  effectiveProjectRole,
  type Actor,
  type EffectiveProjectRole,
  type ProjectAction,
} from '../permissions';

export type ProjectRow = typeof projects.$inferSelect;

export interface ProjectAccess {
  project: ProjectRow;
  role: EffectiveProjectRole;
  can: (action: ProjectAction) => boolean;
  /** True for client contacts: list queries must also filter by shared_with_client. */
  isClient: boolean;
}

/**
 * SQL condition selecting the projects an actor may open. This is the single source used by
 * project lists, search, reports and exports, and it mirrors effectiveProjectRole().
 */
export function visibleProjectsSql(actor: Actor): SQL {
  const notDeleted = isNull(projects.deletedAt);
  switch (actor.role) {
    case 'owner':
    case 'admin':
      return notDeleted;
    case 'member':
      return and(
        notDeleted,
        sql`(
          ${projects.visibility} = 'org'
          or exists (select 1 from ${projectMembers} pm where pm.project_id = ${projects.id} and pm.user_id = ${actor.userId})
          or (${projects.visibility} = 'team' and exists (
            select 1 from ${teamMembers} tm where tm.team_id = ${projects.teamId} and tm.user_id = ${actor.userId}))
        )`,
      )!;
    case 'client':
      return and(
        notDeleted,
        eq(projects.portalEnabled, true),
        actor.clientAccountId ? eq(projects.clientAccountId, actor.clientAccountId) : sql`false`,
      )!;
  }
}

/** Loads a project and the actor's effective role on it, or throws NOT_FOUND. */
export async function getProjectAccess(
  tx: Tx,
  actor: Actor,
  projectId: string,
  opts: { includeDeleted?: boolean } = {},
): Promise<ProjectAccess> {
  const [project] = await tx.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!project || project.orgId !== actor.orgId) throw notFound('That project');
  if (project.deletedAt && !opts.includeDeleted) throw notFound('That project');

  let memberRole: 'manager' | 'contributor' | 'viewer' | null = null;
  let inTeam = false;
  if (actor.role === 'member') {
    const [pm] = await tx
      .select({ role: projectMembers.role })
      .from(projectMembers)
      .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, actor.userId)));
    memberRole = pm?.role ?? null;
    if (!memberRole && project.visibility === 'team' && project.teamId) {
      const [tm] = await tx
        .select({ userId: teamMembers.userId })
        .from(teamMembers)
        .where(and(eq(teamMembers.teamId, project.teamId), eq(teamMembers.userId, actor.userId)));
      inTeam = Boolean(tm);
    }
  }
  const role = effectiveProjectRole({
    orgRole: actor.role,
    actorClientAccountId: actor.clientAccountId,
    projectMemberRole: memberRole,
    visibility: project.visibility,
    inProjectTeam: inTeam,
    projectClientAccountId: project.clientAccountId,
    portalEnabled: project.portalEnabled,
  });
  if (!role) throw notFound('That project');
  return {
    project,
    role,
    isClient: role === 'client',
    can: (action) => canProject(role, action, actor.role),
  };
}

export async function requireProject(tx: Tx, actor: Actor, projectId: string, action: ProjectAction) {
  const access = await getProjectAccess(tx, actor, projectId);
  if (!access.can(action)) {
    if (access.isClient) throw notFound('That item');
    throw forbidden();
  }
  return access;
}

/** Throws NOT_FOUND when a client contact asks for an item that isn't shared with them. */
export function assertItemVisible(access: ProjectAccess, sharedWithClient: boolean, what = 'That item') {
  if (!clientCanSeeItem(access.role, sharedWithClient)) throw notFound(what);
}

/** Archived projects are read-only until restored. */
export function assertWritable(access: ProjectAccess) {
  if (access.project.archivedAt) {
    throw forbidden('This project is archived. Restore it to make changes.');
  }
}
