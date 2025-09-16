'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useId } from 'react';
import { setPortalEnabledAction } from '@/actions/projects';
import { Switch } from '@/components/ui/checkbox';
import { Card, CardHeader, Notice } from '@/components/ui/primitives';
import { useAction } from '@/lib/use-action';

/** Opens or closes this project in the client portal. Needs a linked client account. */
export function ProjectPortalCard({ org, projectId, enabled, clientName }: { org: string; projectId: string; enabled: boolean; clientName: string | null }) {
  const t = useTranslations('projects');
  const { call, pending } = useAction();
  const id = useId();
  return (
    <Card>
      <CardHeader title={t('portal.title')} description={t('portal.hint')} />
      <div className="flex flex-col gap-3 px-4 py-4">
        {clientName ? (
          <div className="flex items-start gap-3">
            <Switch
              id={id}
              checked={enabled}
              disabled={pending}
              aria-describedby={`${id}-desc`}
              onCheckedChange={(v) => call(() => setPortalEnabledAction(org, { projectId, enabled: v }), { success: v ? t('portal.enabled') : t('portal.disabled') })}
            />
            <label htmlFor={id} className="text-[13px] text-ink">
              {t('portal.toggle', { client: clientName })}
              <span id={`${id}-desc`} className="mt-0.5 block text-[12px] text-ink-3">
                {enabled ? t('portal.onDescription') : t('portal.offDescription')}
              </span>
            </label>
          </div>
        ) : (
          <Notice tone="attention">
            {t('portal.needsClient')}{' '}
            <Link href={`/${org}/clients`} className="font-medium underline">
              {t('portal.manageClients')}
            </Link>
          </Notice>
        )}
      </div>
    </Card>
  );
}
