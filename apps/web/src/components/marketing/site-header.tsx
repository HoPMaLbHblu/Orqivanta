'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Menu as MenuIcon, X } from 'lucide-react';
import { Logo } from '@/components/brand';
import { Button } from '@/components/ui/button';
import { LinkButton } from '@/components/marketing/link-button';
import { cn } from '@/lib/cn';

export interface NavItem {
  href: string;
  label: string;
}

/**
 * Public site header. Signed-in visitors get a link into their workspace instead of
 * the sign-in and sign-up pair; everything else is the same for everyone.
 */
export function SiteHeader({ nav, workspaceHref, demoEnabled }: { nav: NavItem[]; workspaceHref: string | null; demoEnabled: boolean }) {
  const t = useTranslations('marketing.nav');
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const isCurrent = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur-sm">
      <div className="mx-auto flex h-16 w-full max-w-[1160px] items-center gap-4 px-4 sm:px-8">
        <Logo />
        <nav aria-label={t('label')} className="ml-6 hidden items-center gap-1 lg:flex">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isCurrent(item.href) ? 'page' : undefined}
              className={cn(
                'rounded-md px-2.5 py-1.5 text-[14px] transition-colors',
                isCurrent(item.href) ? 'text-ink' : 'text-ink-2 hover:bg-surface-2 hover:text-ink',
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto hidden items-center gap-2 lg:flex">
          {workspaceHref ? (
            <LinkButton href={workspaceHref} size="sm" variant="primary">{t('openWorkspace')}</LinkButton>
          ) : (
            <>
              <LinkButton href="/sign-in" size="sm" variant="ghost">{t('signIn')}</LinkButton>
              {demoEnabled ? (
                <LinkButton href="/demo" size="sm" variant="secondary">{t('tryDemo')}</LinkButton>
              ) : null}
              <LinkButton href="/sign-up" size="sm" variant="primary">{t('getStarted')}</LinkButton>
            </>
          )}
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="ml-auto lg:hidden"
          aria-expanded={open}
          aria-controls="site-menu"
          aria-label={open ? t('closeMenu') : t('openMenu')}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X /> : <MenuIcon />}
        </Button>
      </div>
      {open ? (
        <div id="site-menu" className="border-t border-line bg-surface lg:hidden">
          <nav aria-label={t('label')} className="mx-auto max-w-[1160px] px-4 py-3 sm:px-8">
            <ul className="flex flex-col">
              {nav.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={isCurrent(item.href) ? 'page' : undefined}
                    className={cn('block rounded-md px-2 py-2.5 text-[15px]', isCurrent(item.href) ? 'text-ink' : 'text-ink-2')}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex flex-col gap-2 border-t border-line pt-3">
              {workspaceHref ? (
                <LinkButton href={workspaceHref} variant="primary">{t('openWorkspace')}</LinkButton>
              ) : (
                <>
                  <LinkButton href="/sign-up" variant="primary">{t('getStarted')}</LinkButton>
                  {demoEnabled ? (
                    <LinkButton href="/demo" variant="secondary">{t('tryDemo')}</LinkButton>
                  ) : null}
                  <LinkButton href="/sign-in" variant="ghost">{t('signIn')}</LinkButton>
                </>
              )}
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
