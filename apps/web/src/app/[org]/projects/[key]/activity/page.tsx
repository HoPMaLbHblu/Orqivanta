import { getTranslations } from 'next-intl/server';
import { listActivity } from '@orqivanta/core';
import { ActivityList } from '@/components/domain/activity-list';
import { loadProject } from '@/components/projects/load';
import { Card, CardHeader } from '@/components/ui/primitives';

export async function generateMetadata({ params }: { params: Promise<{ org: string; key: string }> }) {
  const { org, key } = await params;
  const [{ project }, t] = await Promise.all([loadProject(org, key), getTranslations('projects')]);
  return { title: `${t('tabs.activity')} · ${project.name}` };
}

export default async function ProjectActivityPage({ params }: { params: Promise<{ org: string; key: string }> }) {
  const { org, key } = await params;
  const { actor, project } = await loadProject(org, key);
  const t = await getTranslations('projects');
  const { items } = await listActivity(actor, { projectId: project.id, limit: 60 });
  return (
    <Card className="max-w-3xl">
      <CardHeader title={t('activity.title')} description={t('activity.hint')} />
      <div className="px-4">
        <ActivityList items={items.map((a) => ({ id: a.id, summary: a.summary, createdAt: a.createdAt, actorName: a.actorName, actorColor: a.actorColor }))} orgSlug={org} showProject={false} emptyLabel={t('activity.empty')} />
      </div>
    </Card>
  );
}
