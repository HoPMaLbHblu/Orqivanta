'use client';

import { useTranslations } from 'next-intl';
import { AlertTriangle, Database, Download, RefreshCw } from 'lucide-react';
import { requestExportAction } from '@/actions/settings';
import { Badge } from '@/components/domain/badges';
import { FormattedDate, RelativeTime } from '@/components/domain/dates';
import { Button } from '@/components/ui/button';
import { EmptyState, Notice } from '@/components/ui/primitives';
import { useAction } from '@/lib/use-action';
import { SettingsSection } from './settings-nav';

export interface ExportRow {
  id: string;
  status: 'queued' | 'ready' | 'failed';
  sizeBytes: number | null;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
  requestedByName: string | null;
}

const formatSize = (b: number | null) => (b === null ? '—' : b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} kB` : `${(b / 1048576).toFixed(1)} MB`);

export function ExportPanel({ org, exports }: { org: string; exports: ExportRow[] }) {
  const t = useTranslations('settings.export');
  const { call, pending } = useAction();
  const queued = exports.some((e) => e.status === 'queued');
  return (
    <SettingsSection
      title={t('title')}
      description={t('description')}
      action={
        <Button size="sm" variant="primary" loading={pending} disabled={queued} onClick={() => call(() => requestExportAction(org), { success: t('requested') })}>
          <Database /> {t('request')}
        </Button>
      }
    >
      <div className="flex flex-col gap-3 p-4">
        <Notice tone="neutral">{t('note')}</Notice>
        {queued ? (
          <Notice tone="info" icon={<RefreshCw />} action={<Button size="xs" onClick={() => location.reload()}>{t('refresh')}</Button>}>
            {t('inProgress')}
          </Notice>
        ) : null}
      </div>
      {exports.length ? (
        <ul className="divide-y divide-line border-t border-line">
          {exports.map((e) => {
            const expired = e.status === 'ready' && e.completedAt && Date.now() - new Date(e.completedAt).getTime() > 7 * 86_400_000;
            return (
              <li key={e.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] text-ink">
                    <FormattedDate date={e.createdAt} withTime />
                  </span>
                  <span className="block text-[12px] text-ink-3">
                    {t('requestedBy', { name: e.requestedByName ?? '—' })} · <RelativeTime date={e.createdAt} />
                    {e.status === 'ready' ? ` · ${formatSize(e.sizeBytes)}` : ''}
                  </span>
                </span>
                {e.status === 'queued' ? <Badge tone="info">{t('status.queued')}</Badge> : null}
                {e.status === 'failed' ? (
                  <Badge tone="danger" icon={AlertTriangle} title={e.error ?? undefined}>
                    {t('status.failed')}
                  </Badge>
                ) : null}
                {e.status === 'ready' ? (
                  expired ? (
                    <Badge tone="muted">{t('status.expired')}</Badge>
                  ) : (
                    <a href={`/api/orgs/${org}/exports/${e.id}`} download className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line-strong bg-surface px-2.5 text-[13px] font-medium text-ink hover:bg-surface-2">
                      <Download className="size-4" aria-hidden /> {t('download')}
                    </a>
                  )
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="border-t border-line">
          <EmptyState compact icon={<Database />} title={t('emptyTitle')} description={t('emptyBody')} />
        </div>
      )}
    </SettingsSection>
  );
}
