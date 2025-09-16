import { getTranslations } from 'next-intl/server';
import { canOrg, listClientOptions, listMyProjectIds, listProjects, listTeams, PROJECT_TEMPLATES } from '@orqivanta/core';
import { SampleDataBadge } from '@/components/domain/badges';
import { NewProjectButton } from '@/components/projects/new-project-dialog';
import { ProjectList } from '@/components/projects/project-list';
import { PageHeader } from '@/components/ui/primitives';
import { requireActor } from '@/lib/session';

export async function generateMetadata() {
  const t = await getTranslations('projects');
  return { title: t('title') };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ProjectsPage({ params, searchParams }: { params: Promise<{ org: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { org } = await params;
  const sp = await searchParams;
  const actor = await requireActor(org);
  const t = await getTranslations('projects');
  const status = sp.status === 'archived' ? 'archived' : 'active';
  const clientId = sp.client && UUID.test(sp.client) ? sp.client : undefined;
  const canCreate = canOrg(actor.role, 'projects.create');
  const [projects, mine, clients, teams] = await Promise.all([
    listProjects(actor, { status, clientAccountId: clientId }),
    listMyProjectIds(actor),
    listClientOptions(actor),
    canCreate ? listTeams(actor) : Promise.resolve([]),
  ]);
  // The first-use empty state shows only when the organization has no projects at all.
  const hasAnyProjects = projects.length > 0 || (await listProjects(actor, { status: 'all' })).length > 0;

  const templates = PROJECT_TEMPLATES.map((tpl) => ({ id: tpl.id, name: tpl.name, description: tpl.description, milestones: tpl.milestones.length, tasks: tpl.tasks.length }));

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6 lg:px-10">
      <PageHeader
        title={t('title')}
        description={t('description')}
        actions={
          <>
            {actor.isDemo ? <SampleDataBadge /> : null}
            {canCreate ? <NewProjectButton org={org} templates={templates} clients={clients} teams={teams.map((tm) => ({ id: tm.id, name: tm.name }))} openInitially={sp.new === '1'} /> : null}
          </>
        }
      />
      <ProjectList
        org={org}
        projects={projects.map((p) => ({
          id: p.id,
          key: p.key,
          name: p.name,
          color: p.color,
          clientName: p.clientName,
          clientAccountId: p.clientAccountId,
          dueDate: p.dueDate,
          archivedAt: p.archivedAt,
          portalEnabled: p.portalEnabled,
          visibility: p.visibility,
          ownerName: p.ownerName,
          ownerColor: p.ownerColor,
          isFavorite: p.isFavorite,
          health: p.health,
          healthSource: p.healthSource,
          stats: p.stats,
          mine: mine.includes(p.id),
        }))}
        clients={clients}
        hasAnyProjects={hasAnyProjects}
        canCreate={canCreate}
      />
    </div>
  );
}
