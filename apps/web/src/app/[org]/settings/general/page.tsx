import { getTranslations } from 'next-intl/server';
import { canOrg, getOrganization, listMembers } from '@orqivanta/core';
import { DangerZone, GeneralForm } from '@/components/settings/general-form';
import { requireActor } from '@/lib/session';

export async function generateMetadata() {
  const t = await getTranslations('settings');
  return { title: t('nav.general') };
}

export default async function GeneralSettings({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const actor = await requireActor(org);
  const organization = await getOrganization(actor);
  const isOwner = canOrg(actor.role, 'org.delete');
  const members = isOwner ? (await listMembers(actor)).filter((m) => m.userId !== actor.userId && m.status === 'active' && m.role !== 'client') : [];
  return (
    <div className="flex flex-col gap-6">
      <GeneralForm org={actor.orgSlug} name={organization.name} />
      {isOwner ? <DangerZone org={actor.orgSlug} orgName={organization.name} members={members.map((m) => ({ userId: m.userId, name: m.name, email: m.email }))} /> : null}
    </div>
  );
}
