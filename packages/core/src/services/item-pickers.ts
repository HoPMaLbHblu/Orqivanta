import { and, asc, documents, eq, isNull, memberships, projects, users, withTenant } from '@orqivanta/db';
import { type Actor, type EffectiveProjectRole } from '../permissions';
import { getProjectAccess, visibleProjectsSql } from './access';
import { userCanAccessProject } from './tasks';

/**
 * Projects the actor can open, with what they may do with documents and files in each.
 * Used by pickers ("new document in…", "upload to…") so the UI only offers real choices.
 */
export async function listProjectCapabilities(actor: Actor) {
  return withTenant(actor.orgId, async (tx) => {
    const rows = await tx
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.orgId, actor.orgId), visibleProjectsSql(actor), isNull(projects.deletedAt)))
      .orderBy(asc(projects.name));
    const out = [];
    for (const r of rows) {
      const a = await getProjectAccess(tx, actor, r.id);
      const archived = Boolean(a.project.archivedAt);
      out.push({
        id: a.project.id,
        key: a.project.key,
        name: a.project.name,
        color: a.project.color,
        archived,
        hasClient: Boolean(a.project.clientAccountId),
        portalEnabled: a.project.portalEnabled,
        role: a.role,
        canCreateDocument: a.can('document.create') && !archived,
        canUpload: a.can('file.upload') && !archived,
        canShare: a.can('project.shareWithClient'),
        canDeleteDocuments: a.can('document.delete'),
        canRequestApproval: a.can('approval.create') && !archived,
      });
    }
    return out;
  });
}

/**
 * People who can open a project (for reviewer pickers and @mentions), with their effective
 * role. Client contacts are included only when the project belongs to their client account
 * and the portal is on; callers decide whether clients are appropriate for the item.
 */
export async function listProjectPeople(actor: Actor, projectId: string) {
  return withTenant(actor.orgId, async (tx) => {
    const access = await getProjectAccess(tx, actor, projectId);
    if (access.isClient) return [];
    const people = await tx
      .select({ id: users.id, name: users.name, email: users.email, avatarColor: users.avatarColor })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .where(and(eq(memberships.orgId, actor.orgId), eq(memberships.status, 'active')))
      .orderBy(asc(users.name));
    const out: ((typeof people)[number] & { role: EffectiveProjectRole })[] = [];
    for (const p of people) {
      const role = await userCanAccessProject(tx, access.project, p.id);
      if (!role) continue;
      out.push({ ...p, role });
    }
    return out;
  });
}

/** Ids of documents the actor created (for the "Mine" filter and creator-only delete). */
export async function listAuthoredDocumentIds(actor: Actor) {
  return withTenant(actor.orgId, async (tx) => {
    const rows = await tx.select({ id: documents.id }).from(documents).where(and(eq(documents.orgId, actor.orgId), eq(documents.createdBy, actor.userId)));
    return rows.map((r) => r.id);
  });
}
