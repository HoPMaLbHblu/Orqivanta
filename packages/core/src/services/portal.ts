import { z } from 'zod';
import { and, asc, clientAccounts, desc, eq, isNull, milestones, projectStatuses, projectUpdates, projects, sql, tasks, users, withTenant } from '@orqivanta/db';
import { notFound } from '../errors';
import { parse } from '../lib/validate';
import type { Actor } from '../permissions';
import { getProjectAccess, visibleProjectsSql } from './access';
import { computeHealth, statsFor } from './projects';

/**
 * The client account a portal viewer belongs to (name only: internal notes never leave the
 * server). Returns null for anyone who isn't acting as a client contact.
 */
export async function getPortalAccount(actor: Actor) {
  if (actor.role !== 'client' || !actor.clientAccountId) return null;
  const [row] = await withTenant(actor.orgId, (tx) =>
    tx
      .select({ id: clientAccounts.id, name: clientAccounts.name, accentColor: clientAccounts.accentColor })
      .from(clientAccounts)
      .where(and(eq(clientAccounts.id, actor.clientAccountId!), eq(clientAccounts.orgId, actor.orgId))),
  );
  return row ?? null;
}

/** Only owners and admins can preview the portal: they can already see everything a client can. */
export function canPreviewPortal(actor: Actor) {
  return actor.role === 'owner' || actor.role === 'admin';
}

/**
 * "View as client": an actor with the client role, scoped to one client account, for an
 * owner or admin. Every core function then applies exactly the rules it applies to that
 * client's contacts, so the preview can only ever show less than the previewer could already
 * open. It is read-only by construction: the web layer never passes it to a mutation.
 */
export async function portalPreviewActor(actor: Actor, clientAccountId: string): Promise<Actor> {
  if (!canPreviewPortal(actor)) throw notFound('That client');
  const id = parse(z.uuid(), clientAccountId);
  const [client] = await withTenant(actor.orgId, (tx) =>
    tx
      .select({ id: clientAccounts.id })
      .from(clientAccounts)
      .where(and(eq(clientAccounts.id, id), eq(clientAccounts.orgId, actor.orgId), isNull(clientAccounts.archivedAt))),
  );
  if (!client) throw notFound('That client');
  return { userId: actor.userId, orgId: actor.orgId, orgSlug: actor.orgSlug, role: 'client', clientAccountId: client.id };
}

/** Status updates across the projects the actor can open; client contacts see shared ones only. */
export async function listPortalUpdates(actor: Actor, input: unknown = {}) {
  const f = parse(z.object({ projectId: z.uuid().optional(), limit: z.number().int().min(1).max(100).default(30) }), input);
  return withTenant(actor.orgId, (tx) =>
    tx
      .select({
        id: projectUpdates.id,
        projectId: projectUpdates.projectId,
        projectKey: projects.key,
        projectName: projects.name,
        projectColor: projects.color,
        health: projectUpdates.health,
        summary: projectUpdates.summary,
        body: projectUpdates.body,
        createdAt: projectUpdates.createdAt,
        authorName: users.name,
        authorColor: users.avatarColor,
      })
      .from(projectUpdates)
      .innerJoin(projects, eq(projects.id, projectUpdates.projectId))
      .leftJoin(users, eq(users.id, projectUpdates.authorId))
      .where(
        and(
          eq(projectUpdates.orgId, actor.orgId),
          visibleProjectsSql(actor),
          actor.role === 'client' ? eq(projectUpdates.sharedWithClient, true) : undefined,
          f.projectId ? eq(projectUpdates.projectId, f.projectId) : undefined,
        ),
      )
      .orderBy(desc(projectUpdates.createdAt))
      .limit(f.limit),
  );
}

/**
 * The shared project view for the portal: milestones (with how much of their work is done),
 * status updates and progress, all filtered by the same project access rules as elsewhere.
 * Separate from getProjectOverview because the portal needs only the shared half of it.
 */
export async function getPortalProject(actor: Actor, projectId: string) {
  return withTenant(actor.orgId, async (tx) => {
    const access = await getProjectAccess(tx, actor, projectId);
    const isClient = access.isClient;
    const p = access.project;
    const stats = (await statsFor(tx, [p.id], { sharedOnly: isClient })).get(p.id)!;
    const ms = await tx
      .select({
        id: milestones.id,
        name: milestones.name,
        description: milestones.description,
        dueDate: milestones.dueDate,
        status: milestones.status,
        position: milestones.position,
        taskTotal: sql<number>`(select count(*)::int from ${tasks} t where t.milestone_id = milestones.id and t.deleted_at is null${isClient ? sql` and t.shared_with_client` : sql``})`,
        taskDone: sql<number>`(select count(*)::int from ${tasks} t join ${projectStatuses} s on s.id = t.status_id where t.milestone_id = milestones.id and t.deleted_at is null and s.category = 'completed'${isClient ? sql` and t.shared_with_client` : sql``})`,
      })
      .from(milestones)
      .where(and(eq(milestones.projectId, p.id), isClient ? eq(milestones.sharedWithClient, true) : undefined))
      .orderBy(asc(milestones.position), asc(milestones.dueDate));
    const updates = await tx
      .select({
        id: projectUpdates.id,
        health: projectUpdates.health,
        summary: projectUpdates.summary,
        body: projectUpdates.body,
        createdAt: projectUpdates.createdAt,
        authorName: users.name,
        authorColor: users.avatarColor,
      })
      .from(projectUpdates)
      .leftJoin(users, eq(users.id, projectUpdates.authorId))
      .where(and(eq(projectUpdates.projectId, p.id), isClient ? eq(projectUpdates.sharedWithClient, true) : undefined))
      .orderBy(desc(projectUpdates.createdAt))
      .limit(10);
    const today = new Date().toISOString().slice(0, 10);
    const latest = updates[0];
    return {
      project: { id: p.id, key: p.key, name: p.name, description: p.description, startDate: p.startDate, dueDate: p.dueDate, color: p.color, status: p.status },
      isClient,
      stats,
      health: latest?.health ?? computeHealth(stats, p.dueDate, today),
      healthSource: latest ? ('reported' as const) : ('computed' as const),
      milestones: ms,
      updates,
    };
  });
}
