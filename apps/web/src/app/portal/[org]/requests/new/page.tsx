import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { ArrowLeft, Inbox } from 'lucide-react';
import { listForms, listProjects } from '@orqivanta/core';
import { PortalCard, PortalEmpty, PortalPageHeader } from '@/components/portal/portal-ui';
import { RequestForm } from '@/components/portal/request-form';
import { requirePortal } from '@/components/portal/portal-session';

export async function generateMetadata() {
  const t = await getTranslations('portal.requests');
  return { title: t('newTitle') };
}

export default async function NewPortalRequestPage({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const { actor, viewer, preview } = await requirePortal(org);
  // Submitting as a client is a real action: it can't be previewed, so staff get a 404 here.
  if (preview) notFound();
  const t = await getTranslations('portal.requests');
  const base = `/portal/${org}`;
  const [forms, projects] = await Promise.all([listForms(viewer), listProjects(viewer)]);

  return (
    <div className="mx-auto max-w-[680px] px-4 py-10 sm:px-6 lg:py-14">
      <Link href={`${base}/requests`} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-3 hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> {t('title')}
      </Link>
      <PortalPageHeader className="mt-4" title={t('newTitle')} description={t('newIntro')} />
      <div className="mt-8">
        {forms.length ? (
          <RequestForm
            org={org}
            cancelHref={`${base}/requests`}
            forms={forms.map((f) => ({ id: f.id, name: f.name, description: f.description, fields: f.fields }))}
            projects={projects.map((p) => ({ id: p.id, name: p.name }))}
          />
        ) : (
          <PortalCard>
            <PortalEmpty icon={<Inbox />} title={t('noForms')} description={t('noFormsHint', { org: actor.orgName })} />
          </PortalCard>
        )}
      </div>
    </div>
  );
}
