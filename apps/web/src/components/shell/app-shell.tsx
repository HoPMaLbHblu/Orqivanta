'use client';

import { Menu as MenuIcon, WifiOff } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useState, type ReactNode } from 'react';
import { Logo } from '@/components/brand';
import { RealtimeProvider, useRealtime } from '@/components/providers/realtime';
import { Button } from '@/components/ui/button';
import { Sheet } from '@/components/ui/dialog';
import { CommandPaletteProvider } from './command-palette';
import { ShortcutsProvider } from './shortcuts';
import { Sidebar, type ShellData } from './sidebar';

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

export function AppShell({ data, children }: { data: ShellData; children: ReactNode }) {
  const t = useTranslations('common');
  const ts = useTranslations('shell');
  const [drawer, setDrawer] = useState(false);
  const pathname = usePathname();
  useEffect(() => setDrawer(false), [pathname]);
  return (
    <RealtimeProvider org={data.org.slug}>
      <CommandPaletteProvider org={data.org.slug} canSeeReports={data.canSeeReports} canSeeSettings={data.canSeeSettings}>
        <ShortcutsProvider base={`/${data.org.slug}`}>
          <a href="#main" className="sr-only z-50 rounded-md bg-accent px-3 py-2 text-accent-ink focus:not-sr-only focus:fixed focus:top-2 focus:left-2">
            {t('skipToContent')}
          </a>
          <div className="flex min-h-dvh">
            <aside className="sticky top-0 hidden h-dvh w-[248px] shrink-0 border-r border-line bg-paper lg:block">
              <Sidebar data={data} />
            </aside>
            <div className="flex min-w-0 flex-1 flex-col">
              <ConnectionBanner />
              <div className="flex h-12 items-center gap-2 border-b border-line px-3 lg:hidden">
                <Button variant="ghost" size="icon" onClick={() => setDrawer(true)} aria-label={ts('openNavigation')}>
                  <MenuIcon />
                </Button>
                <Logo href={`/${data.org.slug}`} size="sm" />
              </div>
              <main id="main" tabIndex={-1} className="min-w-0 flex-1 focus:outline-none">
                {children}
              </main>
            </div>
          </div>
          <Sheet open={drawer} onOpenChange={setDrawer} title={ts('mainNav')} width="max-w-[280px] left-0 right-auto border-r border-l-0">
            <Sidebar data={data} onNavigate={() => setDrawer(false)} />
          </Sheet>
        </ShortcutsProvider>
      </CommandPaletteProvider>
    </RealtimeProvider>
  );
}
