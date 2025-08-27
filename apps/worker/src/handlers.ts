import sharp from 'sharp';
import { buildOrgExport, deliverEmail, IMAGE_TYPES, storage, type EmailJob } from '@orqivanta/core';
import { eq, fileVersions, withSystem } from '@orqivanta/db';
import type { Logger } from 'pino';

type Handler = (payload: Record<string, unknown>, log: Logger) => Promise<void>;

async function streamToBuffer(stream: NodeJS.ReadableStream) {
  const chunks: Buffer[] = [];
  for await (const c of stream) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c as string));
  return Buffer.concat(chunks);
}

export const handlers: Record<string, Handler> = {
  async email(payload) {
    await deliverEmail(payload as unknown as EmailJob);
  },

  /** Reads image dimensions and writes a 1200px WebP preview next to the original. */
  async 'file.preview'(payload, log) {
    const versionId = String(payload.versionId);
    const [v] = await withSystem((tx) => tx.select().from(fileVersions).where(eq(fileVersions.id, versionId)));
    if (!v || !IMAGE_TYPES.has(v.mimeType) || v.previewKey) return;
    const { stream } = await storage.get(v.storageKey);
    const input = await streamToBuffer(stream);
    const image = sharp(input, { limitInputPixels: 80_000_000, animated: false });
    const meta = await image.metadata();
    const preview = await image.rotate().resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
    const previewKey = `${v.storageKey.replace(/^f\//, 'p/')}`;
    if (!(await storage.exists(previewKey))) await storage.put(previewKey, preview);
    await withSystem((tx) => tx.update(fileVersions).set({ previewKey, width: meta.width ?? null, height: meta.height ?? null }).where(eq(fileVersions.id, versionId)));
    log.debug({ versionId }, 'preview generated');
  },

  async 'org.export'(payload) {
    await buildOrgExport(String(payload.exportId));
  },
};
