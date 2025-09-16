'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState, useTransition, type ReactNode } from 'react';
import { Bell, Eye, Languages, LogOut, Menu as MenuIcon, Monitor, Moon, Sun, UserRound, WifiOff, X } from 'lucide-react';
import { exitPortalPreviewAction, markPortalNotificationsAction } from '@/actions/portal';
import { setPreferenceAction, signOutAction } from '@/actions/auth';
import { LogoMark } from '@/components/brand';
import { Avatar } from '@/components/domain/avatar';
import { SampleDataBadge } from '@/components/domain/badges';
import { RelativeTime } from '@/components/domain/dates';
import { applyTheme } from '@/components/preference-switcher';
import { RealtimeProvider, useRealtime } from '@/components/providers/realtime';
import { Button } from '@/components/ui/button';
import { Sheet } from '@/components/ui/dialog';
import { Menu, MenuCheckItem, MenuContent, MenuItem, MenuSeparator, MenuSub, MenuSubContent, MenuSubTrigger, MenuTrigger } from '@/components/ui/menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/cn';
import { useAction } from '@/lib/use-action';

export interface PortalNotification {
  id: string;
  title: string;
  body: string | null;
  href: string | null;
  readAt: Date | null;
  createdAt: Date;
}

export interface PortalShellData {
  org: { slug: string; name: string; isDemo: boolean };
  account: { name: string } | null;
  user: { name: string; email: string; color: string | null };
  preview: boolean;
  /** False for staff who haven't chosen a client to preview: only the picker shows. */
  hasViewer: boolean;
  reviewsWaiting: number;
  unread: number;
  notifications: PortalNotification[];
  accountSettingsHref: string | null;
}

function ConnectionBanner() {
  const t = useTranslations('common');
  const { status } = useRealtime();
  if (status !== 'offline') return null;
  return (
    <div role="status" className="flex items-center justify-center gap-2 border-b border-attention/30 bg-attention-soft px-4 py-1.5 text-[12px] text-attention">
      <WifiOff className="size-3.5" aria-hidden /> {t('offline')}
    </div>
  );
}

function useNav(data: PortalShellData) {
  const t = useTranslations('portal.nav');
  const base = `/portal/${data.org.slug}`;
  return [
    { href: base, label: t('home'), exact: true },
    { href: `${base}/approvals`, label: t('reviews'), count: data.reviewsWaiting },
    { href: `${base}/requests`, label: t('requests') },
    { href: `${base}/deliverables`, label: t('deliverables') },
    { href: `${base}/updates`, label: t('updates') },
  ];
}

function isActive(pathname: string, href: string, exact?: boolean, base?: string) {
  if (exact) return pathname === href || (base !== undefined && pathname.startsWith(`${base}/projects/`));
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function PortalShell({ data, children }: { data: PortalShellData; children: ReactNode }) {
  const t = useTranslations('portal');
  const tc = useTranslations('common');
  const pathname = usePathname();
  const nav = useNav(data);
  const [drawer, setDrawer] = useState(false);
  useEffect(() => setDrawer(false), [pathname]);
  const base = `/portal/${data.org.slug}`;

  return (
    <RealtimeProvider org={data.org.slug}>
      <a href="#main" className="sr-only z-50 rounded-md bg-accent px-3 py-2 text-accent-ink focus:not-sr-only focus:fixed focus:top-2 focus:left-2">
        {tc('skipToContent')}
      </a>
      <div className="flex min-h-dvh flex-col bg-paper">
        {data.preview && data.account ? <PreviewBanner org={data.org.slug} client={data.account.name} /> : null}
        <ConnectionBanner />
        <header className="sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur supports-[backdrop-filter]:bg-paper/80">
          <div className="mx-auto flex h-16 max-w-[1120px] items-center gap-3 px-4 sm:px-6 lg:px-8">
            {data.hasViewer ? (
              <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setDrawer(true)} aria-label={t('openNavigation')}>
                <MenuIcon />
              </Button>
            ) : null}
            <Link href={base} className="flex min-w-0 items-center gap-2.5 rounded-md">
              <LogoMark className="size-6 shrink-0" />
              <span className="min-w-0 leading-tight">
                <span className="block truncate text-[14px] font-semibold text-ink">{data.org.name}</span>
                {data.account ? <span className="block truncate text-[12px] text-ink-3">{t('portalFor', { client: data.account.name })}</span> : null}
              </span>
            </Link>
            {data.org.isDemo ? <SampleDataBadge /> : null}
            {data.hasViewer ? (
              <nav aria-label={t('nav.label')} className="ml-4 hidden items-center gap-1 md:flex">
                {nav.map((n) => {
                  const active = isActive(pathname, n.href, n.exact, base);
                  return (
                    <Link key={n.href} href={n.href} aria-current={active ? 'page' : undefined} className={cn('inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-[14px] transition-colors', active ? 'bg-surface-2 font-medium text-ink' : 'text-ink-2 hover:bg-surface-2 hover:text-ink')}>
                      {n.label}
                      {n.count ? (
                        <span className="rounded-full bg-attention-soft px-1.5 text-[11px] font-semibold tabular-nums text-attention" aria-label={t('nav.waitingCount', { count: n.count })}>
                          {n.count}
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </nav>
            ) : null}
            <div className="ml-auto flex items-center gap-1">
              {!data.preview && data.hasViewer ? <NotificationBell org={data.org.slug} unread={data.unread} items={data.notifications} /> : null}
              <PortalAccountMenu user={data.user} accountSettingsHref={data.accountSettingsHref} />
            </div>
          </div>
        </header>
        <main id="main" tabIndex={-1} className="min-w-0 flex-1 focus:outline-none">
          {children}
        </main>
        <footer className="border-t border-line">
          <div className="mx-auto flex max-w-[1120px] flex-wrap items-center justify-between gap-2 px-4 py-6 text-[12px] text-ink-3 sm:px-6 lg:px-8">
            <span>{t('footer', { org: data.org.name })}</span>
            <span className="inline-flex items-center gap-1.5">
              <LogoMark className="size-3.5" /> Orqivanta
            </span>
          </div>
        </footer>
      </div>
      {data.hasViewer ? (
        <Sheet open={drawer} onOpenChange={setDrawer} title={t('nav.label')} width="max-w-[300px] left-0 right-auto border-r border-l-0">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <span className="text-[14px] font-semibold text-ink">{data.org.name}</span>
            <Button variant="ghost" size="icon" onClick={() => setDrawer(false)} aria-label={tc('close')}>
              <X />
            </Button>
          </div>
          <nav aria-label={t('nav.label')} className="flex flex-col gap-0.5 p-2">
            {nav.map((n) => {
              const active = isActive(pathname, n.href, n.exact, base);
              return (
                <Link key={n.href} href={n.href} aria-current={active ? 'page' : undefined} className={cn('flex h-10 items-center justify-between rounded-md px-3 text-[15px]', active ? 'bg-surface-2 font-medium text-ink' : 'text-ink-2 hover:bg-surface-2')}>
                  {n.label}
                  {n.count ? <span className="rounded-full bg-attention-soft px-1.5 text-[12px] font-semibold text-attention">{n.count}</span> : null}
                </Link>
              );
            })}
          </nav>
        </Sheet>
      ) : null}
    </RealtimeProvider>
  );
}

function PreviewBanner({ org, client }: { org: string; client: string }) {
  const t = useTranslations('portal.preview');
  const router = useRouter();
  const { call } = useAction();
  return (
    <div role="status" className="border-b border-info/25 bg-info-soft">
      <div className="mx-auto flex max-w-[1120px] flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-[13px] text-ink sm:px-6 lg:px-8">
        <Eye className="size-4 shrink-0 text-info" aria-hidden />
        <span className="min-w-0 flex-1">
          <strong className="font-semibold">{t('bannerTitle')}</strong> {t('banner', { client })}
        </span>
        <span className="flex items-center gap-3">
          <Link href={`/portal/${org}/preview`} className="font-medium text-info hover:underline">
            {t('switch')}
          </Link>
          <button
            type="button"
            className="font-medium text-info hover:underline"
            onClick={() =>
              call(async () => {
                const res = await exitPortalPreviewAction(org);
                if (res.ok) router.push(`/${org}`);
                return res;
              }, { refresh: false })
            }
          >
            {t('exit')}
          </button>
        </span>
      </div>
    </div>
  );
}

function NotificationBell({ org, unread, items }: { org: string; unread: number; items: PortalNotification[] }) {
  const t = useTranslations('portal.notifications');
  const router = useRouter();
  const { call } = useAction();
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={unread ? t('openUnread', { count: unread }) : t('open')}>
          <Bell />
          {unread ? <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-accent-ink tabular-nums" aria-hidden>{unread > 9 ? '9+' : unread}</span> : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(360px,calc(100vw-24px))] p-0">
        <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
          <h2 className="text-[13px] font-semibold text-ink">{t('title')}</h2>
          {unread ? (
            <button type="button" className="text-[12px] font-medium text-accent hover:underline" onClick={() => call(() => markPortalNotificationsAction(org, { all: true }))}>
              {t('markAllRead')}
            </button>
          ) : null}
        </div>
        {items.length ? (
          <ul className="max-h-[60vh] divide-y divide-line overflow-y-auto">
            {items.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  className="flex w-full gap-3 px-4 py-3 text-left hover:bg-surface-2"
                  onClick={() => {
                    setOpen(false);
                    if (!n.readAt) void markPortalNotificationsAction(org, { ids: [n.id] });
                    if (n.href) router.push(n.href);
                    else router.refresh();
                  }}
                >
                  <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', n.readAt ? 'bg-transparent' : 'bg-accent')} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className={cn('block text-[13px] leading-snug', n.readAt ? 'text-ink-2' : 'font-medium text-ink')}>
                      {n.title}
                      {!n.readAt ? <span className="sr-only"> ({t('unread')})</span> : null}
                    </span>
                    {n.body ? <span className="mt-0.5 line-clamp-2 block text-[12px] text-ink-3">{n.body}</span> : null}
                    <RelativeTime date={n.createdAt} className="mt-1 block text-[11px] text-ink-3" />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-4 py-8 text-center text-[13px] text-ink-3">{t('empty')}</p>
        )}
      </PopoverContent>
    </Popover>
  );
}

function PortalAccountMenu({ user, accountSettingsHref }: { user: PortalShellData['user']; accountSettingsHref: string | null }) {
  const t = useTranslations('common');
  const tp = useTranslations('portal');
  const locale = useLocale();
  const router = useRouter();
  const [, start] = useTransition();
  const [theme, setTheme] = useState('system');
  useEffect(() => setTheme(document.documentElement.dataset.themePref ?? 'system'), []);
  return (
    <Menu>
      <MenuTrigger asChild>
        <button type="button" className="flex items-center gap-2 rounded-md p-1 hover:bg-surface-2" aria-label={tp('accountMenu', { name: user.name })}>
          <Avatar name={user.name} color={user.color} size="md" title="" />
        </button>
      </MenuTrigger>
      <MenuContent align="end" className="w-60">
        <div className="px-2 pt-1.5 pb-2">
          <p className="truncate text-[13px] font-medium text-ink">{user.name}</p>
          <p className="truncate text-[12px] text-ink-3">{user.email}</p>
        </div>
        <MenuSeparator />
        {accountSettingsHref ? (
          <MenuItem onSelect={() => router.push(accountSettingsHref)}>
            <UserRound /> {tp('accountSettings')}
          </MenuItem>
        ) : null}
        <MenuSub>
          <MenuSubTrigger>
            <Languages className="size-4 text-ink-3" /> {t('language')}
          </MenuSubTrigger>
          <MenuSubContent>
            {(['en', 'ru'] as const).map((l) => (
              <MenuCheckItem key={l} checked={locale === l} onCheckedChange={() => start(async () => { await setPreferenceAction({ locale: l }); router.refresh(); })}>
                {t(l)}
              </MenuCheckItem>
            ))}
          </MenuSubContent>
        </MenuSub>
        <MenuSub>
          <MenuSubTrigger>
            <Monitor className="size-4 text-ink-3" /> {t('theme')}
          </MenuSubTrigger>
          <MenuSubContent>
            {([['system', Monitor], ['light', Sun], ['dark', Moon]] as const).map(([v, Icon]) => (
              <MenuCheckItem key={v} checked={theme === v} onCheckedChange={() => { applyTheme(v); setTheme(v); start(async () => { await setPreferenceAction({ theme: v }); }); }}>
                <Icon className="size-4" /> {t(v === 'system' ? 'themeSystem' : v === 'light' ? 'themeLight' : 'themeDark')}
              </MenuCheckItem>
            ))}
          </MenuSubContent>
        </MenuSub>
        <MenuSeparator />
        <MenuItem onSelect={() => start(() => signOutAction())}>
          <LogOut /> {t('signOut')}
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}
