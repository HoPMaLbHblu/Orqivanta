import { uploadFileVersion } from '@orqivanta/core';
import { handleUpload } from '@/lib/upload-route';

export const runtime = 'nodejs';

/** Upload a new version of an existing file. A pending review on the old version reopens on this one. */
export async function POST(req: Request, { params }: { params: Promise<{ org: string; fileId: string }> }) {
  const { org, fileId } = await params;
  return handleUpload(req, org, async (actor, file, meta) => {
    const res = await uploadFileVersion(actor, { fileId, note: meta.note }, file);
    return { fileId, versionId: res.version.id, version: res.version.version, reopenedApprovals: res.reopenedApprovals };
  });
}
