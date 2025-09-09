'use client';

import { Command } from 'cmdk';
import * as D from '@radix-ui/react-dialog';
import { BarChart3, Briefcase, CheckSquare, FileText, FolderKanban, Home, Inbox, Loader2, Plus, Search, Settings, Stamp, UserRound, Users, type LucideIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { searchAction } from '@/actions/search';

type Result = { type: string; id: string; title: string; excerpt: string | null; href: string; meta: string | null };

const Ctx = createContext<{ open: () => void }>({ open: () => {} });
export const useCommandPalette = () => useContext(Ctx);

const TYPE_ICON: Record<string, LucideIcon> = { project: FolderKanban, task: CheckSquare, document: FileText, request: Briefcase, client: Users, file: FileText };

/** Highlighted search excerpts arrive with «» markers; render them as <mark> without HTML. */
export function Highlighted({ text }: { text: string }) {
  const parts = text.split(/(«[^»]*»)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith('«') ? (
          <mark key={i} className="rounded-sm bg-attention-soft px-0.5 text-ink">
            {p.slice(1, -1)}
          </mark>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

export function CommandPaletteProvider({ org, canSeeSettings, canSeeReports, isClient, children }: { org: string; canSeeSettings?: boolean; canSeeReports?: boolean; isClient?: boolean; children: ReactNode }) {
  const t = useTranslations('shell');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!q.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }
    const id = ++seq.current;
    setLoading(true);
    const timer = setTimeout(async () => {
      const res = await searchAction(org, q);
      if (id !== seq.current) return;
      setResults(res.ok ? (res.data.results as Result[]) : []);
      setLoading(false);
    }, 180);
    return () => clearTimeout(timer);
  }, [q, org]);

  const go = useCallback(
    (href: string) => {
      setOpen(false);
      setQ('');
      router.push(href);
    },
    [router],
  );

  const base = isClient ? `/portal/${org}` : `/${org}`;
  const nav = useMemo(
    () =>
      isClient
        ? [
            { label: t('home'), icon: Home, href: base },
            { label: t('requests'), icon: Briefcase, href: `${base}/requests` },
            { label: t('newRequest'), icon: Plus, href: `${base}/requests/new` },
          ]
        : [
            { label: t('home'), icon: Home, href: base, keys: 'G H' },
            { label: t('myWork'), icon: CheckSquare, href: `${base}/my-work`, keys: 'G M' },
            { label: t('inbox'), icon: Inbox, href: `${base}/inbox`, keys: 'G I' },
            { label: t('projects'), icon: FolderKanban, href: `${base}/projects`, keys: 'G P' },
            { label: t('documents'), icon: FileText, href: `${base}/documents`, keys: 'G D' },
            { label: t('requests'), icon: Briefcase, href: `${base}/requests`, keys: 'G R' },
            { label: t('approvals'), icon: Stamp, href: `${base}/approvals`, keys: 'G A' },
            { label: t('clients'), icon: Users, href: `${base}/clients` },
            ...(canSeeReports ? [{ label: t('reports'), icon: BarChart3, href: `${base}/reports` }] : []),
            ...(canSeeSettings ? [{ label: t('settings'), icon: Settings, href: `${base}/settings` }] : []),
            { label: t('accountSettings'), icon: UserRound, href: `/account/profile?org=${org}` },
          ],
    [base, canSeeReports, canSeeSettings, isClient, org, t],
  );
  const create = isClient
    ? []
    : [
        { label: t('newProject'), href: `${base}/projects?new=1` },
        { label: t('newDocument'), href: `${base}/documents?new=1` },
        { label: t('newRequest'), href: `${base}/requests?new=1` },
      ];

  return (
    <Ctx.Provider value={{ open: () => setOpen(true) }}>
      {children}
      <D.Root open={open} onOpenChange={setOpen}>
        <D.Portal>
          <D.Overlay className="fixed inset-0 z-40 bg-[var(--overlay)] animate-fade-in" />
          <D.Content className="fixed top-[14vh] left-1/2 z-50 w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-xl border border-line bg-surface shadow-pop animate-pop-in">
            <D.Title className="sr-only">{t('commandPalette')}</D.Title>
            <D.Description className="sr-only">{t('commandPaletteHint')}</D.Description>
            <Command shouldFilter={!q.trim()} label={t('commandPalette')} className="flex flex-col">
              <div className="flex items-center gap-2 border-b border-line px-4">
                {loading ? <Loader2 className="size-4 animate-spin text-ink-3" /> : <Search className="size-4 text-ink-3" />}
                <Command.Input value={q} onValueChange={setQ} placeholder={t('paletteInput')} className="h-12 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-3" />
              </div>
              <Command.List className="max-h-[50vh] overflow-y-auto p-2">
                <Command.Empty className="px-3 py-6 text-center text-[13px] text-ink-3">{loading ? t('searching') : t('noResults')}</Command.Empty>
                {q.trim() && results.length ? (
                  <Command.Group heading={t('results')} className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-ink-3 [&_[cmdk-group-heading]]:uppercase">
                    {results.map((r) => {
                      const Icon = TYPE_ICON[r.type] ?? FileText;
                      return (
                        <Command.Item key={`${r.type}-${r.id}`} value={`${r.type}-${r.id}`} onSelect={() => go(r.href)} className="flex cursor-default items-start gap-3 rounded-md px-2 py-2 data-[selected=true]:bg-surface-2">
                          <Icon className="mt-0.5 size-4 shrink-0 text-ink-3" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-medium text-ink">{r.title}</span>
                            {r.excerpt ? (
                              <span className="block truncate text-[12px] text-ink-3">
                                <Highlighted text={r.excerpt} />
                              </span>
                            ) : null}
                          </span>
                          {r.meta ? <span className="shrink-0 text-[12px] text-ink-3">{r.meta}</span> : null}
                        </Command.Item>
                      );
                    })}
                    <Command.Item value="__all" onSelect={() => go(`${base}/search?q=${encodeURIComponent(q)}`)} className="flex cursor-default items-center gap-3 rounded-md px-2 py-2 text-[13px] text-accent data-[selected=true]:bg-surface-2">
                      <Search className="size-4" /> {t('seeAllResults', { q })}
                    </Command.Item>
                  </Command.Group>
                ) : null}
                {!q.trim() ? (
                  <>
                    <Command.Group heading={t('goTo')} className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-ink-3 [&_[cmdk-group-heading]]:uppercase">
                      {nav.map((n) => (
                        <Command.Item key={n.href} value={n.label} onSelect={() => go(n.href)} className="flex h-9 cursor-default items-center gap-3 rounded-md px-2 text-[13px] text-ink data-[selected=true]:bg-surface-2">
                          <n.icon className="size-4 text-ink-3" />
                          <span className="flex-1">{n.label}</span>
                          {'keys' in n && n.keys ? <span className="font-mono text-[11px] text-ink-3">{n.keys}</span> : null}
                        </Command.Item>
                      ))}
                    </Command.Group>
                    {create.length ? (
                      <Command.Group heading={t('create')} className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-ink-3 [&_[cmdk-group-heading]]:uppercase">
                        {create.map((c) => (
                          <Command.Item key={c.href} value={c.label} onSelect={() => go(c.href)} className="flex h-9 cursor-default items-center gap-3 rounded-md px-2 text-[13px] text-ink data-[selected=true]:bg-surface-2">
                            <Plus className="size-4 text-ink-3" />
                            {c.label}
                          </Command.Item>
                        ))}
                      </Command.Group>
                    ) : null}
                  </>
                ) : null}
              </Command.List>
            </Command>
          </D.Content>
        </D.Portal>
      </D.Root>
    </Ctx.Provider>
  );
}
