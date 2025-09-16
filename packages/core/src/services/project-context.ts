import { and, asc, eq, isNull, labels, memberships, milestones, ne, projectMembers, teamMembers, users, withTenant } from '@orqivanta/db';
import { effectiveProjectRole, type Actor } from '../permissions';
import { getProjectAccess } from './access';

/**
 * Pickers for task forms in one project: the people who can be assigned (internal members
 * who can open the project, same rule as task assignment), the project's milestones
 * (only shared ones for client contacts) and the organization's labels.
 */
export async function getTaskFormContext(actor: Actor, projectId: string) {
  return withTenant(actor.orgId, async (tx) => {
    const access = await getProjectAccess(tx, actor, projectId);
    const p = access.project;
    const rows = await tx
      .select({ id: users.id, name: users.name, avatarColor: users.avatarColor, orgRole: memberships.role, projectRole: projectMembers.role, inTeam: teamMembers.userId })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .leftJoin(projectMembers, and(eq(projectMembers.userId, memberships.userId), eq(projectMembers.projectId, p.id)))
      .leftJoin(teamMembers, and(eq(teamMembers.userId, memberships.userId), p.teamId ? eq(teamMembers.teamId, p.teamId) : isNull(teamMembers.teamId)))
      .where(and(eq(memberships.orgId, actor.orgId), eq(memberships.status, 'active'), ne(memberships.role, 'client')))
      .orderBy(asc(users.name));
    const people = access.isClient
      ? []
      : rows
          .map((r) => ({
            id: r.id,
            name: r.name,
            avatarColor: r.avatarColor,
            role: effectiveProjectRole({
              orgRole: r.orgRole,
              actorClientAccountId: null,
              projectMemberRole: r.projectRole,
              visibility: p.visibility,
              inProjectTeam: Boolean(r.inTeam),
              projectClientAccountId: p.clientAccountId,
              portalEnabled: p.portalEnabled,
            }),
          }))
          .filter((r): r is typeof r & { role: NonNullable<typeof r.role> } => r.role !== null && r.role !== 'client');
    const ms = await tx
      .select({ id: milestones.id, name: milestones.name, dueDate: milestones.dueDate, status: milestones.status })
      .from(milestones)
      .where(and(eq(milestones.projectId, p.id), access.isClient ? eq(milestones.sharedWithClient, true) : undefined))
      .orderBy(asc(milestones.position), asc(milestones.dueDate));
    const labelRows = access.isClient ? [] : await tx.select({ id: labels.id, name: labels.name, color: labels.color }).from(labels).where(eq(labels.orgId, actor.orgId)).orderBy(asc(labels.name));
    return { people, milestones: ms, labels: labelRows };
  });
}

/** Ids of the projects the actor is an explicit member of (for the "My projects" filter). */
export async function listMyProjectIds(actor: Actor) {
  return withTenant(actor.orgId, async (tx) => {
    const rows = await tx.select({ id: projectMembers.projectId }).from(projectMembers).where(and(eq(projectMembers.orgId, actor.orgId), eq(projectMembers.userId, actor.userId)));
    return rows.map((r) => r.id);
  });
}
