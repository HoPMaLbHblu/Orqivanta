import { getTranslations } from 'next-intl/server';
import { config } from '@orqivanta/core';
import { SiteFooter } from '@/components/marketing/site-footer';
import { SiteHeader } from '@/components/marketing/site-header';
import { homePathFor } from '@/lib/routes';
import { getSession } from '@/lib/session';

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const [t, tc, session] = await Promise.all([getTranslations('marketing.nav'), getTranslations('common'), getSession()]);
  // Signed-in visitors are offered their workspace instead of sign-in and sign-up.
  const workspaceHref = session ? await homePathFor(session.user) : null;
  const nav = [
    { href: '/product', label: t('product') },
    { href: '/client-portal', label: t('clientPortal') },
    { href: '/agencies', label: t('agencies') },
    { href: '/pricing', label: t('pricing') },
    { href: '/changelog', label: t('changelog') },
  ];
  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2 focus:text-[13px] focus:shadow-pop">
        {tc('skipToContent')}
      </a>
      <SiteHeader nav={nav} workspaceHref={workspaceHref} demoEnabled={config.demoMode} />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter demoEnabled={config.demoMode} />
    </div>
  );
}
