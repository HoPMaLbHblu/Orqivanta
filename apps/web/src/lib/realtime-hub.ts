import 'server-only';
import pg from 'pg';
import { realtimeEvents, eq, withSystem } from '@orqivanta/db';

export interface RealtimeEvent {
  id: number;
  orgId: string;
  channel: string;
  type: string;
  entityId: string | null;
  payload: Record<string, unknown>;
}

type Listener = (e: RealtimeEvent) => void;

/**
 * One LISTEN connection per server process, shared by every open event stream. Postgres
 * only delivers NOTIFY after commit, so subscribers never hear about rolled-back work.
 * Each event row is read once and fanned out to that organization's listeners.
 */
class Hub {
  private client: pg.Client | null = null;
  private connecting: Promise<void> | null = null;
  private listeners = new Map<string, Set<Listener>>();

  async subscribe(orgId: string, fn: Listener) {
    await this.ensure();
    let set = this.listeners.get(orgId);
    if (!set) this.listeners.set(orgId, (set = new Set()));
    set.add(fn);
    return () => {
      set!.delete(fn);
      if (set!.size === 0) this.listeners.delete(orgId);
    };
  }

  private ensure() {
    if (this.client) return Promise.resolve();
    this.connecting ??= (async () => {
      const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
      client.on('error', () => this.reset());
      client.on('end', () => this.reset());
      client.on('notification', (msg) => void this.onNotify(msg.payload));
      await client.connect();
      await client.query('LISTEN orq_realtime');
      this.client = client;
    })().finally(() => {
      this.connecting = null;
    });
    return this.connecting;
  }

  private reset() {
    this.client = null;
    // Streams notice the drop through their heartbeat and reconnect with Last-Event-ID.
    for (const set of this.listeners.values()) for (const fn of set) fn({ id: -1, orgId: '', channel: 'system', type: 'hub.reset', entityId: null, payload: {} });
  }

  private async onNotify(raw: string | undefined) {
    if (!raw) return;
    let msg: { id: number; org: string };
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    const set = this.listeners.get(msg.org);
    if (!set?.size) return;
    const [row] = await withSystem((tx) => tx.select().from(realtimeEvents).where(eq(realtimeEvents.id, msg.id)));
    if (!row) return;
    const event: RealtimeEvent = { id: row.id, orgId: row.orgId, channel: row.channel, type: row.type, entityId: row.entityId, payload: row.payload };
    for (const fn of set) fn(event);
  }
}

const g = globalThis as unknown as { __orqHub?: Hub };
export const hub = (g.__orqHub ??= new Hub());
