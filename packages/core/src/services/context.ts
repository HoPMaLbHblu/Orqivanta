import { and, asc, eq, memberships, organizations, isNull, users, withSystem } from '@orqivanta/db';
import type { Actor, OrgRole } from '../permissions';
import { canOrg, type OrgAction } from '../permissions';
import { forbidden, notFound } from '../errors';

export interface OrgSummary {
  id: string;
  name: string;
  slug: string;
  role: OrgRole;
  clientAccountId: string | null;
  logoFileKey: string | null;
  isDemo: boolean;
}

/** Organizations the user is an active member of. Runs as system: it spans tenants by design. */
export async function listMyOrgs(userId: string): Promise<OrgSummary[]> {
  return withSystem((tx) =>
    tx
      .select({
        id: organizations.id,
        name: organizations.name,
        slug: organizations.slug,
        role: memberships.role,
        clientAccountId: memberships.clientAccountId,
        logoFileKey: organizations.logoFileKey,
        isDemo: organizations.isDemo,
      })
      .from(memberships)
      .innerJoin(organizations, eq(organizations.id, memberships.orgId))
      .where(and(eq(memberships.userId, userId), eq(memberships.status, 'active'), isNull(organizations.deletedAt)))
      .orderBy(asc(organizations.name)),
  );
}

/**
 * Resolves the acting user's membership in an organization, by URL slug. Called on every
 * request, so a removed or suspended member loses access immediately.
 */
export async function resolveActor(userId: string, orgSlug: string): Promise<(Actor & { orgName: string; isDemo: boolean }) | null> {
  const [row] = await withSystem((tx) =>
    tx
      .select({
        orgId: organizations.id,
        orgName: organizations.name,
        orgSlug: organizations.slug,
        isDemo: organizations.isDemo,
        role: memberships.role,
        clientAccountId: memberships.clientAccountId,
      })
      .from(organizations)
      .innerJoin(memberships, and(eq(memberships.orgId, organizations.id), eq(memberships.userId, userId)))
      .where(and(eq(organizations.slug, orgSlug), eq(memberships.status, 'active'), isNull(organizations.deletedAt)))
      .limit(1),
  );
  if (!row) return null;
  return {
    userId,
    orgId: row.orgId,
    orgSlug: row.orgSlug,
    orgName: row.orgName,
    isDemo: row.isDemo,
    role: row.role,
    clientAccountId: row.role === 'client' ? row.clientAccountId : null,
  };
}

/** Same as resolveActor but by org id; used by the realtime stream and the worker. */
export async function resolveActorById(userId: string, orgId: string): Promise<Actor | null> {
  const [row] = await withSystem((tx) =>
    tx
      .select({ slug: organizations.slug })
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1),
  );
  return row ? resolveActor(userId, row.slug) : null;
}

export function assertOrg(actor: Actor, action: OrgAction) {
  if (!canOrg(actor.role, action)) {
    // Client contacts must not learn that internal areas exist.
    if (actor.role === 'client') throw notFound('That page');
    throw forbidden();
  }
}

export async function rememberActiveOrg(userId: string, orgId: string) {
  await withSystem((tx) => tx.update(users).set({ lastActiveOrgId: orgId }).where(eq(users.id, userId)));
}
