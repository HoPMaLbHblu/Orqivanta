import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { canOrg } from '@orqivanta/core';
import { SettingsNav } from '@/components/settings/settings-nav';
import { requireActor } from '@/lib/session';

/** Organization settings are for owners and admins; everyone else gets a 404. */
export default async function SettingsLayout({ children, params }: { children: React.ReactNode; params: Promise<{ org: string }> }) {
  const { org } = await params;
  const actor = await requireActor(org);
  if (!canOrg(actor.role, 'org.update')) notFound();
  const t = await getTranslations('settings');
  const base = `/${org}/settings`;
  const items = [
    { href: `${base}/general`, label: t('nav.general') },
    { href: `${base}/members`, label: t('nav.members') },
    { href: `${base}/invitations`, label: t('nav.invitations') },
    { href: `${base}/teams`, label: t('nav.teams') },
    { href: `${base}/clients`, label: t('nav.clients') },
    { href: `${base}/forms`, label: t('nav.forms') },
    { href: `${base}/labels`, label: t('nav.labels') },
    ...(canOrg(actor.role, 'audit.view') ? [{ href: `${base}/audit`, label: t('nav.audit') }] : []),
    ...(canOrg(actor.role, 'org.export') ? [{ href: `${base}/export`, label: t('nav.export') }] : []),
    { href: `${base}/trash`, label: t('nav.trash') },
  ];
  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6 lg:px-10">
      <p className="text-[12px] text-ink-3">{actor.orgName}</p>
      <h1 className="text-[22px] font-semibold tracking-[-0.01em] text-ink">{t('title')}</h1>
      <div className="mt-6 grid gap-6 lg:grid-cols-[180px_minmax(0,1fr)] lg:gap-10">
        <SettingsNav label={t('navLabel')} items={items} />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
