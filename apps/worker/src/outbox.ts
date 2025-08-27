import { and, eq, isNull, lte, outbox, sql, withSystem } from '@orqivanta/db';
import type { Logger } from 'pino';
import { handlers } from './handlers';

const BATCH = 10;
export const MAX_ATTEMPTS = 6;

/**
 * Claims and processes pending outbox items. Rows are locked with FOR UPDATE SKIP LOCKED,
 * so several workers can run side by side without processing an item twice. Failures are
 * retried with exponential backoff (30s, 1m, 2m, …) and parked with failed_at after
 * MAX_ATTEMPTS, where administrators can see them.
 */
export async function drainOutbox(log: Logger): Promise<number> {
  let processed = 0;
  for (;;) {
    const handled = await withSystem(async (tx) => {
      const rows = await tx
        .select()
        .from(outbox)
        .where(and(isNull(outbox.processedAt), isNull(outbox.failedAt), lte(outbox.runAfter, sql`now()`)))
        .orderBy(outbox.id)
        .limit(BATCH)
        .for('update', { skipLocked: true });
      for (const item of rows) {
        const handler = handlers[item.type];
        const started = Date.now();
        try {
          if (!handler) throw new Error(`No handler for outbox type "${item.type}"`);
          await handler(item.payload, log);
          await tx.update(outbox).set({ processedAt: new Date(), attempts: item.attempts + 1, lastError: null }).where(eq(outbox.id, item.id));
          log.info({ id: item.id, type: item.type, ms: Date.now() - started }, 'outbox item processed');
        } catch (err) {
          const attempts = item.attempts + 1;
          const message = err instanceof Error ? err.message : String(err);
          const failed = attempts >= MAX_ATTEMPTS;
          await tx
            .update(outbox)
            .set({
              attempts,
              lastError: message.slice(0, 1000),
              runAfter: sql`now() + make_interval(secs => ${30 * 2 ** (attempts - 1)})`,
              failedAt: failed ? new Date() : null,
            })
            .where(eq(outbox.id, item.id));
          log[failed ? 'error' : 'warn']({ id: item.id, type: item.type, attempts, err: message }, failed ? 'outbox item failed permanently' : 'outbox item failed, will retry');
        }
      }
      return rows.length;
    });
    processed += handled;
    if (handled < BATCH) return processed;
  }
}
