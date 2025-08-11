import { rateLimits, sql, withSystem } from '@orqivanta/db';
import { AppError } from '../errors';

/**
 * Fixed-window rate limiter stored in PostgreSQL, so it works across processes
 * without Redis. Throws RATE_LIMITED with a retry hint when the limit is exceeded.
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<void> {
  const [row] = await withSystem((tx) =>
    tx
      .insert(rateLimits)
      .values({ key, count: 1 })
      .onConflictDoUpdate({
        target: rateLimits.key,
        set: {
          count: sql`case when ${rateLimits.windowStartedAt} < now() - make_interval(secs => ${windowSeconds}) then 1 else ${rateLimits.count} + 1 end`,
          windowStartedAt: sql`case when ${rateLimits.windowStartedAt} < now() - make_interval(secs => ${windowSeconds}) then now() else ${rateLimits.windowStartedAt} end`,
        },
      })
      .returning({
        count: rateLimits.count,
        retryAfter: sql<number>`greatest(1, ceil(extract(epoch from (${rateLimits.windowStartedAt} + make_interval(secs => ${windowSeconds}) - now()))))::int`,
      }),
  );
  if (row && row.count > limit) {
    throw new AppError('RATE_LIMITED', 'Too many attempts. Please wait a moment and try again.', {
      retryAfterSeconds: row.retryAfter,
    });
  }
}
