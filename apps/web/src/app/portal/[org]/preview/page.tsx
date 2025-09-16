import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { ArrowLeft, Users } from 'lucide-react';
import { listClients } from '@orqivanta/core';
import { and, eq, isNull, projects, sql, withTenant } from '@orqivanta/db';
import { PortalCard, PortalEmpty, PortalPageHeader } from '@/components/portal/portal-ui';
import { PreviewPicker } from '@/components/portal/preview-picker';
import { getPortalSession } from '@/components/portal/portal-session';

export async function generateMetadata() {
  const t = await getTranslations('portal.preview');
  return { title: t('pageTitle') };
}

/**
 * "View as client" for owners and admins. The portal itself is then rendered with a
 * client-scoped actor, so every page applies the same permission rules a client contact gets.
 */
export default async function PortalPreviewPage({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const { actor, canPreview } = await getPortalSession(org);
  if (actor.role === 'client') notFound();
  const t = await getTranslations('portal.preview');

  if (!canPreview) {
    return (
      <div className="mx-auto max-w-[680px] px-4 py-16 sm:px-6">
        <PortalPageHeader title={t('notAllowed')} description={t('notAllowedHint')} />
        <Link href={`/${org}`} className="mt-6 inline-flex items-center gap-1.5 text-[14px] font-medium text-accent hover:underline">
          <ArrowLeft className="size-4" aria-hidden /> {t('backToApp')}
        </Link>
      </div>
    );
  }

  const clients = await listClients(actor);
  // How many of each client's projects the portal is actually on: a client with none sees an empty portal.
  const counts = await withTenant(actor.orgId, (tx) =>
    tx
      .select({ clientAccountId: projects.clientAccountId, n: sql<number>`count(*)::int` })
      .from(projects)
      .where(and(eq(projects.orgId, actor.orgId), eq(projects.portalEnabled, true), isNull(projects.deletedAt)))
      .groupBy(projects.clientAccountId),
  );

  return (
    <div className="mx-auto max-w-[760px] px-4 py-12 sm:px-6 lg:py-16">
      <PortalPageHeader eyebrow={t('bannerTitle')} title={t('pageTitle')} description={t('pageIntro')} />
      <div className="mt-8">
        {clients.length ? (
          <PreviewPicker
            org={org}
            clients={clients.map((c) => ({ id: c.id, name: c.name, portalProjects: counts.find((x) => x.clientAccountId === c.id)?.n ?? 0 }))}
          />
        ) : (
          <PortalCard>
            <PortalEmpty icon={<Users />} title={t('noClients')} description={t('noClientsHint')} />
          </PortalCard>
        )}
      </div>
      <Link href={`/${org}`} className="mt-8 inline-flex items-center gap-1.5 text-[14px] font-medium text-accent hover:underline">
        <ArrowLeft className="size-4" aria-hidden /> {t('backToApp')}
      </Link>
    </div>
  );
}
