import { z } from 'zod';
import {
  and,
  eq,
  labels,
  memberships,
  organizations,
  requestForms,
  sql,
  users,
  withSystem,
  withTenant,
} from '@orqivanta/db';
import { AppError, validation } from '../errors';
import { audit } from '../lib/events';
import { rateLimit } from '../lib/rate-limit';
import { parse, RESERVED_SLUGS, zName, zSlug } from '../lib/validate';
import type { Actor } from '../permissions';
import { DEFAULT_LABELS, DEFAULT_REQUEST_FORM, ORG_PURPOSES } from '../templates';
import { assertOrg } from './context';

export function slugify(name: string) {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

export async function isSlugAvailable(slug: string): Promise<boolean> {
  const parsed = zSlug.safeParse(slug);
  if (!parsed.success || RESERVED_SLUGS.has(parsed.data)) return false;
  const [row] = await withSystem((tx) =>
    tx.select({ id: organizations.id }).from(organizations).where(eq(organizations.slug, parsed.data)).limit(1),
  );
  return !row;
}

const createOrgSchema = z.object({
  name: zName('Organization name', 60),
  slug: zSlug.refine((s) => !RESERVED_SLUGS.has(s), 'That address is reserved. Try another.'),
  purpose: z.enum(ORG_PURPOSES.map((p) => p.id) as [string, ...string[]]).optional(),
});

/**
 * Creates an organization with the creator as owner, plus starter labels and an intake
 * form, all in one transaction.
 */
export async function createOrganization(userId: string, input: unknown) {
  const data = parse(createOrgSchema, input);
  await rateLimit(`create-org:${userId}`, 10, 3600);
  const [user] = await withSystem((tx) => tx.select().from(users).where(eq(users.id, userId)));
  if (!user?.emailVerifiedAt) throw new AppError('PRECONDITION', 'Confirm your email before creating an organization.');

  try {
    return await withSystem(async (tx) => {
      const [org] = await tx
        .insert(organizations)
        .values({ name: data.name, slug: data.slug, purpose: data.purpose ?? null, createdBy: userId })
        .returning();
      const orgId = org!.id;
      await tx.insert(memberships).values({ orgId, userId, role: 'owner' });
      await tx.insert(labels).values(DEFAULT_LABELS.map((l) => ({ orgId, ...l })));
      await tx.insert(requestForms).values({ orgId, ...DEFAULT_REQUEST_FORM, defaultOwnerId: userId });
      await tx.update(users).set({ lastActiveOrgId: orgId }).where(eq(users.id, userId));
      await audit(tx, { orgId, userId }, 'org.created', { type: 'organization', id: orgId });
      return org!;
    });
  } catch (err) {
    if (err instanceof Error && /organizations_slug_key/.test(String((err as { cause?: unknown }).cause ?? err.message))) {
      throw validation({ slug: 'That address is already taken.' });
    }
    throw err;
  }
}

const updateOrgSchema = z.object({
  name: zName('Organization name', 60),
  slug: zSlug.refine((s) => !RESERVED_SLUGS.has(s), 'That address is reserved. Try another.'),
});

export async function updateOrganization(actor: Actor, input: unknown) {
  assertOrg(actor, 'org.update');
  const data = parse(updateOrgSchema, input);
  if (data.slug !== actor.orgSlug && !(await isSlugAvailable(data.slug))) {
    throw validation({ slug: 'That address is already taken.' });
  }
  return withTenant(actor.orgId, async (tx) => {
    const [before] = await tx.select().from(organizations).where(eq(organizations.id, actor.orgId));
    const [org] = await tx
      .update(organizations)
      .set({ name: data.name, slug: data.slug, updatedAt: new Date() })
      .where(eq(organizations.id, actor.orgId))
      .returning();
    await audit(tx, actor, 'org.updated', {
      type: 'organization',
      id: actor.orgId,
      metadata: { from: { name: before?.name, slug: before?.slug }, to: data },
    });
    return org!;
  });
}

export async function setOrgLogo(actor: Actor, logoFileKey: string | null) {
  assertOrg(actor, 'org.update');
  await withTenant(actor.orgId, async (tx) => {
    await tx.update(organizations).set({ logoFileKey, updatedAt: new Date() }).where(eq(organizations.id, actor.orgId));
    await audit(tx, actor, logoFileKey ? 'org.logo_updated' : 'org.logo_removed', { type: 'organization', id: actor.orgId });
  });
}

export async function getOrganization(actor: Actor) {
  const [org] = await withTenant(actor.orgId, (tx) =>
    tx.select().from(organizations).where(eq(organizations.id, actor.orgId)),
  );
  return org!;
}

export const ONBOARDING_STEPS = ['template', 'invite', 'project'] as const;

export async function completeOnboardingStep(actor: Actor, step: (typeof ONBOARDING_STEPS)[number] | 'dismissed') {
  await withTenant(actor.orgId, (tx) =>
    tx
      .update(organizations)
      .set({
        onboarding: sql`(select coalesce(jsonb_agg(distinct v), '[]'::jsonb) from jsonb_array_elements_text(${organizations.onboarding} || ${JSON.stringify([step])}::jsonb) as v)`,
      })
      .where(eq(organizations.id, actor.orgId)),
  );
}

/** Soft-deletes the organization. Requires typing its name to confirm. */
export async function deleteOrganization(actor: Actor, input: unknown) {
  assertOrg(actor, 'org.delete');
  const { confirmName } = parse(z.object({ confirmName: z.string() }), input);
  await withTenant(actor.orgId, async (tx) => {
    const [org] = await tx.select().from(organizations).where(eq(organizations.id, actor.orgId));
    if (!org || org.name !== confirmName.trim()) {
      throw validation({ confirmName: 'Type the organization name exactly to confirm.' });
    }
    await tx.update(organizations).set({ deletedAt: new Date() }).where(eq(organizations.id, actor.orgId));
    await audit(tx, actor, 'org.deleted', { type: 'organization', id: actor.orgId });
  });
}

export async function transferOwnership(actor: Actor, input: unknown) {
  assertOrg(actor, 'org.transferOwnership');
  const { userId } = parse(z.object({ userId: z.uuid() }), input);
  if (userId === actor.userId) throw validation({ userId: 'Choose another member.' });
  await withTenant(actor.orgId, async (tx) => {
    const [target] = await tx
      .select()
      .from(memberships)
      .where(and(eq(memberships.orgId, actor.orgId), eq(memberships.userId, userId)));
    if (!target || target.status !== 'active' || target.role === 'client') {
      throw validation({ userId: 'Ownership can only go to an active internal member.' });
    }
    await tx.update(memberships).set({ role: 'owner', updatedAt: new Date() }).where(eq(memberships.id, target.id));
    await tx
      .update(memberships)
      .set({ role: 'admin', updatedAt: new Date() })
      .where(and(eq(memberships.orgId, actor.orgId), eq(memberships.userId, actor.userId)));
    await audit(tx, actor, 'org.ownership_transferred', { type: 'user', id: userId });
  });
}
