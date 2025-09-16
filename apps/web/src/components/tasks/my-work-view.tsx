'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { CalendarClock, CheckSquare, PartyPopper } from 'lucide-react';
import { EmptyState } from '@/components/ui/primitives';
import { cn } from '@/lib/cn';
import { TaskRow } from './task-row';
import type { StatusOption, TaskRowData } from './types';
import { useTaskParams } from './use-task-params';

type Bucket = 'overdue' | 'today' | 'week' | 'later' | 'none';

function todayISO() {
  return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

function bucketOf(dueDate: string | null, today: string, weekEnd: string): Bucket {
  if (!dueDate) return 'none';
  if (dueDate < today) return 'overdue';
  if (dueDate === today) return 'today';
  if (dueDate <= weekEnd) return 'week';
  return 'later';
}

const ORDER: Bucket[] = ['overdue', 'today', 'week', 'later', 'none'];

/** My Work: assigned (or watched) open tasks, grouped by when they are due. */
export function MyWorkView({ org, tasks, statusesByProject, counts, due, scope, truncated }: { org: string; tasks: TaskRowData[]; statusesByProject: Record<string, StatusOption[]>; counts: { assigned: number; overdue: number; dueThisWeek: number; watching: number }; due: 'overdue' | 'today' | 'week' | null; scope: 'assigned' | 'watching'; truncated: boolean }) {
  const t = useTranslations('myWork');
  const { setParams } = useTaskParams();

  const groups = useMemo(() => {
    const today = todayISO();
    const weekEnd = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(Date.now() + 7 * 86_400_000));
    const map = new Map<Bucket, TaskRowData[]>();
    for (const tk of tasks) {
      const b = bucketOf(tk.dueDate, today, weekEnd);
      map.set(b, [...(map.get(b) ?? []), tk]);
    }
    return ORDER.map((b) => ({ bucket: b, tasks: map.get(b) ?? [] })).filter((g) => g.tasks.length);
  }, [tasks]);

  const chips = [
    { key: 'all', label: t('filters.all'), count: counts.assigned, active: scope === 'assigned' && !due, onClick: () => setParams({ due: null, scope: null }) },
    { key: 'overdue', label: t('filters.overdue'), count: counts.overdue, active: due === 'overdue', attention: counts.overdue > 0, onClick: () => setParams({ due: 'overdue', scope: null }) },
    { key: 'week', label: t('filters.week'), count: counts.dueThisWeek, active: due === 'week', onClick: () => setParams({ due: 'week', scope: null }) },
    { key: 'watching', label: t('filters.watching'), count: counts.watching, active: scope === 'watching', onClick: () => setParams({ scope: 'watching', due: null }) },
  ];

  return (
    <div className="mt-6 flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {chips.map((c) => (
          <button
            key={c.key}
            type="button"
            aria-pressed={c.active}
            onClick={c.onClick}
            className={cn(
              'inline-flex h-8 items-center gap-2 rounded-md border px-2.5 text-[13px] font-medium',
              c.active ? 'border-accent/40 bg-accent-soft text-accent' : 'border-line-strong text-ink-2 hover:bg-surface-2',
            )}
          >
            {c.label}
            <span className={cn('tabular-nums', c.active ? '' : 'attention' in c && c.attention ? 'text-danger' : 'text-ink-3')}>{c.count}</span>
          </button>
        ))}
      </div>

      {tasks.length === 0 ? (
        <div className="rounded-lg border border-line bg-surface">
          {due || scope === 'watching' ? (
            <EmptyState icon={<PartyPopper />} title={t('empty.filtered')} description={t('empty.filteredBody')} />
          ) : (
            <EmptyState
              icon={<CheckSquare />}
              title={t('empty.title')}
              description={t('empty.body')}
              action={
                <Link href={`/${org}/projects`} className="text-[13px] font-medium text-accent hover:underline">
                  {t('empty.browseProjects')}
                </Link>
              }
            />
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-line bg-surface">
          {groups.map((g) => (
            <section key={g.bucket} aria-label={t(`buckets.${g.bucket}`)}>
              <h2 className={cn('flex items-center gap-2 border-b border-line bg-surface-2/60 px-3 py-1.5 text-[12px] font-semibold', g.bucket === 'overdue' ? 'text-danger' : 'text-ink-2')}>
                <CalendarClock className="size-3.5" aria-hidden />
                {t(`buckets.${g.bucket}`)}
                <span className="font-normal text-ink-3 tabular-nums">{g.tasks.length}</span>
              </h2>
              <ul className="divide-y divide-line">
                {g.tasks.map((tk) => (
                  <li key={tk.id}>
                    <TaskRow org={org} task={tk} statuses={statusesByProject[tk.projectId] ?? []} canEdit showProject />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
      {truncated ? <p className="text-[12px] text-ink-3">{t('truncated')}</p> : null}
    </div>
  );
}
