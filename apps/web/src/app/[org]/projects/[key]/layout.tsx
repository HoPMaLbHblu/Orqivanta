import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Archive, Globe, Lock } from 'lucide-react';
import { recordView } from '@orqivanta/core';
import { Badge, HealthBadge, SampleDataBadge } from '@/components/domain/badges';
import { toneInk } from '@/components/domain/tone';
import { FavoriteButton } from '@/components/projects/favorite-button';
import { loadProject } from '@/components/projects/load';
import { Mono, Notice } from '@/components/ui/primitives';
import { NavTabs } from '@/components/ui/tabs';

export async function generateMetadata({ params }: { params: Promise<{ org: string; key: string }> }) {
  const { org, key } = await params;
  const { project } = await loadProject(org, key);
  return { title: project.name };
}

export default async function ProjectLayout({ children, params }: { children: React.ReactNode; params: Promise<{ org: string; key: string }> }) {
  const { org, key } = await params;
  const { actor, project, overview, isFavorite, can } = await loadProject(org, key);
  const t = await getTranslations('projects');
  await recordView(actor, 'project', project.id);
  const base = `/${org}/projects/${project.key}`;
  const tabs = [
    { href: base, label: t('tabs.overview'), exact: true },
    { href: `${base}/tasks`, label: t('tabs.tasks'), count: overview.stats.open || undefined },
    { href: `${base}/documents`, label: t('tabs.documents') },
    { href: `${base}/files`, label: t('tabs.files') },
    { href: `${base}/requests`, label: t('tabs.requests') },
    { href: `${base}/approvals`, label: t('tabs.approvals') },
    { href: `${base}/activity`, label: t('tabs.activity') },
    { href: `${base}/settings`, label: t('tabs.settings') },
  ];
  return (
    <div className="mx-auto max-w-[1280px] px-4 pt-6 sm:px-6 lg:px-10">
      <nav aria-label={t('breadcrumb')} className="text-[12px] text-ink-3">
        <Link href={`/${org}/projects`} className="hover:text-ink hover:underline">
          {t('title')}
        </Link>
        <span aria-hidden className="mx-1.5">/</span>
        <span className="text-ink-2">{project.key}</span>
      </nav>
      <header className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <span className="size-3 shrink-0 rounded-[3px]" style={{ background: toneInk(project.color) }} aria-hidden />
            <h1 className="min-w-0 truncate text-[22px] font-semibold tracking-[-0.01em] text-ink">{project.name}</h1>
            <Mono className="rounded border border-line px-1.5 py-0.5 text-[11px]">{project.key}</Mono>
            <FavoriteButton org={org} projectId={project.id} projectName={project.name} initial={isFavorite} />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px] text-ink-2">
            <HealthBadge health={overview.health} source={overview.healthSource} />
            {overview.client ? (
              <span>
                {t('forClient')} <span className="font-medium text-ink">{overview.client.name}</span>
              </span>
            ) : (
              <span className="text-ink-3">{t('internal')}</span>
            )}
            {project.portalEnabled ? (
              <Badge tone="accent" icon={Globe} title={t('portalOnHint')}>
                {t('portalOn')}
              </Badge>
            ) : null}
            {project.visibility === 'private' ? <Badge tone="muted" icon={Lock}>{t('private')}</Badge> : null}
            {project.archivedAt ? <Badge tone="muted" icon={Archive}>{t('archived')}</Badge> : null}
          </div>
        </div>
        {actor.isDemo ? <SampleDataBadge /> : null}
      </header>
      {project.archivedAt ? (
        <Notice tone="neutral" icon={<Archive />} className="mt-4">
          {can.archive ? t('archivedNoticeManager') : t('archivedNotice')}
        </Notice>
      ) : null}
      <NavTabs items={tabs} className="mt-5" />
      <div className="py-6">{children}</div>
    </div>
  );
}
