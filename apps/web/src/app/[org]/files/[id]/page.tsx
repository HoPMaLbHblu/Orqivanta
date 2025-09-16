import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { AppError, getApproval, getFile, listProjectCapabilities } from '@orqivanta/core';
import { FileViewer } from '@/components/file-viewer/viewer';
import { requireActor } from '@/lib/session';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({ params }: { params: Promise<{ org: string; id: string }> }) {
  const { org, id } = await params;
  const t = await getTranslations('fileViewer');
  if (!UUID.test(id)) return { title: t('title') };
  const actor = await requireActor(org);
  const data = await getFile(actor, id).catch(() => null);
  return { title: data?.file.name ?? t('title') };
}

export default async function FilePage({ params }: { params: Promise<{ org: string; id: string }> }) {
  const { org, id } = await params;
  if (!UUID.test(id)) notFound();
  const actor = await requireActor(org);
  const data = await getFile(actor, id).catch((err) => {
    if (err instanceof AppError && err.code === 'NOT_FOUND') notFound();
    throw err;
  });

  const caps = data.project ? await listProjectCapabilities(actor) : [];
  const cap = data.project ? caps.find((p) => p.id === data.project!.id) : undefined;
  // Each approval names the version it is pinned to, and who still has to decide.
  const approvals = await Promise.all(
    data.approvals.map(async (a) => {
      const full = await getApproval(actor, a.id).catch(() => null);
      return {
        id: a.id,
        title: a.title,
        status: a.status,
        round: a.round,
        createdAt: a.createdAt,
        fileVersionId: a.fileVersionId,
        dueDate: full?.approval.dueDate ?? null,
        reviewers: (full?.reviewers ?? []).map((r) => ({ name: r.name, color: r.avatarColor, decision: r.decision })),
      };
    }),
  );

  return (
    <FileViewer
      org={org}
      file={{
        id: data.file.id,
        name: data.file.name,
        description: data.file.description,
        kind: data.file.kind,
        currentVersion: data.file.currentVersion,
        sharedWithClient: data.file.sharedWithClient,
        createdAt: data.file.createdAt,
        updatedAt: data.file.updatedAt,
      }}
      project={data.project ? { ...data.project, color: cap?.color ?? null, archived: Boolean(cap?.archived) } : null}
      access={data.access}
      versions={data.versions.map((v) => ({
        id: v.id,
        version: v.version,
        originalName: v.originalName,
        mimeType: v.mimeType,
        sizeBytes: Number(v.sizeBytes),
        note: v.note,
        status: v.status,
        createdAt: v.createdAt,
        hasPreview: Boolean(v.previewKey),
        previewable: v.previewable,
        uploadedByName: v.uploadedByName,
        uploadedByColor: v.uploadedByColor,
      }))}
      approvals={approvals}
      task={data.task}
      request={data.request}
    />
  );
}
