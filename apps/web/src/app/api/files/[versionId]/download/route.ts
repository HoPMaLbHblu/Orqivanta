import { serveFileVersion } from '@/lib/files-route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request, { params }: { params: Promise<{ versionId: string }> }) {
  const { versionId } = await params;
  const inline = new URL(req.url).searchParams.get('inline') === '1';
  return serveFileVersion(versionId, { preview: false, forceDownload: !inline });
}
