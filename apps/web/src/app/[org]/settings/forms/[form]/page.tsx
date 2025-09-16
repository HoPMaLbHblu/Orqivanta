import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { ArrowLeft } from 'lucide-react';
import { listForms, listPeople } from '@orqivanta/core';
import { FormBuilder, type BuilderField } from '@/components/settings/form-builder';
import { requireActor } from '@/lib/session';

export async function generateMetadata({ params }: { params: Promise<{ form: string }> }) {
  const { form } = await params;
  const t = await getTranslations('settings.forms');
  return { title: form === 'new' ? t('newForm') : t('title') };
}

export default async function FormEditor({ params }: { params: Promise<{ org: string; form: string }> }) {
  const { org, form: formId } = await params;
  const actor = await requireActor(org);
  const t = await getTranslations('settings.forms');
  const [forms, people] = await Promise.all([listForms(actor, { includeInactive: true }), listPeople(actor)]);
  const isNew = formId === 'new';
  const existing = forms.find((f) => f.id === formId);
  if (!isNew && !existing) notFound();

  const draft = existing
    ? { id: existing.id, name: existing.name, description: existing.description, audience: existing.audience, active: existing.active, defaultOwnerId: existing.defaultOwnerId, fields: existing.fields as BuilderField[] }
    : { name: '', description: null, audience: 'both' as const, active: true, defaultOwnerId: null, fields: [] };

  return (
    <div className="flex flex-col gap-4">
      <Link href={`/${org}/settings/forms`} className="inline-flex w-fit items-center gap-1 text-[13px] text-ink-3 hover:text-ink">
        <ArrowLeft className="size-3.5" aria-hidden /> {t('backToForms')}
      </Link>
      <FormBuilder org={org} form={draft} people={people.filter((p) => p.role !== 'client').map((p) => ({ id: p.id, name: p.name }))} />
    </div>
  );
}
