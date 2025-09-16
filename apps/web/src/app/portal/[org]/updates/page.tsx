import { getTranslations } from 'next-intl/server';
import { Megaphone } from 'lucide-react';
import { listPortalUpdates } from '@orqivanta/core';
import { PortalCard, PortalEmpty, PortalPageHeader } from '@/components/portal/portal-ui';
import { UpdateCard } from '@/components/portal/update-card';
import { requirePortal } from '@/components/portal/portal-session';

export async function generateMetadata() {
  const t = await getTranslations('portal.updates');
  return { title: t('title') };
}

export default async function PortalUpdatesPage({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const { viewer } = await requirePortal(org);
  const t = await getTranslations('portal.updates');
  const updates = await listPortalUpdates(viewer, { limit: 50 });

  return (
    <div className="mx-auto max-w-[760px] px-4 py-10 sm:px-6 lg:py-14">
      <PortalPageHeader title={t('title')} description={t('intro')} />
      {updates.length ? (
        <ol className="mt-10 flex flex-col gap-4">
          {updates.map((u) => (
            <li key={u.id}>
              <PortalCard className="px-6 py-5">
                <UpdateCard update={u} href={`/portal/${org}/projects/${u.projectKey}`} />
              </PortalCard>
            </li>
          ))}
        </ol>
      ) : (
        <PortalCard className="mt-10">
          <PortalEmpty icon={<Megaphone />} title={t('empty')} description={t('emptyHint')} />
        </PortalCard>
      )}
    </div>
  );
}
