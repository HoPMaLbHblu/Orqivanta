import { randomUUID } from 'node:crypto';
import { memberships, users, withSystem } from '@orqivanta/db';
import { createOrganization, resolveActorById, saveClient, type Actor, type OrgRole } from '../src';

export async function makeUser(name = 'Test User') {
  const [u] = await withSystem((tx) =>
    tx.insert(users).values({ email: `${randomUUID()}@test.example`, name, emailVerifiedAt: new Date() }).returning({ id: users.id }),
  );
  return u!.id;
}

/** An organization with an owner, plus helpers to add people in other roles. */
export async function makeOrg(name = 'Test Studio') {
  const ownerId = await makeUser('Owner');
  const org = await createOrganization(ownerId, { name, slug: `t-${randomUUID().slice(0, 12)}` });
  const owner = (await resolveActorById(ownerId, org.id))!;
  const add = async (role: Exclude<OrgRole, 'owner'>, clientAccountId: string | null = null): Promise<Actor> => {
    const userId = await makeUser(role);
    await withSystem((tx) => tx.insert(memberships).values({ orgId: org.id, userId, role, clientAccountId }));
    return (await resolveActorById(userId, org.id))!;
  };
  const client = async (clientName = 'Acme') => {
    const account = await saveClient(owner, { name: clientName });
    return { account, contact: await add('client', account.id) };
  };
  return { org, owner, add, client };
}

export async function expectCode(p: Promise<unknown>, code: string) {
  try {
    await p;
  } catch (err) {
    if ((err as { code?: string }).code === code) return err;
    throw err;
  }
  throw new Error(`Expected ${code}, but the call succeeded`);
}
