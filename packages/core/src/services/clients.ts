import { z } from 'zod';
import {
  and,
  approvalReviewers,
  approvals,
  asc,
  clientAccounts,
  eq,
  invitations,
  isNull,
  memberships,
  projects,
  requests,
  sql,
  users,
  withTenant,
} from '@orqivanta/db';
import { notFound, validation } from '../errors';
import { audit } from '../lib/events';
import { parse, zName } from '../lib/validate';
import type { Actor } from '../permissions';
import { assertOrg } from './context';
import { OPEN_REQUEST_STATUSES } from './requests';

export async function listClients(actor: Actor, opts: { includeArchived?: boolean } = {}) {
  assertOrg(actor, 'clients.view');
  return withTenant(actor.orgId, (tx) =>
    tx
      .select({
        id: clientAccounts.id,
        name: clientAccounts.name,
        website: clientAccounts.website,
        accentColor: clientAccounts.accentColor,
        archivedAt: clientAccounts.archivedAt,
        createdAt: clientAccounts.createdAt,
        projectCount: sql<number>`(select count(*)::int from ${projects} p where p.client_account_id = ${clientAccounts.id} and p.deleted_at is null and p.archived_at is null)`,
        contactCount: sql<number>`(select count(*)::int from ${memberships} m where m.client_account_id = ${clientAccounts.id} and m.role = 'client')`,
        openRequestCount: sql<number>`(select count(*)::int from ${requests} r where r.client_account_id = ${clientAccounts.id} and r.status in ${OPEN_REQUEST_STATUSES})`,
        pendingApprovalCount: sql<number>`(select count(*)::int from ${approvals} a join ${projects} p on p.id = a.project_id where p.client_account_id = ${clientAccounts.id} and a.status = 'pending')`,
      })
      .from(clientAccounts)
      .where(and(eq(clientAccounts.orgId, actor.orgId), opts.includeArchived ? undefined : isNull(clientAccounts.archivedAt)))
      .orderBy(asc(clientAccounts.name)),
  );
}

export async function getClient(actor: Actor, clientId: string) {
  assertOrg(actor, 'clients.view');
  return withTenant(actor.orgId, async (tx) => {
    const [client] = await tx.select().from(clientAccounts).where(eq(clientAccounts.id, clientId));
    if (!client) throw notFound('That client');
    const contacts = await tx
      .select({ membershipId: memberships.id, userId: users.id, name: users.name, email: users.email, avatarColor: users.avatarColor, status: memberships.status, title: memberships.title, joinedAt: memberships.createdAt })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .where(and(eq(memberships.clientAccountId, clientId), eq(memberships.role, 'client')))
      .orderBy(asc(users.name));
    const pendingInvites = await tx
      .select({ id: invitations.id, email: invitations.email, expiresAt: invitations.expiresAt })
      .from(invitations)
      .where(and(eq(invitations.clientAccountId, clientId), isNull(invitations.acceptedAt), isNull(invitations.revokedAt)));
    const clientProjects = await tx
      .select({ id: projects.id, key: projects.key, name: projects.name, portalEnabled: projects.portalEnabled, status: projects.status, dueDate: projects.dueDate })
      .from(projects)
      .where(and(eq(projects.clientAccountId, clientId), isNull(projects.deletedAt)))
      .orderBy(asc(projects.name));
    const openRequests = await tx
      .select({ id: requests.id, number: requests.number, title: requests.title, status: requests.status, createdAt: requests.createdAt })
      .from(requests)
      .where(and(eq(requests.clientAccountId, clientId), sql`${requests.status} in ${OPEN_REQUEST_STATUSES}`))
      .orderBy(asc(requests.createdAt));
    const waitingOnClient = await tx
      .select({ id: approvals.id, title: approvals.title, dueDate: approvals.dueDate, projectKey: projects.key })
      .from(approvals)
      .innerJoin(projects, eq(projects.id, approvals.projectId))
      .where(
        and(
          eq(projects.clientAccountId, clientId),
          eq(approvals.status, 'pending'),
          sql`exists (select 1 from ${approvalReviewers} r join ${memberships} m on m.user_id = r.user_id and m.org_id = r.org_id where r.approval_id = ${approvals.id} and r.decision is null and m.role = 'client')`,
        ),
      );
    const canManage = actor.role === 'owner' || actor.role === 'admin';
    return { client: canManage || actor.role === 'member' ? client : { ...client, internalNotes: null }, contacts, pendingInvites, projects: clientProjects, openRequests, waitingOnClient, canManage };
  });
}

const clientSchema = z.object({
  clientId: z.uuid().optional(),
  name: zName('Client name', 80),
  website: z
    .string()
    .trim()
    .max(200)
    .optional()
    .nullable()
    .transform((v) => (v ? (/^https?:\/\//.test(v) ? v : `https://${v}`) : null))
    .refine((v) => {
      if (!v) return true;
      try {
        new URL(v);
        return true;
      } catch {
        return false;
      }
    }, 'Use a valid web address.'),
  internalNotes: z.string().trim().max(5000).optional().nullable(),
  accentColor: z.string().max(20).optional().nullable(),
});

export async function saveClient(actor: Actor, input: unknown) {
  assertOrg(actor, 'clients.manage');
  const data = parse(clientSchema, input);
  return withTenant(actor.orgId, async (tx) => {
    const [dupe] = await tx
      .select({ id: clientAccounts.id })
      .from(clientAccounts)
      .where(and(eq(clientAccounts.orgId, actor.orgId), sql`lower(${clientAccounts.name}) = lower(${data.name})`, data.clientId ? sql`${clientAccounts.id} <> ${data.clientId}` : undefined));
    if (dupe) throw validation({ name: 'A client with that name already exists.' });
    const values = { name: data.name, website: data.website, internalNotes: data.internalNotes ?? null, accentColor: data.accentColor ?? null, updatedAt: new Date() };
    let client;
    if (data.clientId) {
      [client] = await tx.update(clientAccounts).set(values).where(eq(clientAccounts.id, data.clientId)).returning();
      if (!client) throw notFound('That client');
    } else {
      [client] = await tx.insert(clientAccounts).values({ ...values, orgId: actor.orgId }).returning();
    }
    await audit(tx, actor, data.clientId ? 'client.updated' : 'client.created', { type: 'client', id: client!.id, metadata: { name: data.name } });
    return client!;
  });
}

/**
 * Archiving a client closes portal access for its contacts (memberships suspended) and
 * hides its projects from the portal. Restoring reverses both.
 */
export async function setClientArchived(actor: Actor, input: unknown) {
  assertOrg(actor, 'clients.manage');
  const data = parse(z.object({ clientId: z.uuid(), archived: z.boolean() }), input);
  return withTenant(actor.orgId, async (tx) => {
    const [client] = await tx.update(clientAccounts).set({ archivedAt: data.archived ? new Date() : null }).where(eq(clientAccounts.id, data.clientId)).returning();
    if (!client) throw notFound('That client');
    await tx.update(memberships).set({ status: data.archived ? 'suspended' : 'active' }).where(and(eq(memberships.clientAccountId, data.clientId), eq(memberships.role, 'client')));
    if (data.archived) await tx.update(projects).set({ portalEnabled: false }).where(eq(projects.clientAccountId, data.clientId));
    await audit(tx, actor, data.archived ? 'client.archived' : 'client.restored', { type: 'client', id: data.clientId });
    return client;
  });
}

export async function listClientOptions(actor: Actor) {
  if (actor.role === 'client') return [];
  return withTenant(actor.orgId, (tx) =>
    tx.select({ id: clientAccounts.id, name: clientAccounts.name }).from(clientAccounts).where(and(eq(clientAccounts.orgId, actor.orgId), isNull(clientAccounts.archivedAt))).orderBy(asc(clientAccounts.name)),
  );
}

