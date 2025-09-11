import { serveFileVersion } from '@/lib/files-route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Image previews (resized WebP when available) and inline PDFs. */
export async function GET(_req: Request, { params }: { params: Promise<{ versionId: string }> }) {
  const { versionId } = await params;
  return serveFileVersion(versionId, { preview: true, forceDownload: false });
}
