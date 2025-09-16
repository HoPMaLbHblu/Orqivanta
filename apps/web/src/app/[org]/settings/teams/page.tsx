import { getTranslations } from 'next-intl/server';
import { listPeople, listTeams } from '@orqivanta/core';
import { TeamsPanel } from '@/components/settings/teams-panel';
import { requireActor } from '@/lib/session';

export async function generateMetadata() {
  const t = await getTranslations('settings');
  return { title: t('nav.teams') };
}

export default async function TeamsSettings({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const actor = await requireActor(org);
  const [teams, people] = await Promise.all([listTeams(actor), listPeople(actor)]);
  return (
    <TeamsPanel
      org={org}
      teams={teams.map((t) => ({ id: t.id, name: t.name, description: t.description, color: t.color, members: t.members.map((m) => ({ userId: m.userId, name: m.name, avatarColor: m.avatarColor })) }))}
      people={people.filter((p) => p.role !== 'client').map((p) => ({ id: p.id, name: p.name, avatarColor: p.avatarColor }))}
    />
  );
}
