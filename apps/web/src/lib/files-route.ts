import 'server-only';
import { Readable } from 'node:stream';
import { AppError, getDownload, httpStatus, resolveActorById, storage } from '@orqivanta/core';
import { eq, fileVersions, withSystem } from '@orqivanta/db';
import { getSession } from './session';

/**
 * Streams a stored file after the same permission check the app uses everywhere. Missing
 * files and files the viewer may not see both return 404, so ids reveal nothing.
 */
export async function serveFileVersion(versionId: string, opts: { preview: boolean; forceDownload: boolean }) {
  if (!/^[0-9a-f-]{36}$/i.test(versionId)) return new Response('Not found', { status: 404 });
  const session = await getSession();
  if (!session) return new Response('Not found', { status: 404 });
  const [row] = await withSystem((tx) => tx.select({ orgId: fileVersions.orgId }).from(fileVersions).where(eq(fileVersions.id, versionId)));
  if (!row) return new Response('Not found', { status: 404 });
  const actor = await resolveActorById(session.user.id, row.orgId);
  if (!actor) return new Response('Not found', { status: 404 });
  try {
    const dl = await getDownload(actor, versionId, { preview: opts.preview });
    const { stream, size } = await storage.get(dl.storageKey);
    const inline = !opts.forceDownload && dl.inline;
    const fileName = opts.preview && dl.mimeType === 'image/webp' && !dl.name.endsWith('.webp') ? `${dl.name}.webp` : dl.name;
    return new Response(Readable.toWeb(stream as Readable) as ReadableStream, {
      headers: {
        'Content-Type': dl.mimeType,
        'Content-Length': String(size),
        'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${asciiName(fileName)}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        'Cache-Control': 'private, max-age=300',
        'X-Content-Type-Options': 'nosniff',
        ETag: `"${dl.sha256}${opts.preview ? '-p' : ''}"`,
      },
    });
  } catch (err) {
    if (err instanceof AppError) return new Response(err.message, { status: httpStatus[err.code] === 403 ? 404 : httpStatus[err.code] });
    console.error('[files] download failed', err);
    return new Response('Not found', { status: 404 });
  }
}

function asciiName(name: string) {
  return name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
}
