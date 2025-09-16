'use client';

import { useTranslations } from 'next-intl';
import { RotateCcw, Trash2 } from 'lucide-react';
import { restoreProjectAction } from '@/actions/settings';
import { RelativeTime } from '@/components/domain/dates';
import { Button } from '@/components/ui/button';
import { EmptyState, Mono } from '@/components/ui/primitives';
import { useAction } from '@/lib/use-action';
import { SettingsSection } from './settings-nav';

export interface TrashRow {
  id: string;
  key: string;
  name: string;
  deletedAt: string;
}

export function TrashPanel({ org, projects }: { org: string; projects: TrashRow[] }) {
  const t = useTranslations('settings.trash');
  const { call } = useAction();
  return (
    <SettingsSection title={t('title')} description={t('description')}>
      {projects.length ? (
        <ul className="divide-y divide-line">
          {projects.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
              <Mono className="w-14 shrink-0">{p.key}</Mono>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-ink">{p.name}</span>
                <span className="block text-[12px] text-ink-3">
                  {t('deleted')} <RelativeTime date={p.deletedAt} />
                </span>
              </span>
              <Button size="sm" onClick={() => call(() => restoreProjectAction(org, p.id), { success: t('restored', { name: p.name }) })}>
                <RotateCcw /> {t('restore')}
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState compact icon={<Trash2 />} title={t('emptyTitle')} description={t('emptyBody')} />
      )}
    </SettingsSection>
  );
}
