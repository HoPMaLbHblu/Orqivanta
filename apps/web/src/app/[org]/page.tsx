import Link from 'next/link';
import { getFormatter, getTranslations } from 'next-intl/server';
import { AlertTriangle, ArrowRight, CalendarClock, CheckSquare, Eye, FolderKanban, Inbox, Stamp } from 'lucide-react';
import { getHome } from '@orqivanta/core';
import { ActivityList } from '@/components/domain/activity-list';
import { DueDate } from '@/components/domain/dates';
import { HealthBadge, PriorityIcon, SampleDataBadge, StatusIcon } from '@/components/domain/badges';
import { ProgressBar } from '@/components/domain/progress';
import { toneInk } from '@/components/domain/tone';
import { Card, CardHeader, EmptyState, Mono } from '@/components/ui/primitives';
import { Tooltip } from '@/components/ui/tooltip';
import { requireActor, requireUser } from '@/lib/session';
import { cn } from '@/lib/cn';

export async function generateMetadata() {
  const t = await getTranslations('home');
  return { title: t('title') };
}

function greetingKey(hour: number) {
  return hour < 5 ? 'evening' : hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
}

export default async function HomePage({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const user = await requireUser();
  const actor = await requireActor(org);
  const t = await getTranslations('home');
  const format = await getFormatter();
  const home = await getHome(actor);
  const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone: user.timeZone }).format(new Date()));
  const base = `/${org}`;
  const firstName = user.name.split(' ')[0] ?? user.name;

  const tiles = [
    { key: 'assigned', value: home.counts.assigned, href: `${base}/my-work`, icon: CheckSquare },
    { key: 'overdue', value: home.counts.overdue, href: `${base}/my-work?due=overdue`, icon: AlertTriangle, attention: home.counts.overdue > 0 },
    { key: 'dueThisWeek', value: home.counts.dueThisWeek, href: `${base}/my-work?due=week`, icon: CalendarClock },
    { key: 'reviews', value: home.counts.reviews, href: `${base}/approvals?view=awaiting_me`, icon: Stamp, attention: home.counts.reviews > 0 },
    { key: 'requests', value: home.counts.requests, href: `${base}/requests?view=mine`, icon: Inbox },
  ] as const;

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-8 lg:px-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[13px] text-ink-3">{format.dateTime(new Date(), { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <h1 className="mt-1 font-serif text-[34px] leading-tight text-ink">{t(`greeting.${greetingKey(hour)}`, { name: firstName })}</h1>
        </div>
        {actor.isDemo ? <SampleDataBadge /> : null}
      </header>

      <section aria-label={t('summary')} className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {tiles.map((tile) => (
          <Tooltip key={tile.key} content={t(`tiles.${tile.key}.definition`)}>
            <Link href={tile.href} className={cn('group rounded-lg border bg-surface p-4 transition-colors hover:border-line-strong', 'attention' in tile && tile.attention ? 'border-attention/40' : 'border-line')}>
              <span className="flex items-center gap-2 text-[12px] text-ink-3">
                <tile.icon className={cn('size-4', 'attention' in tile && tile.attention ? 'text-attention' : 'text-ink-3')} aria-hidden />
                {t(`tiles.${tile.key}.label`)}
              </span>
              <span className={cn('mt-2 block text-[28px] leading-none font-semibold tabular-nums', 'attention' in tile && tile.attention ? 'text-attention' : 'text-ink')}>{tile.value}</span>
            </Link>
          </Tooltip>
        ))}
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader title={t('upNext')} description={t('upNextHint')} action={<Link href={`${base}/my-work`} className="text-[12px] font-medium text-accent hover:underline">{t('openMyWork')}</Link>} />
            {home.upcoming.length ? (
              <ul className="divide-y divide-line">
                {home.upcoming.map((task) => (
                  <li key={task.id}>
                    <Link href={`${base}/tasks/${task.projectKey}-${task.number}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2">
                      <StatusIcon category={task.statusCategory as never} />
                      <Mono className="w-16 shrink-0">{`${task.projectKey}-${task.number}`}</Mono>
                      <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{task.title}</span>
                      <PriorityIcon priority={task.priority as never} />
                      <DueDate date={task.dueDate} short className="w-20 justify-end" />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState compact icon={<CheckSquare />} title={t('noUpcoming')} description={t('noUpcomingHint')} />
            )}
          </Card>

          {home.reviews.length ? (
            <Card className="border-attention/40">
              <CardHeader title={t('reviewsWaiting')} description={t('reviewsHint')} />
              <ul className="divide-y divide-line">
                {home.reviews.map((r) => (
                  <li key={r.id}>
                    <Link href={`${base}/approvals/${r.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2">
                      <Eye className="size-4 text-attention" aria-hidden />
                      <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{r.title}</span>
                      <span className="text-[12px] text-ink-3">{r.projectName}</span>
                      <DueDate date={r.dueDate} short />
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          <Card>
            <CardHeader title={t('recentActivity')} />
            <div className="px-4">
              <ActivityList items={home.activity} orgSlug={org} />
            </div>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader title={t('yourProjects')} action={<Link href={`${base}/projects`} className="text-[12px] font-medium text-accent hover:underline">{t('allProjects')}</Link>} />
            {home.projects.length ? (
              <ul className="divide-y divide-line">
                {home.projects.map((p) => (
                  <li key={p.id}>
                    <Link href={`${base}/projects/${p.key}`} className="block px-4 py-3 hover:bg-surface-2">
                      <div className="flex items-center gap-2">
                        <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: toneInk(p.color) }} aria-hidden />
                        <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">{p.name}</span>
                        <HealthBadge health={p.health} source={p.healthSource} />
                      </div>
                      <div className="mt-2 flex items-center gap-3 pl-[18px]">
                        <ProgressBar value={p.stats.progress} label={t('progressOf', { name: p.name })} className="flex-1" />
                        {p.stats.overdue ? <span className="text-[12px] text-danger">{t('overdueCount', { count: p.stats.overdue })}</span> : null}
                      </div>
                      {p.clientName ? <p className="mt-1 pl-[18px] text-[12px] text-ink-3">{p.clientName}</p> : null}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState compact icon={<FolderKanban />} title={t('noProjects')} description={t('noProjectsHint')} action={<Link href={`${base}/projects?new=1`} className="inline-flex items-center gap-1 text-[13px] font-medium text-accent hover:underline">{t('createProject')} <ArrowRight className="size-3.5" /></Link>} />
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
