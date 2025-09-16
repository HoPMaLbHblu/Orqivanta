import { getTranslations } from 'next-intl/server';
import { listDeletedProjects } from '@orqivanta/core';
import { TrashPanel } from '@/components/settings/trash-panel';
import { requireActor } from '@/lib/session';

export async function generateMetadata() {
  const t = await getTranslations('settings');
  return { title: t('nav.trash') };
}

export default async function TrashSettings({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const actor = await requireActor(org);
  const projects = await listDeletedProjects(actor);
  return <TrashPanel org={org} projects={projects.map((p) => ({ id: p.id, key: p.key, name: p.name, deletedAt: p.deletedAt!.toISOString() }))} />;
}
