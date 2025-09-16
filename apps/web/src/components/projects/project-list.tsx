'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useMemo, useState, useTransition } from 'react';
import { Archive, ArrowRight, FolderKanban, Globe, LayoutGrid, Lock, Rows3, Search, SearchX } from 'lucide-react';
import { DueDate } from '@/components/domain/dates';
import { Avatar } from '@/components/domain/avatar';
import { Badge, HealthBadge, type Health } from '@/components/domain/badges';
import { ProgressBar } from '@/components/domain/progress';
import { toneInk } from '@/components/domain/tone';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState, Mono } from '@/components/ui/primitives';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/cn';
import { FavoriteButton } from './favorite-button';

export interface ProjectCardData {
  id: string;
  key: string;
  name: string;
  color: string;
  clientName: string | null;
  clientAccountId: string | null;
  dueDate: string | null;
  archivedAt: Date | null;
  portalEnabled: boolean;
  visibility: 'private' | 'team' | 'org';
  ownerName: string | null;
  ownerColor: string | null;
  isFavorite: boolean;
  health: Health;
  healthSource: 'reported' | 'computed';
  stats: { total: number; open: number; overdue: number; blocked: number; progress: number | null };
  mine: boolean;
}

type Sort = 'name' | 'due' | 'progress' | 'health';
const HEALTH_RANK: Record<Health, number> = { off_track: 0, at_risk: 1, on_track: 2 };

export function ProjectList({ org, projects, clients, hasAnyProjects, canCreate }: { org: string; projects: ProjectCardData[]; clients: { id: string; name: string }[]; hasAnyProjects: boolean; canCreate: boolean }) {
  const t = useTranslations('projects');
  const th = useTranslations('enums.health');
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [, startTransition] = useTransition();
  const [q, setQ] = useState(sp.get('q') ?? '');

  const status = sp.get('status') === 'archived' ? 'archived' : 'active';
  const view = sp.get('view') === 'table' ? 'table' : 'grid';
  const mine = sp.get('mine') === '1';
  const health = (sp.get('health') ?? 'all') as Health | 'all';
  const client = sp.get('client') ?? 'all';
  const sort = (['name', 'due', 'progress', 'health'].includes(sp.get('sort') ?? '') ? sp.get('sort') : 'name') as Sort;

  const setParam = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === '') next.delete(k);
      else next.set(k, v);
    }
    next.delete('new');
    const qs = next.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  };

  const shown = useMemo(() => {
    const needle = (sp.get('q') ?? '').trim().toLowerCase();
    const list = projects.filter(
      (p) =>
        (!mine || p.mine) &&
        (health === 'all' || p.health === health) &&
        (!needle || p.name.toLowerCase().includes(needle) || p.key.toLowerCase().startsWith(needle) || (p.clientName ?? '').toLowerCase().includes(needle)),
    );
    const byName = (a: ProjectCardData, b: ProjectCardData) => a.name.localeCompare(b.name);
    return [...list].sort((a, b) => {
      if (sort === 'due') return (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') || byName(a, b);
      if (sort === 'progress') return (b.stats.progress ?? -1) - (a.stats.progress ?? -1) || byName(a, b);
      if (sort === 'health') return HEALTH_RANK[a.health] - HEALTH_RANK[b.health] || byName(a, b);
      return byName(a, b);
    });
  }, [projects, mine, health, sort, sp]);

  const filtered = mine || health !== 'all' || client !== 'all' || Boolean(sp.get('q'));

  if (!hasAnyProjects) {
    return (
      <div className="mt-8 rounded-lg border border-dashed border-line-strong">
        <EmptyState
          icon={<FolderKanban />}
          title={t('emptyTitle')}
          description={canCreate ? t('emptyBody') : t('emptyBodyMember')}
          action={
            canCreate ? (
              <Button variant="primary" size="sm" asChild>
                <Link href={`/${org}/projects?new=1`}>{t('newProject')}</Link>
              </Button>
            ) : null
          }
        />
      </div>
    );
  }

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label={t('filters.status')} className="inline-flex rounded-md border border-line-strong p-0.5">
          {(['active', 'archived'] as const).map((s) => (
            <button key={s} type="button" aria-pressed={status === s} onClick={() => setParam({ status: s === 'active' ? null : s })} className={cn('h-7 rounded-[5px] px-2.5 text-[13px] font-medium', status === s ? 'bg-surface-2 text-ink' : 'text-ink-3 hover:text-ink')}>
              {t(`filters.${s}`)}
            </button>
          ))}
        </div>
        <form
          role="search"
          className="relative min-w-0 flex-1 sm:max-w-64"
          onSubmit={(e) => {
            e.preventDefault();
            setParam({ q: q.trim() || null });
          }}
        >
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
          <Input value={q} onChange={(e) => { setQ(e.target.value); if (!e.target.value) setParam({ q: null }); }} onBlur={() => setParam({ q: q.trim() || null })} placeholder={t('filters.search')} aria-label={t('filters.search')} className="h-8 pl-8 text-[13px]" />
        </form>
        <button type="button" aria-pressed={mine} onClick={() => setParam({ mine: mine ? null : '1' })} className={cn('h-8 rounded-md border px-2.5 text-[13px] font-medium', mine ? 'border-accent/40 bg-accent-soft text-accent' : 'border-line-strong text-ink-2 hover:bg-surface-2')}>
          {t('filters.mine')}
        </button>
        <div className="w-36">
          <Select size="sm" aria-label={t('filters.health')} value={health} onValueChange={(v) => setParam({ health: v === 'all' ? null : v })} options={[{ value: 'all', label: t('filters.anyHealth') }, ...(['on_track', 'at_risk', 'off_track'] as const).map((h) => ({ value: h, label: th(h) }))]} />
        </div>
        {clients.length ? (
          <div className="w-40">
            <Select size="sm" aria-label={t('filters.client')} value={client} onValueChange={(v) => setParam({ client: v === 'all' ? null : v })} options={[{ value: 'all', label: t('filters.anyClient') }, ...clients.map((c) => ({ value: c.id, label: c.name }))]} />
          </div>
        ) : null}
        <div className="ml-auto flex items-center gap-2">
          <div className="w-40">
            <Select size="sm" aria-label={t('filters.sort')} value={sort} onValueChange={(v) => setParam({ sort: v === 'name' ? null : v })} options={(['name', 'due', 'progress', 'health'] as const).map((s) => ({ value: s, label: t(`sort.${s}`) }))} />
          </div>
          <div role="group" aria-label={t('filters.layout')} className="inline-flex rounded-md border border-line-strong p-0.5">
            <button type="button" aria-pressed={view === 'grid'} aria-label={t('filters.grid')} title={t('filters.grid')} onClick={() => setParam({ view: null })} className={cn('inline-flex size-7 items-center justify-center rounded-[5px]', view === 'grid' ? 'bg-surface-2 text-ink' : 'text-ink-3 hover:text-ink')}>
              <LayoutGrid className="size-4" aria-hidden />
            </button>
            <button type="button" aria-pressed={view === 'table'} aria-label={t('filters.table')} title={t('filters.table')} onClick={() => setParam({ view: 'table' })} className={cn('inline-flex size-7 items-center justify-center rounded-[5px]', view === 'table' ? 'bg-surface-2 text-ink' : 'text-ink-3 hover:text-ink')}>
              <Rows3 className="size-4" aria-hidden />
            </button>
          </div>
        </div>
      </div>

      <p className="sr-only" role="status">
        {t('count', { count: shown.length })}
      </p>

      {shown.length === 0 ? (
        <div className="mt-6 rounded-lg border border-line bg-surface">
          {filtered ? (
            <EmptyState icon={<SearchX />} title={t('filteredEmpty')} description={t('filteredEmptyBody')} action={<Button size="sm" onClick={() => { setQ(''); setParam({ q: null, mine: null, health: null, client: null }); }}>{t('clearFilters')}</Button>} />
          ) : status === 'archived' ? (
            <EmptyState icon={<Archive />} title={t('noArchived')} description={t('noArchivedBody')} />
          ) : (
            <EmptyState icon={<FolderKanban />} title={t('noActive')} description={t('noActiveBody')} action={<Button size="sm" onClick={() => setParam({ status: 'archived' })}>{t('showArchived')} <ArrowRight /></Button>} />
          )}
        </div>
      ) : view === 'grid' ? (
        <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((p) => (
            <li key={p.id} className="relative">
              <Link href={`/${org}/projects/${p.key}`} className="flex h-full flex-col rounded-lg border border-line bg-surface p-4 transition-colors hover:border-line-strong">
                <div className="flex items-start gap-2 pr-7">
                  <span className="mt-1 size-2.5 shrink-0 rounded-[3px]" style={{ background: toneInk(p.color) }} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium text-ink">{p.name}</p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-ink-3">
                      <Mono className="text-[11px]">{p.key}</Mono>
                      {p.clientName ? (
                        <>
                          <span aria-hidden>·</span>
                          <span className="truncate">{p.clientName}</span>
                        </>
                      ) : null}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <HealthBadge health={p.health} source={p.healthSource} />
                  {p.portalEnabled ? <Badge tone="accent" icon={Globe}>{t('portalOn')}</Badge> : null}
                  {p.visibility === 'private' ? <Badge tone="muted" icon={Lock}>{t('private')}</Badge> : null}
                  {p.archivedAt ? <Badge tone="muted" icon={Archive}>{t('archived')}</Badge> : null}
                </div>
                <ProgressBar value={p.stats.progress} label={t('progressOf', { name: p.name })} className="mt-4" />
                <div className="mt-3 flex items-center gap-3 text-[12px] text-ink-3">
                  <span>{t('openTasks', { count: p.stats.open })}</span>
                  {p.stats.overdue ? <span className="font-medium text-danger">{t('overdueTasks', { count: p.stats.overdue })}</span> : null}
                  <span className="ml-auto">{p.dueDate ? <DueDate date={p.dueDate} done={p.stats.progress === 1} short /> : null}</span>
                </div>
              </Link>
              <FavoriteButton org={org} projectId={p.id} projectName={p.name} initial={p.isFavorite} className="absolute top-3 right-3" />
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-5 overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full min-w-[720px] text-left text-[13px]">
            <thead className="border-b border-line text-[12px] text-ink-3">
              <tr>
                <th scope="col" className="w-10 px-2 py-2 font-medium"><span className="sr-only">{t('favoriteShort')}</span></th>
                <th scope="col" className="px-2 py-2 font-medium">{t('col.name')}</th>
                <th scope="col" className="px-2 py-2 font-medium">{t('col.client')}</th>
                <th scope="col" className="px-2 py-2 font-medium">{t('col.health')}</th>
                <th scope="col" className="w-44 px-2 py-2 font-medium">{t('col.progress')}</th>
                <th scope="col" className="px-2 py-2 font-medium">{t('col.open')}</th>
                <th scope="col" className="px-2 py-2 font-medium">{t('col.due')}</th>
                <th scope="col" className="px-2 py-2 font-medium">{t('col.owner')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {shown.map((p) => (
                <tr key={p.id} className="hover:bg-surface-2">
                  <td className="px-2 py-1.5">
                    <FavoriteButton org={org} projectId={p.id} projectName={p.name} initial={p.isFavorite} />
                  </td>
                  <td className="max-w-72 px-2 py-2">
                    <Link href={`/${org}/projects/${p.key}`} className="flex items-center gap-2 font-medium text-ink hover:underline">
                      <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: toneInk(p.color) }} aria-hidden />
                      <span className="truncate">{p.name}</span>
                      <Mono className="text-[11px]">{p.key}</Mono>
                      {p.portalEnabled ? <Globe className="size-3.5 shrink-0 text-accent" aria-label={t('portalOn')} /> : null}
                    </Link>
                  </td>
                  <td className="px-2 py-2 text-ink-2">{p.clientName ?? <span className="text-ink-3">{t('internal')}</span>}</td>
                  <td className="px-2 py-2"><HealthBadge health={p.health} source={p.healthSource} /></td>
                  <td className="px-2 py-2"><ProgressBar value={p.stats.progress} label={t('progressOf', { name: p.name })} /></td>
                  <td className="px-2 py-2 tabular-nums text-ink-2">
                    {p.stats.open}
                    {p.stats.overdue ? <span className="ml-1.5 text-[12px] text-danger">{t('overdueTasks', { count: p.stats.overdue })}</span> : null}
                  </td>
                  <td className="px-2 py-2">{p.dueDate ? <DueDate date={p.dueDate} done={p.stats.progress === 1} short /> : <span className="text-ink-3">—</span>}</td>
                  <td className="px-2 py-2">{p.ownerName ? <span className="inline-flex items-center gap-1.5 text-ink-2"><Avatar name={p.ownerName} color={p.ownerColor} size="xs" title="" />{p.ownerName}</span> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
