import { and, asc, eq, gt, projects, realtimeEvents, withSystem, withTenant } from '@orqivanta/db';
import { visibleProjectsSql } from '@orqivanta/core';
import { getActor } from '@/lib/session';
import { hub, type RealtimeEvent } from '@/lib/realtime-hub';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Server-Sent Events for one organization. Events carry ids and types only, never content:
 * the browser re-fetches through the normal permission-checked pages. Channels are filtered
 * per person: their own user channel, projects they can open (re-checked every minute), and
 * organization-wide events for internal members.
 */
export async function GET(req: Request, { params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const actor = await getActor(org);
  if (!actor) return new Response('Not found', { status: 404 });

  let visible = new Set<string>();
  const refreshVisible = async () => {
    const rows = await withTenant(actor.orgId, (tx) => tx.select({ id: projects.id }).from(projects).where(and(eq(projects.orgId, actor.orgId), visibleProjectsSql(actor))));
    visible = new Set(rows.map((r) => r.id));
  };
  await refreshVisible();

  const allowed = (e: RealtimeEvent) => {
    if (e.channel === `user:${actor.userId}`) return true;
    if (e.channel === 'org') return actor.role !== 'client';
    if (e.channel.startsWith('project:')) return visible.has(e.channel.slice(8));
    return false;
  };

  const encoder = new TextEncoder();
  let cleanup = () => {};
  const stream = new ReadableStream({
    async start(controller) {
      const send = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          cleanup();
        }
      };
      const deliver = (e: RealtimeEvent) => {
        if (e.type === 'hub.reset') {
          send('event: reset\ndata: {}\n\n');
          return;
        }
        if (!allowed(e)) return;
        send(`id: ${e.id}\nevent: change\ndata: ${JSON.stringify({ channel: e.channel, type: e.type, entityId: e.entityId, payload: e.payload })}\n\n`);
      };

      send('retry: 3000\n\n');
      // Replay anything missed since the browser's last event (after a reconnect).
      const lastId = Number(req.headers.get('last-event-id') ?? new URL(req.url).searchParams.get('since') ?? 0);
      if (lastId > 0) {
        const missed = await withSystem((tx) => tx.select().from(realtimeEvents).where(and(eq(realtimeEvents.orgId, actor.orgId), gt(realtimeEvents.id, lastId))).orderBy(asc(realtimeEvents.id)).limit(200));
        for (const r of missed) deliver({ id: r.id, orgId: r.orgId, channel: r.channel, type: r.type, entityId: r.entityId, payload: r.payload });
      }
      const unsubscribe = await hub.subscribe(actor.orgId, deliver);
      const heartbeat = setInterval(() => send(': ping\n\n'), 25_000);
      const recheck = setInterval(() => void refreshVisible().catch(() => {}), 60_000);
      cleanup = () => {
        clearInterval(heartbeat);
        clearInterval(recheck);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // already closed
        }
      };
      req.signal.addEventListener('abort', () => cleanup());
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
