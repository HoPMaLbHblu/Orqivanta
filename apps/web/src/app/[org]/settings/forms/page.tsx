import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { ClipboardList, Plus } from 'lucide-react';
import { listForms } from '@orqivanta/core';
import { Badge } from '@/components/domain/badges';
import { SettingsSection } from '@/components/settings/settings-nav';
import { EmptyState } from '@/components/ui/primitives';
import { requireActor } from '@/lib/session';

export async function generateMetadata() {
  const t = await getTranslations('settings');
  return { title: t('nav.forms') };
}

export default async function FormsSettings({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const actor = await requireActor(org);
  const t = await getTranslations('settings.forms');
  const forms = await listForms(actor, { includeInactive: true });
  return (
    <SettingsSection
      title={t('title')}
      description={t('description')}
      action={
        <Link href={`/${org}/settings/forms/new`} className="inline-flex h-8 items-center gap-1.5 rounded-md bg-accent px-2.5 text-[13px] font-medium text-accent-ink hover:bg-accent-hover">
          <Plus className="size-4" aria-hidden /> {t('newForm')}
        </Link>
      }
    >
      {forms.length ? (
        <ul className="divide-y divide-line">
          {forms.map((f) => (
            <li key={f.id}>
              <Link href={`/${org}/settings/forms/${f.id}`} className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-surface-2">
                <ClipboardList className="size-4 shrink-0 text-ink-3" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-ink">{f.name}</span>
                  <span className="block truncate text-[12px] text-ink-3">{f.description ?? t('noDescription')}</span>
                </span>
                <span className="text-[12px] text-ink-3">{t('fieldCount', { count: f.fields.length })}</span>
                <Badge tone="neutral">{t(`audience${f.audience === 'both' ? 'Both' : f.audience === 'client' ? 'Client' : 'Internal'}`)}</Badge>
                {f.active ? null : <Badge tone="attention">{t('inactive')}</Badge>}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState compact icon={<ClipboardList />} title={t('emptyTitle')} description={t('emptyBody')} />
      )}
    </SettingsSection>
  );
}
