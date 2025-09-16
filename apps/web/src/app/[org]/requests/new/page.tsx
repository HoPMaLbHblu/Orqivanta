import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { ChevronLeft } from 'lucide-react';
import { canOrg, listClientOptions, listForms, listProjects } from '@orqivanta/core';
import { NewRequestForm } from '@/components/requests/new-request-form';
import { PageHeader } from '@/components/ui/primitives';
import { requireActor } from '@/lib/session';

export async function generateMetadata() {
  const t = await getTranslations('requests');
  return { title: t('newTitle') };
}

export default async function NewRequestPage({ params, searchParams }: { params: Promise<{ org: string }>; searchParams: Promise<{ client?: string }> }) {
  const { org } = await params;
  const sp = await searchParams;
  const actor = await requireActor(org);
  if (!canOrg(actor.role, 'requests.triage')) notFound();
  const t = await getTranslations('requests');
  const [forms, clients, projects] = await Promise.all([listForms(actor), listClientOptions(actor), listProjects(actor, { status: 'active' })]);
  return (
    <div className="mx-auto max-w-[760px] px-4 py-8 sm:px-6">
      <Link href={`/${org}/requests`} className="inline-flex items-center gap-1 text-[13px] text-ink-3 hover:text-ink">
        <ChevronLeft className="size-4" aria-hidden /> {t('backToRequests')}
      </Link>
      <PageHeader className="mt-3" title={t('newTitle')} description={t('newDescription')} />
      <NewRequestForm
        org={org}
        forms={forms.map((f) => ({ id: f.id, name: f.name, description: f.description, fields: f.fields }))}
        clients={clients}
        projects={projects.map((p) => ({ id: p.id, key: p.key, name: p.name, clientAccountId: p.clientAccountId }))}
        defaultClientId={clients.some((c) => c.id === sp.client) ? sp.client : undefined}
      />
    </div>
  );
}
