import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { AppError, getDocument, getDocumentVersion, listDocumentVersions } from '@orqivanta/core';
import { VersionHistory } from '@/components/documents/version-history';
import { requireActor } from '@/lib/session';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function load<T>(p: Promise<T>): Promise<T> {
  try {
    return await p;
  } catch (err) {
    if (err instanceof AppError && err.code === 'NOT_FOUND') notFound();
    throw err;
  }
}

export async function generateMetadata() {
  const t = await getTranslations('documents.historyPage');
  return { title: t('title') };
}

export default async function DocumentHistoryPage({ params, searchParams }: { params: Promise<{ org: string; id: string }>; searchParams: Promise<{ v?: string }> }) {
  const { org, id } = await params;
  const { v } = await searchParams;
  if (!UUID.test(id)) notFound();
  const actor = await requireActor(org);
  const data = await load(getDocument(actor, id));
  if (data.doc.deletedAt) notFound();
  const versions = await load(listDocumentVersions(actor, id));
  const selectedId = v && UUID.test(v) && versions.some((x) => x.id === v) ? v : versions[0]?.id;
  const selected = selectedId ? await load(getDocumentVersion(actor, id, selectedId)) : null;

  return (
    <VersionHistory
      org={org}
      doc={{ id, title: data.doc.title, version: data.doc.version, projectKey: data.project?.key ?? null }}
      canEdit={data.access.canEdit}
      versions={versions.map((x) => ({ ...x, length: Number(x.length) }))}
      selected={selected ? { id: selected.id, version: selected.version, title: selected.title, content: selected.content, label: selected.label, createdAt: selected.createdAt } : null}
    />
  );
}
