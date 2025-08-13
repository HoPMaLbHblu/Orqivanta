import { z } from 'zod';
import {
  and,
  clientAccounts,
  desc,
  eq,
  gt,
  invitations,
  isNull,
  memberships,
  organizations,
  projectMembers,
  projects,
  sql,
  users,
  withSystem,
  withTenant,
} from '@orqivanta/db';
import { config } from '../config';
import { AppError, forbidden, notFound, validation } from '../errors';
import { randomToken, sha256 } from '../lib/crypto';
import { audit, notify, publish } from '../lib/events';
import { rateLimit } from '../lib/rate-limit';
import { parse, zEmail } from '../lib/validate';
import { queueEmail } from '../mail/send';
import { assignableRoles, ROLE_LABELS, type Actor } from '../permissions';
import { assertOrg } from './context';

const createSchema = z.object({
  emails: z
    .array(zEmail)
    .min(1, 'Add at least one email address.')
    .max(20, 'Invite up to 20 people at a time.'),
  role: z.enum(['admin', 'member', 'client']),
  clientAccountId: z.uuid().optional().nullable(),
  projectId: z.uuid().optional().nullable(),
  message: z.string().trim().max(500).optional().nullable(),
});

export type InviteResult = { email: string; status: 'invited' | 'resent' | 'already_member' };

/**
 * Invites people by email. Invitation tokens are random, stored only as a hash, expire
 * after 7 days, and grant nothing until accepted by a signed-in account with that email.
 */
export async function createInvitations(actor: Actor, input: unknown): Promise<InviteResult[]> {
  assertOrg(actor, 'members.invite');
  const data = parse(createSchema, input);
  if (!assignableRoles(actor.role).includes(data.role)) throw forbidden('You can’t invite people with that role.');
  if (data.role === 'client' && !data.clientAccountId) {
    throw validation({ clientAccountId: 'Choose which client these contacts belong to.' });
  }
  await rateLimit(`invite:${actor.orgId}`, 100, 3600);

  return withTenant(actor.orgId, async (tx) => {
    if (data.clientAccountId) {
      const [client] = await tx.select().from(clientAccounts).where(eq(clientAccounts.id, data.clientAccountId));
      if (!client) throw validation({ clientAccountId: 'That client no longer exists.' });
    }
    if (data.projectId) {
      const [project] = await tx.select().from(projects).where(eq(projects.id, data.projectId));
      if (!project) throw validation({ projectId: 'That project no longer exists.' });
    }
    const [org] = await tx.select().from(organizations).where(eq(organizations.id, actor.orgId));
    const [inviter] = await tx.select({ name: users.name }).from(users).where(eq(users.id, actor.userId));
    const results: InviteResult[] = [];

    for (const email of [...new Set(data.emails)]) {
      const [existingMember] = await tx
        .select({ id: memberships.id })
        .from(memberships)
        .innerJoin(users, eq(users.id, memberships.userId))
        .where(and(eq(memberships.orgId, actor.orgId), sql`lower(${users.email}) = ${email}`));
      if (existingMember) {
        results.push({ email, status: 'already_member' });
        continue;
      }
      // Re-inviting replaces any pending invitation so only the newest link works.
      const revoked = await tx
        .update(invitations)
        .set({ revokedAt: new Date() })
        .where(
          and(
            eq(invitations.orgId, actor.orgId),
            sql`lower(${invitations.email}) = ${email}`,
            isNull(invitations.acceptedAt),
            isNull(invitations.revokedAt),
          ),
        )
        .returning({ id: invitations.id });
      const token = randomToken();
      const [inv] = await tx
        .insert(invitations)
        .values({
          orgId: actor.orgId,
          email,
          role: data.role,
          clientAccountId: data.role === 'client' ? data.clientAccountId! : null,
          projectId: data.projectId ?? null,
          tokenHash: sha256(token),
          invitedBy: actor.userId,
          message: data.message || null,
          expiresAt: new Date(Date.now() + config.invitationDays * 86400_000),
        })
        .returning();
      await queueEmail(
        tx,
        {
          to: email,
          template: 'invitation',
          data: {
            inviterName: inviter?.name ?? 'A teammate',
            orgName: org!.name,
            roleLabel: ROLE_LABELS[data.role],
            url: `${config.appUrl}/invite/${token}`,
            message: data.message,
          },
        },
        actor.orgId,
      );
      await audit(tx, actor, 'invitation.created', { type: 'invitation', id: inv!.id, metadata: { email, role: data.role } });
      results.push({ email, status: revoked.length ? 'resent' : 'invited' });
    }
    return results;
  });
}

export async function listInvitations(actor: Actor) {
  assertOrg(actor, 'members.invite');
  return withTenant(actor.orgId, (tx) =>
    tx
      .select({
        id: invitations.id,
        email: invitations.email,
        role: invitations.role,
        clientName: clientAccounts.name,
        invitedByName: users.name,
        expiresAt: invitations.expiresAt,
        createdAt: invitations.createdAt,
      })
      .from(invitations)
      .leftJoin(clientAccounts, eq(clientAccounts.id, invitations.clientAccountId))
      .leftJoin(users, eq(users.id, invitations.invitedBy))
      .where(and(eq(invitations.orgId, actor.orgId), isNull(invitations.acceptedAt), isNull(invitations.revokedAt)))
      .orderBy(desc(invitations.createdAt)),
  );
}

export async function revokeInvitation(actor: Actor, input: unknown) {
  assertOrg(actor, 'members.invite');
  const { invitationId } = parse(z.object({ invitationId: z.uuid() }), input);
  await withTenant(actor.orgId, async (tx) => {
    const [inv] = await tx
      .update(invitations)
      .set({ revokedAt: new Date() })
      .where(and(eq(invitations.id, invitationId), isNull(invitations.acceptedAt), isNull(invitations.revokedAt)))
      .returning();
    if (!inv) throw notFound('That invitation');
    await audit(tx, actor, 'invitation.revoked', { type: 'invitation', id: inv.id, metadata: { email: inv.email } });
  });
}

export async function resendInvitation(actor: Actor, input: unknown) {
  const { invitationId } = parse(z.object({ invitationId: z.uuid() }), input);
  const inv = await withTenant(actor.orgId, async (tx) => {
    const [row] = await tx.select().from(invitations).where(eq(invitations.id, invitationId));
    return row;
  });
  if (!inv || inv.acceptedAt || inv.revokedAt) throw notFound('That invitation');
  return createInvitations(actor, {
    emails: [inv.email],
    role: inv.role,
    clientAccountId: inv.clientAccountId,
    projectId: inv.projectId,
    message: inv.message,
  });
}

export type InvitationLookup =
  | { status: 'valid'; email: string; orgName: string; orgSlug: string; roleLabel: string; inviterName: string | null; accountExists: boolean }
  | { status: 'expired' | 'revoked' | 'accepted' | 'invalid'; orgName?: string; orgSlug?: string };

/** Public lookup for the /invite/[token] page. Runs as system: the visitor has no membership yet. */
export async function lookupInvitation(token: string): Promise<InvitationLookup> {
  if (!token || token.length > 100) return { status: 'invalid' };
  return withSystem(async (tx) => {
    const [row] = await tx
      .select({ inv: invitations, orgName: organizations.name, orgSlug: organizations.slug, inviterName: users.name })
      .from(invitations)
      .innerJoin(organizations, eq(organizations.id, invitations.orgId))
      .leftJoin(users, eq(users.id, invitations.invitedBy))
      .where(and(eq(invitations.tokenHash, sha256(token)), isNull(organizations.deletedAt)));
    if (!row) return { status: 'invalid' };
    const base = { orgName: row.orgName, orgSlug: row.orgSlug };
    if (row.inv.acceptedAt) return { status: 'accepted', ...base };
    if (row.inv.revokedAt) return { status: 'revoked', ...base };
    if (row.inv.expiresAt.getTime() <= Date.now()) return { status: 'expired', ...base };
    const [account] = await tx.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = lower(${row.inv.email})`);
    return {
      status: 'valid',
      email: row.inv.email,
      roleLabel: ROLE_LABELS[row.inv.role],
      inviterName: row.inviterName,
      accountExists: Boolean(account),
      ...base,
    };
  });
}

/**
 * Accepts an invitation for the signed-in user. The account's verified email must match
 * the invited address: a forwarded link cannot be used by someone else.
 */
export async function acceptInvitation(userId: string, token: string) {
  return withSystem(async (tx) => {
    const [user] = await tx.select().from(users).where(eq(users.id, userId));
    if (!user) throw new AppError('UNAUTHENTICATED', 'Please sign in again.');
    if (!user.emailVerifiedAt) throw new AppError('PRECONDITION', 'Confirm your email address first.');
    const [inv] = await tx
      .select()
      .from(invitations)
      .where(
        and(
          eq(invitations.tokenHash, sha256(token)),
          isNull(invitations.acceptedAt),
          isNull(invitations.revokedAt),
          gt(invitations.expiresAt, sql`now()`),
        ),
      )
      .for('update');
    if (!inv) throw new AppError('PRECONDITION', 'This invitation is no longer valid.');
    if (inv.email.toLowerCase() !== user.email.toLowerCase()) {
      throw new AppError('FORBIDDEN', `This invitation was sent to ${inv.email}. Sign in with that address to accept it.`);
    }
    const [org] = await tx.select().from(organizations).where(eq(organizations.id, inv.orgId));
    const [existing] = await tx
      .select()
      .from(memberships)
      .where(and(eq(memberships.orgId, inv.orgId), eq(memberships.userId, userId)));
    if (!existing) {
      await tx.insert(memberships).values({
        orgId: inv.orgId,
        userId,
        role: inv.role,
        clientAccountId: inv.role === 'client' ? inv.clientAccountId : null,
      });
    }
    if (inv.projectId && inv.role !== 'client') {
      await tx
        .insert(projectMembers)
        .values({ orgId: inv.orgId, projectId: inv.projectId, userId, role: 'contributor' })
        .onConflictDoNothing();
    }
    await tx.update(invitations).set({ acceptedAt: new Date(), acceptedBy: userId }).where(eq(invitations.id, inv.id));
    await tx.update(users).set({ lastActiveOrgId: inv.orgId }).where(eq(users.id, userId));
    const actor = { orgId: inv.orgId, userId };
    await audit(tx, actor, 'invitation.accepted', { type: 'invitation', id: inv.id, metadata: { role: inv.role } });
    await publish(tx, inv.orgId, 'org', 'member.joined', userId);
    if (inv.invitedBy) {
      await notify(tx, actor, {
        userIds: [inv.invitedBy],
        category: 'membership',
        title: `${user.name} joined ${org!.name}`,
        href: `/${org!.slug}/settings/members`,
      });
    }
    return { orgSlug: org!.slug, role: inv.role };
  });
}
