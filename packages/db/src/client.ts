import { sql } from 'drizzle-orm';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema/index';

export type Schema = typeof schema;
export type Database = NodePgDatabase<Schema>;
export type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

const globalForDb = globalThis as unknown as { __orqPool?: pg.Pool; __orqDb?: Database };

function connectionString() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set. Copy .env.example to .env and adjust it.');
  return url;
}

export function getPool(): pg.Pool {
  if (!globalForDb.__orqPool) {
    globalForDb.__orqPool = new pg.Pool({
      connectionString: connectionString(),
      max: Number(process.env.DATABASE_POOL_SIZE ?? 10),
      idleTimeoutMillis: 30_000,
    });
  }
  return globalForDb.__orqPool;
}

function getDb(): Database {
  if (!globalForDb.__orqDb) globalForDb.__orqDb = drizzle(getPool(), { schema });
  return globalForDb.__orqDb;
}

/**
 * Runs `fn` in a transaction scoped to one organization. Row-level security policies
 * restrict every tenant table to rows whose org_id matches, so a query that forgets a
 * WHERE org_id clause still cannot read or write another tenant's data.
 */
export async function withTenant<T>(orgId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return getDb().transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.org_id', ${orgId}, true)`);
    return fn(tx);
  });
}

/**
 * Runs `fn` in a transaction that may cross tenants. Only for authentication, invitation
 * acceptance, background jobs and listing a user's own memberships. Every call site is
 * reviewed; request handlers for tenant data must use withTenant.
 */
export async function withSystem<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return getDb().transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.bypass_rls', 'on', true)`);
    return fn(tx);
  });
}

export async function closeDb() {
  await globalForDb.__orqPool?.end();
  globalForDb.__orqPool = undefined;
  globalForDb.__orqDb = undefined;
}
