import { Readable } from 'node:stream';
import { AppError, getExportDownload, httpStatus, resolveActor, storage } from '@orqivanta/core';
import { getSession } from '@/lib/session';

export const runtime = 'nodejs';

/** Downloads a finished organization export. Permission is checked on every request. */
export async function GET(_req: Request, { params }: { params: Promise<{ org: string; id: string }> }) {
  const { org, id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response('Not found', { status: 404 });
  const session = await getSession();
  if (!session) return new Response('Not found', { status: 404 });
  const actor = await resolveActor(session.user.id, org);
  if (!actor) return new Response('Not found', { status: 404 });
  try {
    const dl = await getExportDownload(actor, id);
    const { stream, size } = await storage.get(dl.storageKey);
    return new Response(Readable.toWeb(stream as Readable) as ReadableStream, {
      headers: {
        'Content-Type': 'application/gzip',
        'Content-Length': String(size),
        'Content-Disposition': `attachment; filename="${dl.name}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (err) {
    if (err instanceof AppError) return new Response(err.message, { status: httpStatus[err.code] === 403 ? 404 : httpStatus[err.code] });
    console.error('[exports] download failed', err);
    return new Response('Not found', { status: 404 });
  }
}
