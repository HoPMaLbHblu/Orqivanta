import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getFormatter, getTranslations } from 'next-intl/server';
import { ArrowRight, BarChart3, Clock, Gauge, Hourglass, Inbox, Stamp, type LucideIcon } from 'lucide-react';
import { canOrg, getReports, listProjects } from '@orqivanta/core';
import { SampleDataBadge } from '@/components/domain/badges';
import { RangeControls } from '@/components/reports/parts';
import { parseRange, rangeQuery, REPORTS, type ReportSlug } from '@/components/reports/range';
import { Notice, PageHeader } from '@/components/ui/primitives';
import { requireActor, requireUser } from '@/lib/session';

export async function generateMetadata() {
  const t = await getTranslations('reports');
  return { title: t('title') };
}

const ICONS: Record<ReportSlug, LucideIcon> = { progress: Gauge, overdue: Clock, throughput: BarChart3, 'cycle-time': Hourglass, 'request-response': Inbox, 'approval-turnaround': Stamp };

export default async function ReportsPage({ params, searchParams }: { params: Promise<{ org: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { org } = await params;
  const user = await requireUser();
  const actor = await requireActor(org);
  if (!canOrg(actor.role, 'reports.view')) notFound();
  const t = await getTranslations('reports');
  const format = await getFormatter();
  const range = parseRange(await searchParams, user.timeZone);
  const [data, projects] = await Promise.all([getReports(actor, range), listProjects(actor, { status: 'active' })]);
  const qs = rangeQuery(range);
  const num = (n: number, digits = 1) => format.number(n, { maximumFractionDigits: digits });

  const headline: Record<ReportSlug, string> = {
    progress: t('headline.progress', { count: data.projects.length }),
    overdue: t('headline.overdue', { count: data.overdueByProject.reduce((s, p) => s + p.overdue, 0) }),
    throughput: t('headline.throughput', { count: data.throughput.reduce((s, w) => s + w.completed, 0) }),
    'cycle-time': data.cycleTime.medianDays === null ? t('headline.noData') : t('headline.cycle-time', { value: t('units.daysShort', { value: num(data.cycleTime.medianDays) }) }),
    'request-response': data.requests.medianResponseHours === null ? t('headline.noData') : t('headline.request-response', { value: t('units.hours', { value: num(data.requests.medianResponseHours) }) }),
    'approval-turnaround': data.approvals.medianHours === null ? t('headline.noData') : t('headline.approval-turnaround', { value: t('units.hours', { value: num(data.approvals.medianHours) }) }),
  };

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6 lg:px-10">
      <PageHeader title={t('title')} description={t('description')} actions={actor.isDemo ? <SampleDataBadge /> : null} />
      <Notice tone="neutral" className="mt-5">
        {t('note')}
      </Notice>
      <div className="mt-5">
        <RangeControls action={`/${org}/reports`} range={range} projects={projects.map((p) => ({ id: p.id, name: p.name }))} />
      </div>
      <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {REPORTS.map((slug) => {
          const Icon = ICONS[slug];
          return (
            <li key={slug}>
              <Link href={`/${org}/reports/${slug}?${qs}`} className="group flex h-full flex-col rounded-lg border border-line bg-surface p-4 transition-colors hover:border-line-strong">
                <span className="flex items-center gap-2 text-[13px] font-semibold text-ink">
                  <Icon className="size-4 text-accent" aria-hidden />
                  {t(`report.${slug}.title`)}
                </span>
                <span className="mt-1 text-[13px] text-ink-3">{t(`report.${slug}.summary`)}</span>
                <span className="mt-4 text-[20px] leading-tight font-semibold text-ink tabular-nums">{headline[slug]}</span>
                <span className="mt-auto inline-flex items-center gap-1 pt-4 text-[12px] font-medium text-accent group-hover:underline">
                  {t('openReport')} <ArrowRight className="size-3.5" aria-hidden />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
