import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { CalendarRange } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/input';
import { cn } from '@/lib/cn';
import { PRESETS, type ParsedRange } from './range';

/** Date range and project filter. A plain GET form, so the URL holds the whole view. */
export async function RangeControls({ action, range, projects, snapshot }: { action: string; range: ParsedRange; projects: { id: string; name: string }[]; snapshot?: boolean }) {
  const t = await getTranslations('reports.range');
  const q = (days: number) => `${action}?days=${days}${range.projectId ? `&project=${range.projectId}` : ''}`;
  return (
    <div className="rounded-lg border border-line bg-surface p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 text-[12px] font-medium text-ink-3">
          <CalendarRange className="size-4" aria-hidden /> {t('label')}
        </span>
        <nav aria-label={t('label')} className="flex flex-wrap gap-1">
          {PRESETS.map((d) => (
            <Link key={d} href={q(d)} aria-current={range.preset === d ? 'true' : undefined} className={cn('inline-flex h-7 items-center rounded-full border px-2.5 text-[12px] font-medium', range.preset === d ? 'border-accent/30 bg-accent-soft text-accent' : 'border-line text-ink-2 hover:bg-surface-2')}>
              {t('preset', { days: d })}
            </Link>
          ))}
        </nav>
      </div>
      <form action={action} className="mt-3 flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-[12px] text-ink-3">
          {t('from')}
          <input type="date" name="from" defaultValue={range.from} required className="h-8 rounded-md border border-line-strong bg-surface px-2 text-[13px] text-ink focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/25 focus-visible:outline-none" />
        </label>
        <label className="flex flex-col gap-1 text-[12px] text-ink-3">
          {t('to')}
          <input type="date" name="to" defaultValue={range.to} required className="h-8 rounded-md border border-line-strong bg-surface px-2 text-[13px] text-ink focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/25 focus-visible:outline-none" />
        </label>
        <label className="flex min-w-48 flex-1 flex-col gap-1 text-[12px] text-ink-3 sm:flex-none">
          {t('project')}
          <NativeSelect name="project" defaultValue={range.projectId ?? ''} className="h-8 text-[13px]">
            <option value="">{t('allProjects')}</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </NativeSelect>
        </label>
        <Button type="submit" size="sm">
          {t('apply')}
        </Button>
      </form>
      {snapshot ? <p className="mt-2 text-[12px] text-ink-3">{t('snapshot')}</p> : null}
    </div>
  );
}

export function StatTile({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'attention' }) {
  return (
    <div className={cn('rounded-lg border bg-surface p-4', tone === 'attention' ? 'border-attention/40' : 'border-line')}>
      <p className="text-[12px] text-ink-3">{label}</p>
      <p className={cn('mt-1.5 text-[24px] leading-none font-semibold tabular-nums', tone === 'attention' ? 'text-attention' : 'text-ink')}>{value}</p>
      {hint ? <p className="mt-1.5 text-[12px] text-ink-3">{hint}</p> : null}
    </div>
  );
}

export function DataTable({ caption, columns, rows, numeric }: { caption: string; columns: { key: string; label: string }[]; rows: Record<string, React.ReactNode>[]; numeric?: string[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-surface">
      <table className="w-full min-w-[480px] border-collapse text-[13px]">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-line bg-surface-2 text-left">
            {columns.map((c) => (
              <th key={c.key} scope="col" className={cn('px-3 py-2 text-[12px] font-medium text-ink-3', numeric?.includes(c.key) && 'text-right')}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r, i) => (
            <tr key={i}>
              {columns.map((c, j) =>
                j === 0 ? (
                  <th key={c.key} scope="row" className="px-3 py-2 text-left font-medium text-ink">
                    {r[c.key]}
                  </th>
                ) : (
                  <td key={c.key} className={cn('px-3 py-2 text-ink-2', numeric?.includes(c.key) && 'text-right tabular-nums')}>
                    {r[c.key] ?? '—'}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export async function Definitions({ keys }: { keys: string[] }) {
  const t = await getTranslations('reports');
  return (
    <section aria-labelledby="metric-defs" className="rounded-lg border border-line bg-surface-2 p-4">
      <h2 id="metric-defs" className="text-[13px] font-semibold text-ink">
        {t('definitions')}
      </h2>
      <dl className="mt-2 space-y-2">
        {keys.map((k) => (
          <div key={k}>
            <dt className="text-[13px] font-medium text-ink">{t(`metrics.${k}.label` as never)}</dt>
            <dd className="text-[13px] leading-relaxed text-ink-2">{t(`metrics.${k}.definition` as never)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
