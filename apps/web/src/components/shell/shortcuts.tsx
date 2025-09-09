'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Kbd } from '@/components/ui/primitives';

const Ctx = createContext<{ open: () => void }>({ open: () => {} });
export const useShortcutHelp = () => useContext(Ctx);

function typingIn(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return !!el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));
}

/** Two-key navigation (G then a letter), plus "?" for this help. Ignored while typing. */
export function ShortcutsProvider({ base, children, enabled = true }: { base: string; children: ReactNode; enabled?: boolean }) {
  const t = useTranslations('shell.shortcuts');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const pendingG = useRef<number>(0);

  useEffect(() => {
    if (!enabled) return;
    const routes: Record<string, string> = { h: '', m: '/my-work', i: '/inbox', p: '/projects', d: '/documents', r: '/requests', a: '/approvals', c: '/clients' };
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || typingIn(e.target)) return;
      if (e.key === '?') {
        e.preventDefault();
        setOpen(true);
        return;
      }
      const key = e.key.toLowerCase();
      if (key === 'g') {
        pendingG.current = Date.now();
        return;
      }
      if (Date.now() - pendingG.current < 1200 && key in routes) {
        e.preventDefault();
        pendingG.current = 0;
        router.push(`${base}${routes[key]}`);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [base, enabled, router]);

  const groups: [string, [string[], string][]][] = [
    [t('general'), [[['⌘', 'K'], t('palette')], [['?'], t('help')], [['Esc'], t('close')]]],
    [t('navigation'), [[['G', 'H'], t('goHome')], [['G', 'M'], t('goMyWork')], [['G', 'I'], t('goInbox')], [['G', 'P'], t('goProjects')], [['G', 'D'], t('goDocuments')], [['G', 'R'], t('goRequests')], [['G', 'A'], t('goApprovals')]]],
    [t('tasks'), [[['C'], t('newTask')], [['J', 'K'], t('moveSelection')], [['Enter'], t('openTask')], [['X'], t('selectTask')], [['Shift', '←/→'], t('moveColumn')]]],
  ];

  return (
    <Ctx.Provider value={{ open: () => setOpen(true) }}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title={t('title')} size="md">
          <div className="grid gap-6 sm:grid-cols-2">
            {groups.map(([title, items]) => (
              <section key={title}>
                <h3 className="mb-2 text-[11px] font-medium tracking-wide text-ink-3 uppercase">{title}</h3>
                <dl className="space-y-1.5">
                  {items.map(([keys, label]) => (
                    <div key={label} className="flex items-center justify-between gap-3 text-[13px]">
                      <dt className="text-ink-2">{label}</dt>
                      <dd className="flex gap-1">
                        {keys.map((k) => (
                          <Kbd key={k}>{k}</Kbd>
                        ))}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </Ctx.Provider>
  );
}
