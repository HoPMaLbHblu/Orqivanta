import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { ScrollText } from 'lucide-react';
import { canOrg, listAudit } from '@orqivanta/core';
import { Avatar } from '@/components/domain/avatar';
import { RelativeTime } from '@/components/domain/dates';
import { SettingsSection } from '@/components/settings/settings-nav';
import { NativeSelect } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { EmptyState, Mono } from '@/components/ui/primitives';
import { requireActor } from '@/lib/session';
import { notFound } from 'next/navigation';

export async function generateMetadata() {
  const t = await getTranslations('settings');
  return { title: t('nav.audit') };
}

const PREFIXES = ['org', 'member', 'invitation', 'team', 'project', 'client', 'form', 'approval', 'request', 'document', 'file'];

export default async function AuditSettings({ params, searchParams }: { params: Promise<{ org: string }>; searchParams: Promise<{ action?: string; before?: string }> }) {
  const { org } = await params;
  const sp = await searchParams;
  const actor = await requireActor(org);
  if (!canOrg(actor.role, 'audit.view')) notFound();
  const t = await getTranslations('settings.audit');
  const action = PREFIXES.includes(sp.action ?? '') ? sp.action : undefined;
  const before = sp.before && !Number.isNaN(Date.parse(sp.before)) ? new Date(sp.before).toISOString() : undefined;
  const page = await listAudit(actor, { action: action ? `${action}.` : undefined, before, limit: 50 });
  const href = (p: { action?: string | null; before?: string | null }) => {
    const q = new URLSearchParams();
    const a = p.action === undefined ? action : p.action;
    if (a) q.set('action', a);
    if (p.before) q.set('before', p.before);
    const s = q.toString();
    return `/${org}/settings/audit${s ? `?${s}` : ''}`;
  };

  return (
    <SettingsSection
      title={t('title')}
      description={t('description')}
      action={
        <form className="flex items-center gap-2">
          <label htmlFor="audit-action" className="text-[12px] text-ink-3">
            {t('filter')}
          </label>
          <NativeSelect id="audit-action" name="action" defaultValue={action ?? ''} className="h-8 w-44 text-[13px]">
            <option value="">{t('allActions')}</option>
            {PREFIXES.map((p) => (
              <option key={p} value={p}>
                {t(`area.${p}` as never)}
              </option>
            ))}
          </NativeSelect>
          <Button type="submit" size="sm">
            {t('apply')}
          </Button>
        </form>
      }
    >
      {page.items.length ? (
        <>
          <ul className="divide-y divide-line">
            {page.items.map((e) => (
              <li key={e.id} className="flex items-start gap-3 px-4 py-2.5">
                <Avatar name={e.actorName ?? t('system')} size="sm" title="" className="mt-0.5" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] text-ink">
                    <span className="font-medium">{e.actorName ?? t('system')}</span>{' '}
                    <Mono className="text-ink-2">{e.action}</Mono>
                  </span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[12px] text-ink-3">
                    <RelativeTime date={e.createdAt} />
                    {e.targetType ? (
                      <>
                        <span aria-hidden>·</span>
                        <span>{e.targetType}</span>
                      </>
                    ) : null}
                    {e.ipAddress ? (
                      <>
                        <span aria-hidden>·</span>
                        <span className="font-mono">{e.ipAddress}</span>
                      </>
                    ) : null}
                  </span>
                  {e.metadata && Object.keys(e.metadata).length ? <span className="mt-1 block truncate font-mono text-[11px] text-ink-3">{JSON.stringify(e.metadata)}</span> : null}
                </span>
              </li>
            ))}
          </ul>
          <div className="flex justify-center gap-4 border-t border-line px-4 py-3 text-[13px]">
            {before ? (
              <Link href={href({ before: null })} className="font-medium text-ink-2 hover:text-ink hover:underline">
                {t('newest')}
              </Link>
            ) : null}
            {page.nextCursor ? (
              <Link href={href({ before: page.nextCursor })} className="font-medium text-accent hover:underline">
                {t('older')}
              </Link>
            ) : null}
          </div>
        </>
      ) : (
        <EmptyState compact icon={<ScrollText />} title={action ? t('filteredEmptyTitle') : t('emptyTitle')} description={action ? t('filteredEmptyBody') : t('emptyBody')} action={action ? <Link href={href({ action: null })} className="text-[13px] font-medium text-accent hover:underline">{t('allActions')}</Link> : undefined} />
      )}
    </SettingsSection>
  );
}
