import { sql, withSystem } from '@orqivanta/db';

export const dynamic = 'force-dynamic';

/** Liveness and database reachability, for uptime checks. */
export async function GET() {
  const started = Date.now();
  try {
    await withSystem((tx) => tx.execute(sql`select 1`));
    return Response.json({ status: 'ok', db: 'ok', ms: Date.now() - started });
  } catch {
    return Response.json({ status: 'degraded', db: 'unreachable' }, { status: 503 });
  }
}
