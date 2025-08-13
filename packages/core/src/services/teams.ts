import { z } from 'zod';
import { and, asc, eq, inArray, memberships, ne, teamMembers, teams, users, withTenant, type Tx } from '@orqivanta/db';
import { notFound, validation } from '../errors';
import { audit } from '../lib/events';
import { parse, zName } from '../lib/validate';
import type { Actor } from '../permissions';
import { assertOrg } from './context';

export async function listTeams(actor: Actor) {
  assertOrg(actor, 'members.view');
  return withTenant(actor.orgId, async (tx) => {
    const rows = await tx.select().from(teams).where(eq(teams.orgId, actor.orgId)).orderBy(asc(teams.name));
    const members = await tx
      .select({ teamId: teamMembers.teamId, userId: users.id, name: users.name, avatarColor: users.avatarColor })
      .from(teamMembers)
      .innerJoin(users, eq(users.id, teamMembers.userId))
      .where(eq(teamMembers.orgId, actor.orgId))
      .orderBy(asc(users.name));
    return rows.map((t) => ({ ...t, members: members.filter((m) => m.teamId === t.id) }));
  });
}

const teamSchema = z.object({
  name: zName('Team name', 50),
  description: z.string().trim().max(200).optional().nullable(),
  color: z.string().max(20).optional(),
  memberIds: z.array(z.uuid()).max(200).default([]),
});

async function setTeamMembers(tx: Tx, actor: Actor, teamId: string, memberIds: string[]) {
  if (memberIds.length) {
    const valid = await tx
      .select({ userId: memberships.userId })
      .from(memberships)
      .where(and(eq(memberships.orgId, actor.orgId), ne(memberships.role, 'client'), inArray(memberships.userId, memberIds)));
    if (valid.length !== new Set(memberIds).size) throw validation({ memberIds: 'Only internal members can join a team.' });
  }
  await tx.delete(teamMembers).where(eq(teamMembers.teamId, teamId));
  if (memberIds.length) {
    await tx.insert(teamMembers).values([...new Set(memberIds)].map((userId) => ({ orgId: actor.orgId, teamId, userId })));
  }
}

export async function createTeam(actor: Actor, input: unknown) {
  assertOrg(actor, 'teams.manage');
  const data = parse(teamSchema, input);
  return withTenant(actor.orgId, async (tx) => {
    const [dupe] = await tx.select().from(teams).where(and(eq(teams.orgId, actor.orgId), eq(teams.name, data.name)));
    if (dupe) throw validation({ name: 'A team with that name already exists.' });
    const [team] = await tx
      .insert(teams)
      .values({ orgId: actor.orgId, name: data.name, description: data.description ?? null, color: data.color ?? 'verdigris' })
      .returning();
    await setTeamMembers(tx, actor, team!.id, data.memberIds);
    await audit(tx, actor, 'team.created', { type: 'team', id: team!.id, metadata: { name: data.name } });
    return team!;
  });
}

export async function updateTeam(actor: Actor, input: unknown) {
  assertOrg(actor, 'teams.manage');
  const data = parse(teamSchema.extend({ teamId: z.uuid() }), input);
  return withTenant(actor.orgId, async (tx) => {
    const [team] = await tx
      .update(teams)
      .set({ name: data.name, description: data.description ?? null, color: data.color ?? 'verdigris' })
      .where(eq(teams.id, data.teamId))
      .returning();
    if (!team) throw notFound('That team');
    await setTeamMembers(tx, actor, team.id, data.memberIds);
    await audit(tx, actor, 'team.updated', { type: 'team', id: team.id });
    return team;
  });
}

export async function deleteTeam(actor: Actor, input: unknown) {
  assertOrg(actor, 'teams.manage');
  const { teamId } = parse(z.object({ teamId: z.uuid() }), input);
  await withTenant(actor.orgId, async (tx) => {
    const [team] = await tx.delete(teams).where(eq(teams.id, teamId)).returning();
    if (!team) throw notFound('That team');
    await audit(tx, actor, 'team.deleted', { type: 'team', id: teamId, metadata: { name: team.name } });
  });
}
