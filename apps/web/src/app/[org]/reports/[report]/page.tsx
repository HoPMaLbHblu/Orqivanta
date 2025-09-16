import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getFormatter, getTranslations } from 'next-intl/server';
import { ArrowLeft, BarChart3, Download } from 'lucide-react';
import { canOrg, getReports, listProjects } from '@orqivanta/core';
import { HealthBadge, SampleDataBadge } from '@/components/domain/badges';
import { BarChart, ColumnChart, type Datum } from '@/components/reports/charts';
import { REPORT_METRICS, reportTable, SNAPSHOT, type Cell } from '@/components/reports/data';
import { DataTable, Definitions, RangeControls, StatTile } from '@/components/reports/parts';
import { parseRange, rangeQuery, REPORTS, type ReportSlug } from '@/components/reports/range';
import { Card, CardHeader, EmptyState, PageHeader } from '@/components/ui/primitives';
import { requireActor, requireUser } from '@/lib/session';

export async function generateMetadata({ params }: { params: Promise<{ report: string }> }) {
  const { report } = await params;
  const t = await getTranslations('reports');
  return { title: REPORTS.includes(report as ReportSlug) ? t(`report.${report as ReportSlug}.title`) : t('title') };
}

export default async function ReportPage({ params, searchParams }: { params: Promise<{ org: string; report: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { org, report } = await params;
  if (!REPORTS.includes(report as ReportSlug)) notFound();
  const slug = report as ReportSlug;
  const user = await requireUser();
  const actor = await requireActor(org);
  if (!canOrg(actor.role, 'reports.view')) notFound();
  const t = await getTranslations('reports');
  const th = await getTranslations('enums.health');
  const format = await getFormatter();
  const range = parseRange(await searchParams, user.timeZone);
  const [data, projects] = await Promise.all([getReports(actor, range), listProjects(actor, { status: 'active' })]);
  const qs = rangeQuery(range);
  const table = reportTable(slug, data);

  const num = (n: number | null, digits = 1) => (n === null ? t('noValue') : format.number(n, { maximumFractionDigits: digits }));
  const hours = (n: number | null) => (n === null ? t('noValue') : t('units.hours', { value: num(n) }));
  const days = (n: number | null) => (n === null ? t('noValue') : t('units.daysShort', { value: num(n) }));
  const shortDate = (iso: string) => format.dateTime(new Date(`${iso}T12:00:00Z`), { day: 'numeric', month: 'short', timeZone: 'UTC' });

  let tiles: { label: string; value: string; tone?: 'attention' }[] = [];
  let chart: React.ReactNode = null;
  const title = t(`report.${slug}.chart`);
  const xLabel = t(`report.${slug}.xLabel`);
  let display: (key: string, v: Cell, row: Record<string, Cell>) => React.ReactNode = (_k, v) => (typeof v === 'number' ? num(v) : v);

  switch (slug) {
    case 'progress': {
      const ps = [...data.projects].sort((a, b) => (b.progress ?? -1) - (a.progress ?? -1));
      tiles = [
        { label: t('tiles.activeProjects'), value: num(ps.length) },
        { label: t('tiles.atRisk'), value: num(ps.filter((p) => p.health !== 'on_track').length), tone: ps.some((p) => p.health !== 'on_track') ? 'attention' : undefined },
        { label: t('tiles.openTotal'), value: num(ps.reduce((s, p) => s + p.open, 0)) },
      ];
      const d: Datum[] = ps.map((p) => ({ key: p.id, label: p.name, value: p.progress === null ? 0 : Math.round(p.progress * 100), display: p.progress === null ? t('noValue') : t('units.pct', { value: Math.round(p.progress * 100) }) }));
      chart = d.length ? <BarChart data={d} title={title} xLabel={xLabel} max={100} /> : null;
      display = (k, v, row) => (k === 'health' ? <HealthBadge health={v as never} /> : k === 'progress_pct' ? (v === null ? t('noValue') : t('units.pct', { value: v })) : k === 'due_date' && v ? shortDate(String(v)) : k === 'project' ? <Link href={`/${org}/projects/${row.key}`} className="hover:underline">{v}</Link> : typeof v === 'number' ? num(v) : v);
      break;
    }
    case 'overdue': {
      const rows = data.overdueByProject;
      const overdue = rows.reduce((s, p) => s + p.overdue, 0);
      tiles = [
        { label: t('tiles.overdueTotal'), value: num(overdue), tone: overdue ? 'attention' : undefined },
        { label: t('tiles.openTotal'), value: num(rows.reduce((s, p) => s + p.open, 0)) },
      ];
      const d: Datum[] = rows.filter((p) => p.overdue > 0).map((p) => ({ key: p.project_id, label: p.name, value: p.overdue, display: num(p.overdue), color: 'var(--danger)' }));
      chart = d.length ? <BarChart data={d} title={title} xLabel={xLabel} /> : null;
      display = (k, v, row) => (k === 'overdue_share_pct' ? (v === null ? t('noValue') : t('units.pct', { value: v })) : k === 'project' ? <Link href={`/${org}/projects/${row.key}`} className="hover:underline">{v}</Link> : typeof v === 'number' ? num(v) : v);
      break;
    }
    case 'throughput': {
      const total = data.throughput.reduce((s, w) => s + w.completed, 0);
      tiles = [
        { label: t('tiles.completed'), value: num(total) },
        { label: t('tiles.weeklyAverage'), value: num(data.throughput.length ? total / data.throughput.length : 0) },
      ];
      const d: Datum[] = data.throughput.map((w) => ({ key: w.week, label: shortDate(w.week), value: w.completed, display: t('headline.throughput', { count: w.completed }) }));
      chart = total > 0 ? <ColumnChart data={d} title={title} xLabel={xLabel} yLabel={t('report.throughput.yLabel')} /> : null;
      display = (k, v) => (k === 'week_starting' ? shortDate(String(v)) : typeof v === 'number' ? num(v) : v);
      break;
    }
    case 'cycle-time': {
      const c = data.cycleTime;
      tiles = [
        { label: t('tiles.median'), value: days(c.medianDays) },
        { label: t('tiles.p85'), value: days(c.p85Days) },
        { label: t('tiles.sample'), value: num(c.sample) },
      ];
      chart =
        c.sample > 0 ? (
          <BarChart
            title={title}
            xLabel={xLabel}
            data={[
              { key: 'median', label: t('measure.median'), value: c.medianDays ?? 0, display: days(c.medianDays) },
              { key: 'p85', label: t('measure.p85'), value: c.p85Days ?? 0, display: days(c.p85Days) },
            ]}
          />
        ) : null;
      display = (k, v) => (k === 'measure' ? t(`measure.${v}` as never) : typeof v === 'number' ? num(v) : v);
      break;
    }
    case 'request-response': {
      const r = data.requests;
      tiles = [
        { label: t('tiles.submitted'), value: num(r.submitted) },
        { label: t('tiles.resolved'), value: num(r.resolved) },
        { label: t('tiles.firstResponse'), value: hours(r.medianResponseHours) },
        { label: t('tiles.resolution'), value: days(r.medianResolutionDays) },
      ];
      const d: Datum[] = table.rows.map((b) => ({ key: String(b.category), label: String(b.category), value: Number(b.total_open), display: num(Number(b.total_open)) }));
      chart = d.length ? <BarChart data={d} title={title} xLabel={xLabel} /> : null;
      break;
    }
    case 'approval-turnaround': {
      const a = data.approvals;
      tiles = [
        { label: t('tiles.decided'), value: num(a.decided) },
        { label: t('tiles.turnaround'), value: hours(a.medianHours) },
        { label: t('tiles.pending'), value: num(a.pending), tone: a.pending ? 'attention' : undefined },
        { label: t('tiles.rounds'), value: num(a.avgRounds) },
      ];
      const te = await getTranslations('enums.approvalStatus');
      const colors: Record<string, string> = { approved: 'var(--success)', changes_requested: 'var(--info)', rejected: 'var(--danger)' };
      const d: Datum[] = table.rows.map((row) => ({ key: String(row.outcome), label: te(row.outcome as never), value: Number(row.reviews), display: num(Number(row.reviews)), color: colors[String(row.outcome)] }));
      chart = a.decided > 0 ? <BarChart data={d} title={title} xLabel={xLabel} /> : null;
      display = (k, v) => (k === 'outcome' ? te(v as never) : typeof v === 'number' ? num(v) : v);
      break;
    }
  }

  const numeric = table.columns.filter((c) => table.rows.some((r) => typeof r[c] === 'number'));
  const hasRows = slug === 'cycle-time' ? data.cycleTime.sample > 0 : slug === 'approval-turnaround' ? data.approvals.decided > 0 : table.rows.length > 0;

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6 lg:px-10">
      <Link href={`/${org}/reports?${qs}`} className="inline-flex items-center gap-1 text-[13px] text-ink-3 hover:text-ink">
        <ArrowLeft className="size-3.5" aria-hidden /> {t('allReports')}
      </Link>
      <PageHeader
        className="mt-2"
        title={t(`report.${slug}.title`)}
        description={t(`report.${slug}.summary`)}
        actions={
          <>
            {actor.isDemo ? <SampleDataBadge /> : null}
            <a href={`/${org}/reports/${slug}/csv?${qs}`} download className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line-strong bg-surface px-2.5 text-[13px] font-medium text-ink hover:bg-surface-2">
              <Download className="size-4" aria-hidden /> {t('exportCsv')}
            </a>
          </>
        }
      />
      <div className="mt-5">
        <RangeControls action={`/${org}/reports/${slug}`} range={range} projects={projects.map((p) => ({ id: p.id, name: p.name }))} snapshot={SNAPSHOT[slug]} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-6">
          <section aria-label={t(`report.${slug}.title`)} className={`grid gap-3 ${tiles.length > 3 ? 'grid-cols-2 xl:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3'}`}>
            {tiles.map((tile) => (
              <StatTile key={tile.label} {...tile} />
            ))}
          </section>
          <Card>
            <CardHeader title={title} />
            <div className="p-4">{chart ?? <EmptyState compact icon={<BarChart3 />} title={t(`empty.${slug}`)} />}</div>
          </Card>
          {hasRows ? (
            <section aria-labelledby="report-table">
              <h2 id="report-table" className="mb-2 text-[13px] font-semibold text-ink">
                {t('table')}
              </h2>
              <DataTable
                caption={t('tableCaption', { title })}
                columns={table.columns.map((c) => ({ key: c, label: t(`columns.${c}` as never) }))}
                numeric={numeric}
                rows={table.rows.map((row) => Object.fromEntries(table.columns.map((c) => [c, display(c, row[c] ?? null, row)])))}
              />
            </section>
          ) : null}
        </div>
        <aside className="flex flex-col gap-4">
          <Definitions keys={REPORT_METRICS[slug]} />
          <p className="text-[12px] leading-relaxed text-ink-3">{t('note')}</p>
        </aside>
      </div>
    </div>
  );
}
