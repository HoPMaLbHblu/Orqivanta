import { getTranslations } from 'next-intl/server';
import { Lock } from 'lucide-react';
import { listClientOptions, listPeople, listStatuses, listTeams } from '@orqivanta/core';
import { StatusIcon } from '@/components/domain/badges';
import { loadProject } from '@/components/projects/load';
import { ProjectDangerZone } from '@/components/projects/project-danger-zone';
import { ProjectDetailsForm } from '@/components/projects/project-details-form';
import { ProjectMembers } from '@/components/projects/project-members';
import { ProjectPortalCard } from '@/components/projects/project-portal-card';
import { Card, CardHeader, EmptyState } from '@/components/ui/primitives';

export async function generateMetadata({ params }: { params: Promise<{ org: string; key: string }> }) {
  const { org, key } = await params;
  const [{ project }, t] = await Promise.all([loadProject(org, key), getTranslations('projects')]);
  return { title: `${t('tabs.settings')} · ${project.name}` };
}

export default async function ProjectSettingsPage({ params }: { params: Promise<{ org: string; key: string }> }) {
  const { org, key } = await params;
  const { actor, project, overview, can } = await loadProject(org, key);
  const t = await getTranslations('projects');

  if (!can.edit && !can.manageMembers && !can.archive && !can.share) {
    return (
      <Card className="max-w-2xl">
        <EmptyState icon={<Lock />} title={t('settings.noAccess')} description={t('settings.noAccessBody')} />
      </Card>
    );
  }

  const [clients, teams, people, statuses] = await Promise.all([
    can.edit ? listClientOptions(actor) : Promise.resolve([]),
    can.edit ? listTeams(actor) : Promise.resolve([]),
    can.manageMembers ? listPeople(actor) : Promise.resolve([]),
    listStatuses(actor, project.id),
  ]);

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      {can.edit ? (
        <ProjectDetailsForm
          org={org}
          project={{
            id: project.id,
            key: project.key,
            name: project.name,
            description: project.description,
            goals: project.goals,
            visibility: project.visibility,
            teamId: project.teamId,
            clientAccountId: project.clientAccountId,
            ownerId: project.ownerId,
            startDate: project.startDate,
            dueDate: project.dueDate,
            status: project.status === 'archived' ? 'active' : (project.status as 'active' | 'paused' | 'completed'),
            color: project.color,
            version: project.version,
          }}
          clients={clients}
          teams={teams.map((tm) => ({ id: tm.id, name: tm.name }))}
          owners={(people.length ? people : overview.members.map((m) => ({ id: m.userId, name: m.name, role: 'member' as const }))).filter((p) => p.role !== 'client').map((p) => ({ id: p.id, name: p.name }))}
        />
      ) : null}

      {can.manageMembers || overview.members.length ? (
        <ProjectMembers
          org={org}
          projectId={project.id}
          canManage={can.manageMembers}
          members={overview.members.map((m) => ({ userId: m.userId, name: m.name, email: m.email, avatarColor: m.avatarColor, role: m.role }))}
          candidates={people.filter((p) => p.role !== 'client' && !overview.members.some((m) => m.userId === p.id)).map((p) => ({ id: p.id, name: p.name, email: p.email, avatarColor: p.avatarColor }))}
          currentUserId={actor.userId}
        />
      ) : null}

      {can.share ? <ProjectPortalCard org={org} projectId={project.id} enabled={project.portalEnabled} clientName={overview.client?.name ?? null} /> : null}

      <Card>
        <CardHeader title={t('settings.statuses')} description={t('settings.statusesHint')} />
        <ul className="divide-y divide-line">
          {statuses.map((s) => (
            <li key={s.id} className="flex items-center gap-2.5 px-4 py-2 text-[13px] text-ink">
              <StatusIcon category={s.category} />
              {s.name}
              <span className="ml-auto text-[12px] text-ink-3">{t(`settings.category.${s.category}`)}</span>
            </li>
          ))}
        </ul>
      </Card>

      {can.archive || can.delete ? (
        <ProjectDangerZone org={org} projectId={project.id} projectKey={project.key} projectName={project.name} archived={Boolean(project.archivedAt)} canArchive={can.archive} canDelete={can.delete} />
      ) : null}
    </div>
  );
}
