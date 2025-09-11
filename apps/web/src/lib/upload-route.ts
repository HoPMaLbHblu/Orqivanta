import 'server-only';
import { AppError, config, httpStatus } from '@orqivanta/core';
import { actorFor } from './session';

export type Actor = Awaited<ReturnType<typeof actorFor>>;

/** Shared handling for multipart uploads: size limit, auth, and JSON error responses. */
export async function handleUpload(req: Request, org: string, fn: (actor: Actor, file: { buffer: Buffer; originalName: string }, meta: Record<string, unknown>) => Promise<unknown>) {
  try {
    const length = Number(req.headers.get('content-length') ?? 0);
    if (length > config.maxUploadBytes + 1024 * 1024) throw new AppError('VALIDATION', 'Please check the highlighted fields.', { fieldErrors: { file: `Files can be up to ${Math.round(config.maxUploadBytes / 1048576)} MB.` } });
    const actor = await actorFor(org);
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) throw new AppError('VALIDATION', 'Please check the highlighted fields.', { fieldErrors: { file: 'Choose a file to upload.' } });
    let meta: Record<string, unknown> = {};
    try {
      meta = JSON.parse(String(form.get('meta') ?? '{}'));
    } catch {
      meta = {};
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const data = await fn(actor, { buffer, originalName: file.name }, meta);
    return Response.json({ ok: true, data });
  } catch (err) {
    if (err instanceof AppError) return Response.json({ ok: false, error: { code: err.code, message: err.message, ...err.details } }, { status: httpStatus[err.code] });
    console.error('[upload] failed', err);
    return Response.json({ ok: false, error: { code: 'INTERNAL', message: 'Something went wrong on our side. Please try again.' } }, { status: 500 });
  }
}
