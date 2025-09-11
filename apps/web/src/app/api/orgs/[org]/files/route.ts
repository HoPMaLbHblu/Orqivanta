import { uploadFile } from '@orqivanta/core';
import { handleUpload } from '@/lib/upload-route';

export const runtime = 'nodejs';

/** Upload a new file. Fields: file (binary), meta (JSON: projectId, taskId, requestId, kind, name, description, sharedWithClient). */
export async function POST(req: Request, { params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  return handleUpload(req, org, async (actor, file, meta) => {
    const res = await uploadFile(actor, meta, file);
    return { fileId: res.file.id, versionId: res.version.id, name: res.file.name };
  });
}
