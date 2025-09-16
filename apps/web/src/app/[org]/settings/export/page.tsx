import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { canOrg, listExports } from '@orqivanta/core';
import { ExportPanel } from '@/components/settings/export-panel';
import { requireActor } from '@/lib/session';

export async function generateMetadata() {
  const t = await getTranslations('settings');
  return { title: t('nav.export') };
}

export default async function ExportSettings({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const actor = await requireActor(org);
  if (!canOrg(actor.role, 'org.export')) notFound();
  const exports = await listExports(actor);
  return (
    <ExportPanel
      org={org}
      exports={exports.map((e) => ({ id: e.id, status: e.status, sizeBytes: e.sizeBytes, error: e.error, createdAt: e.createdAt.toISOString(), completedAt: e.completedAt?.toISOString() ?? null, requestedByName: e.requestedByName }))}
    />
  );
}
