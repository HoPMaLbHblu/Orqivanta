import { getTranslations } from 'next-intl/server';
import { listLabels } from '@orqivanta/core';
import { sql, withTenant } from '@orqivanta/db';
import { LabelsPanel } from '@/components/settings/labels-panel';
import { requireActor } from '@/lib/session';

export async function generateMetadata() {
  const t = await getTranslations('settings');
  return { title: t('nav.labels') };
}

export default async function LabelsSettings({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const actor = await requireActor(org);
  const labels = await listLabels(actor);
  const counts = await withTenant(actor.orgId, async (tx) => {
    const rows = await tx.execute<{ label_id: string; n: number }>(sql`select label_id, count(*)::int as n from task_labels where org_id = ${actor.orgId} group by label_id`);
    return new Map(rows.rows.map((r) => [r.label_id, r.n]));
  });
  return <LabelsPanel org={org} labels={labels.map((l) => ({ id: l.id, name: l.name, color: l.color, useCount: counts.get(l.id) ?? 0 }))} />;
}
