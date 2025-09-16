import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { CalendarClock, CheckSquare, Flag, Settings2, Target, Users } from 'lucide-react';
import { ActivityList } from '@/components/domain/activity-list';
import { Avatar } from '@/components/domain/avatar';
import { DueDate, FormattedDate } from '@/components/domain/dates';
import { ProgressBar } from '@/components/domain/progress';
import { loadProject } from '@/components/projects/load';
import { MilestonesPanel } from '@/components/projects/milestones-panel';
import { UpdatesPanel } from '@/components/projects/updates-panel';
import { Card, CardHeader, EmptyState } from '@/components/ui/primitives';

export default async function ProjectOverviewPage({ params }: { params: Promise<{ org: string; key: string }> }) {
  const { org, key } = await params;
  const { project, overview, can } = await loadProject(org, key);
  const t = await getTranslations('projects');
  const tr = await getTranslations('enums.projectRole');
  const base = `/${org}/projects/${project.key}`;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader
            title={t('overview.about')}
            action={
              can.edit ? (
                <Link href={`${base}/settings`} className="inline-flex items-center gap-1 text-[12px] font-medium text-accent hover:underline">
                  <Settings2 className="size-3.5" aria-hidden /> {t('overview.editDetails')}
                </Link>
              ) : null
            }
          />
          <div className="flex flex-col gap-4 px-4 py-4">
            {project.description ? (
              <p className="max-w-prose text-[14px] leading-relaxed whitespace-pre-line text-ink-2">{project.description}</p>
            ) : (
              <p className="text-[13px] text-ink-3">{can.edit ? t('overview.noDescriptionManager') : t('overview.noDescription')}</p>
            )}
            {project.goals.length ? (
              <div>
                <h3 className="flex items-center gap-1.5 text-[12px] font-medium tracking-wide text-ink-3 uppercase">
                  <Target className="size-3.5" aria-hidden /> {t('overview.goals')}
                </h3>
                <ul className="mt-2 flex flex-col gap-1.5">
                  {project.goals.map((g, i) => (
                    <li key={i} className="flex gap-2 text-[14px] text-ink">
                      <span aria-hidden className="mt-[7px] size-1.5 shrink-0 rounded-full bg-accent" />
                      {g}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-line pt-4 text-[13px] sm:grid-cols-4">
              <div>
                <dt className="text-[12px] text-ink-3">{t('overview.start')}</dt>
                <dd className="mt-0.5 text-ink">{project.startDate ? <FormattedDate date={project.startDate} /> : <span className="text-ink-3">—</span>}</dd>
              </div>
              <div>
                <dt className="text-[12px] text-ink-3">{t('overview.due')}</dt>
                <dd className="mt-0.5 text-ink">{project.dueDate ? <DueDate date={project.dueDate} done={overview.stats.progress === 1} /> : <span className="text-ink-3">—</span>}</dd>
              </div>
              <div>
                <dt className="text-[12px] text-ink-3">{t('overview.owner')}</dt>
                <dd className="mt-0.5 text-ink">
                  {overview.owner ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Avatar name={overview.owner.name} color={overview.owner.avatarColor} size="xs" title="" />
                      {overview.owner.name}
                    </span>
                  ) : (
                    <span className="text-ink-3">—</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-[12px] text-ink-3">{t('overview.team')}</dt>
                <dd className="mt-0.5 text-ink">{overview.team?.name ?? <span className="text-ink-3">—</span>}</dd>
              </div>
            </dl>
          </div>
        </Card>

        <MilestonesPanel
          org={org}
          projectId={project.id}
          projectKey={project.key}
          canManage={can.milestones}
          canShare={can.share}
          portalEnabled={project.portalEnabled}
          milestones={overview.milestones.map((m) => ({ id: m.id, name: m.name, description: m.description, dueDate: m.dueDate, status: m.status, sharedWithClient: m.sharedWithClient, taskTotal: m.taskTotal, taskDone: m.taskDone }))}
        />

        <UpdatesPanel
          org={org}
          projectId={project.id}
          canPost={can.postUpdate}
          canShare={can.share}
          portalEnabled={project.portalEnabled}
          health={overview.health}
          healthSource={overview.healthSource}
          updates={overview.updates.map((u) => ({ id: u.id, health: u.health, summary: u.summary, body: u.body, sharedWithClient: u.sharedWithClient, createdAt: u.createdAt, authorName: u.authorName, authorColor: u.authorColor }))}
        />
      </div>

      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader title={t('overview.progress')} description={t('overview.progressHint')} />
          <div className="px-4 py-4">
            <ProgressBar value={overview.stats.progress} label={t('progressOf', { name: project.name })} />
            <dl className="mt-4 grid grid-cols-2 gap-3 text-[13px]">
              {([
                ['open', overview.stats.open, 'text-ink'],
                ['completed', overview.stats.completed, 'text-success'],
                ['overdue', overview.stats.overdue, overview.stats.overdue ? 'text-danger' : 'text-ink-3'],
                ['blocked', overview.stats.blocked, overview.stats.blocked ? 'text-attention' : 'text-ink-3'],
              ] as const).map(([k, v, cls]) => (
                <div key={k} className="rounded-md border border-line px-3 py-2">
                  <dt className="text-[12px] text-ink-3">{t(`overview.stat.${k}`)}</dt>
                  <dd className={`mt-0.5 text-[20px] leading-none font-semibold tabular-nums ${cls}`}>{v}</dd>
                </div>
              ))}
            </dl>
            <Link href={`${base}/tasks`} className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-accent hover:underline">
              <CheckSquare className="size-4" aria-hidden /> {t('overview.openTasks')}
            </Link>
          </div>
        </Card>

        {overview.members.length || can.manageMembers ? (
          <Card>
            <CardHeader
              title={t('overview.members')}
              action={
                can.manageMembers ? (
                  <Link href={`${base}/settings`} className="text-[12px] font-medium text-accent hover:underline">
                    {t('overview.manage')}
                  </Link>
                ) : null
              }
            />
            {overview.members.length ? (
              <ul className="divide-y divide-line">
                {overview.members.map((m) => (
                  <li key={m.userId} className="flex items-center gap-2.5 px-4 py-2">
                    <Avatar name={m.name} color={m.avatarColor} size="sm" title="" />
                    <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{m.name}</span>
                    <span className="text-[12px] text-ink-3">{tr(m.role)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState compact icon={<Users />} title={t('overview.noMembers')} />
            )}
          </Card>
        ) : null}

        <Card>
          <CardHeader title={t('overview.recentActivity')} action={<Link href={`${base}/activity`} className="text-[12px] font-medium text-accent hover:underline">{t('overview.allActivity')}</Link>} />
          <div className="px-4">
            <ActivityList items={overview.activity.map((a) => ({ id: a.id, summary: a.summary, createdAt: a.createdAt, actorName: a.actorName, actorColor: a.actorColor }))} orgSlug={org} showProject={false} />
          </div>
        </Card>

        {overview.milestones.length ? null : (
          <p className="flex items-start gap-2 text-[12px] text-ink-3">
            <Flag className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {t('overview.milestoneHint')}
          </p>
        )}
        {project.dueDate ? (
          <p className="flex items-center gap-1.5 text-[12px] text-ink-3">
            <CalendarClock className="size-3.5" aria-hidden /> {t('overview.dueNote')}
          </p>
        ) : null}
      </div>
    </div>
  );
}
