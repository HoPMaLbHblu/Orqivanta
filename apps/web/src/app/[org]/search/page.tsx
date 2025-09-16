import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Briefcase, CheckSquare, FileText, FolderKanban, Paperclip, Search, SearchX, Users, type LucideIcon } from 'lucide-react';
import { search, type SearchType } from '@orqivanta/core';
import { Highlighted } from '@/components/shell/command-palette';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState, PageHeader } from '@/components/ui/primitives';
import { requireActor } from '@/lib/session';
import { cn } from '@/lib/cn';

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const t = await getTranslations('search');
  const { q } = await searchParams;
  return { title: q ? `${q} · ${t('title')}` : t('title') };
}

const TYPES: SearchType[] = ['project', 'task', 'document', 'request', 'client', 'file'];
const ICONS: Record<SearchType, LucideIcon> = { project: FolderKanban, task: CheckSquare, document: FileText, request: Briefcase, client: Users, file: Paperclip };

export default async function SearchPage({ params, searchParams }: { params: Promise<{ org: string }>; searchParams: Promise<{ q?: string; type?: string }> }) {
  const { org } = await params;
  const sp = await searchParams;
  const actor = await requireActor(org);
  const t = await getTranslations('search');
  const q = (sp.q ?? '').trim().slice(0, 100);
  const type = TYPES.includes(sp.type as SearchType) ? (sp.type as SearchType) : null;

  const [all, filtered] = q
    ? await Promise.all([search(actor, { q, limit: type ? 1 : 20 }), type ? search(actor, { q, types: [type], limit: 50 }) : null])
    : [null, null];
  const counts = all?.counts;
  const results = (filtered ?? all)?.results ?? [];
  const total = counts ? (type ? counts[type] : TYPES.reduce((s, k) => s + counts[k], 0)) : 0;
  const href = (ty: SearchType | null) => `/${org}/search?q=${encodeURIComponent(q)}${ty ? `&type=${ty}` : ''}`;

  return (
    <div className="mx-auto max-w-[880px] px-4 py-8 sm:px-6 lg:px-10">
      <PageHeader title={t('title')} description={t('description')} />
      <form role="search" action={`/${org}/search`} className="mt-6 flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
          <label htmlFor="search-q" className="sr-only">
            {t('label')}
          </label>
          <Input id="search-q" name="q" type="search" defaultValue={q} placeholder={t('placeholder')} autoFocus={!q} maxLength={100} className="h-10 pl-9" />
        </div>
        {type ? <input type="hidden" name="type" value={type} /> : null}
        <Button type="submit" variant="primary" className="h-10">
          {t('submit')}
        </Button>
      </form>

      {!q ? (
        <EmptyState className="mt-6" icon={<Search />} title={t('startTitle')} description={t('startBody')} />
      ) : (
        <>
          <nav aria-label={t('types')} className="mt-6 flex gap-1 overflow-x-auto border-b border-line">
            {[null, ...TYPES].map((ty) => {
              const n = counts ? (ty ? counts[ty] : TYPES.reduce((s, k) => s + counts[k], 0)) : 0;
              if (ty && n === 0 && type !== ty) return null;
              const active = type === ty;
              return (
                <Link key={ty ?? 'all'} href={href(ty)} aria-current={active ? 'page' : undefined} className={cn('-mb-px inline-flex items-center gap-1.5 border-b-2 px-2.5 pb-2 text-[13px] font-medium whitespace-nowrap', active ? 'border-accent text-ink' : 'border-transparent text-ink-3 hover:text-ink')}>
                  {ty ? t(`type.${ty}`) : t('all')}
                  <span className="rounded-full bg-surface-2 px-1.5 text-[11px] tabular-nums text-ink-2">{n}</span>
                </Link>
              );
            })}
          </nav>
          <p className="mt-4 text-[13px] text-ink-3" role="status">
            {t('resultsFor', { count: total, q })}
            {total > results.length ? ` ${t('showingTop', { shown: results.length, total })}` : ''}
          </p>
          {results.length ? (
            <ul className="mt-3 divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
              {results.map((r) => {
                const Icon = ICONS[r.type];
                return (
                  <li key={`${r.type}-${r.id}`}>
                    <Link href={r.href} className="flex items-start gap-3 px-4 py-3 hover:bg-surface-2">
                      <Icon className="mt-0.5 size-4 shrink-0 text-ink-3" aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-baseline gap-x-2">
                          <span className="text-[14px] font-medium text-ink">{r.title}</span>
                          <span className="text-[12px] text-ink-3">{t(`typeOne.${r.type}`)}</span>
                        </span>
                        {r.excerpt ? (
                          <span className="mt-0.5 line-clamp-2 block text-[13px] text-ink-2">
                            <Highlighted text={r.excerpt} />
                          </span>
                        ) : null}
                        {r.meta ? <span className="mt-1 block truncate font-mono text-[11px] text-ink-3">{r.meta}</span> : null}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState className="mt-3" icon={<SearchX />} title={type ? t('emptyTypeTitle', { type: t(`type.${type}`).toLowerCase(), q }) : t('emptyTitle', { q })} description={type ? t('emptyTypeBody') : t('emptyBody')} action={type ? <Link href={href(null)} className="text-[13px] font-medium text-accent hover:underline">{t('all')}</Link> : undefined} />
          )}
        </>
      )}
    </div>
  );
}
