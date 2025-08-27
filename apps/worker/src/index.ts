import { closeDb, getPool } from '@orqivanta/db';
import pino from 'pino';
import { drainOutbox } from './outbox';
import { runSchedule } from './scheduler';

const log = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  transport: process.env.NODE_ENV === 'production' ? undefined : { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } },
});

const POLL_MS = 5_000;
let stopping = false;
let draining: Promise<unknown> | null = null;
let wakeAgain = false;

/** Coalesces wake-ups: one drain at a time, and one more pass if work arrived meanwhile. */
function wake() {
  if (stopping) return;
  if (draining) {
    wakeAgain = true;
    return;
  }
  draining = drainOutbox(log)
    .catch((err) => log.error({ err: err instanceof Error ? err.message : String(err) }, 'outbox drain failed'))
    .finally(() => {
      draining = null;
      if (wakeAgain) {
        wakeAgain = false;
        wake();
      }
    });
}

/**
 * LISTEN gives near-instant delivery; polling covers retries whose backoff has elapsed and
 * any notification lost while the listener was reconnecting.
 */
async function listen() {
  while (!stopping) {
    const client = await getPool().connect().catch((err) => {
      log.warn({ err: err.message }, 'database unavailable, retrying');
      return null;
    });
    if (!client) {
      await new Promise((r) => setTimeout(r, POLL_MS));
      continue;
    }
    try {
      client.on('notification', () => wake());
      await client.query('LISTEN orq_outbox');
      log.info('listening for outbox notifications');
      await new Promise<void>((resolve) => {
        client.once('error', (err) => {
          log.warn({ err: err.message }, 'listener connection lost');
          resolve();
        });
        const check = setInterval(() => {
          if (stopping) {
            clearInterval(check);
            resolve();
          }
        }, 500);
      });
    } finally {
      client.removeAllListeners('notification');
      client.release(true);
    }
  }
}

async function main() {
  log.info('worker starting');
  void listen();
  wake();
  const poll = setInterval(wake, POLL_MS);
  const schedule = async () => {
    if (stopping) return;
    await runSchedule(log).catch((err) => log.error({ err: err instanceof Error ? err.message : String(err) }, 'schedule failed'));
  };
  void schedule();
  const scheduleTimer = setInterval(schedule, 60_000);

  const shutdown = async (signal: string) => {
    if (stopping) return;
    stopping = true;
    log.info({ signal }, 'worker stopping');
    clearInterval(poll);
    clearInterval(scheduleTimer);
    await draining;
    await closeDb();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

void main();
