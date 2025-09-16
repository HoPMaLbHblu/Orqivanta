import { getTranslations } from 'next-intl/server';
import { listFiles, listProjectCapabilities, storageUsage } from '@orqivanta/core';
import { FilesBrowser, type FilesProject, type FileRow } from '@/components/file-viewer/files-browser';
import { SampleDataBadge } from '@/components/domain/badges';
import { requireActor } from '@/lib/session';

export async function generateMetadata() {
  const t = await getTranslations('fileViewer.browser');
  return { title: t('title') };
}

type Search = { project?: string; type?: string; kind?: string; q?: string };

const TYPE_MATCH: Record<string, (mime: string) => boolean> = {
  image: (m) => m.startsWith('image/'),
  pdf: (m) => m === 'application/pdf',
  document: (m) => m.startsWith('text/') || m.includes('word') || m.includes('document') || m.includes('spreadsheet') || m.includes('presentation') || m === 'text/csv',
  other: (m) => !m.startsWith('image/') && m !== 'application/pdf' && !(m.startsWith('text/') || m.includes('word') || m.includes('document') || m.includes('spreadsheet') || m.includes('presentation')),
};

export default async function FilesPage({ params, searchParams }: { params: Promise<{ org: string }>; searchParams: Promise<Search> }) {
  const { org } = await params;
  const sp = await searchParams;
  const actor = await requireActor(org);
  const caps = await listProjectCapabilities(actor);
  const project = caps.find((p) => p.key === sp.project?.toUpperCase()) ?? null;
  const q = sp.q?.trim().slice(0, 100) || undefined;
  const kind = sp.kind === 'deliverable' || sp.kind === 'attachment' ? sp.kind : undefined;

  const [files, usage] = await Promise.all([listFiles(actor, { q, kind, ...(project ? { projectId: project.id } : {}) }), storageUsage(actor)]);
  const typeFilter = sp.type && TYPE_MATCH[sp.type] ? TYPE_MATCH[sp.type]! : null;

  const rows: FileRow[] = files
    .filter((f) => (typeFilter ? typeFilter(f.mimeType) : true))
    .map((f) => ({
      id: f.id,
      name: f.name,
      description: f.description,
      kind: f.kind,
      projectKey: f.projectKey,
      projectName: f.projectName,
      projectColor: caps.find((p) => p.id === f.projectId)?.color ?? null,
      sharedWithClient: f.sharedWithClient,
      currentVersion: f.currentVersion,
      updatedAt: f.updatedAt,
      versionId: f.versionId,
      mimeType: f.mimeType,
      sizeBytes: Number(f.sizeBytes),
      uploadedByName: f.uploadedByName,
      approvalStatus: f.approvalStatus,
    }));

  const projects: FilesProject[] = caps.map((p) => ({ id: p.id, key: p.key, name: p.name, color: p.color, canUpload: p.canUpload, hasClient: p.hasClient, canShare: p.canShare }));

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6 lg:px-10">
      <FilesBrowser
        org={org}
        files={rows}
        projects={projects}
        usage={usage}
        filters={{ project: project?.key ?? '', type: sp.type && TYPE_MATCH[sp.type] ? sp.type : '', kind: kind ?? '', q: q ?? '' }}
        sampleBadge={actor.isDemo ? <SampleDataBadge /> : null}
      />
    </div>
  );
}
