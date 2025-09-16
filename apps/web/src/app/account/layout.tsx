import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { ArrowLeft } from 'lucide-react';
import { listMyOrgs } from '@orqivanta/core';
import { Logo } from '@/components/brand';
import { SettingsNav } from '@/components/settings/settings-nav';
import { requireUser } from '@/lib/session';

/** Account settings live outside any organization, with their own slim chrome. */
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const t = await getTranslations('account');
  const orgs = await listMyOrgs(user.id);
  const back = orgs.find((o) => o.id === user.lastActiveOrgId) ?? orgs[0];
  const items = [
    { href: '/account/profile', label: t('nav.profile') },
    { href: '/account/preferences', label: t('nav.preferences') },
    { href: '/account/notifications', label: t('nav.notifications') },
    { href: '/account/security', label: t('nav.security') },
  ];
  return (
    <div className="min-h-dvh bg-paper">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-[900px] items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Logo />
          {back ? (
            <Link href={back.role === 'client' ? `/portal/${back.slug}` : `/${back.slug}`} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-2 hover:text-ink">
              <ArrowLeft className="size-4" aria-hidden /> {t('backTo', { name: back.name })}
            </Link>
          ) : null}
        </div>
      </header>
      <main id="main" className="mx-auto max-w-[900px] px-4 py-8 sm:px-6">
        <h1 className="text-[22px] font-semibold tracking-[-0.01em] text-ink">{t('title')}</h1>
        <p className="mt-1 text-[13px] text-ink-2">{t('description')}</p>
        <div className="mt-6 grid gap-6 lg:grid-cols-[180px_minmax(0,1fr)] lg:gap-10">
          <SettingsNav label={t('navLabel')} items={items} />
          <div className="min-w-0">{children}</div>
        </div>
      </main>
    </div>
  );
}
