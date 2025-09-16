'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { FileQuestion } from 'lucide-react';
import { submitRequestAction } from '@/actions/requests';
import { Button } from '@/components/ui/button';
import { Field, FormError } from '@/components/ui/field';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { Card, EmptyState } from '@/components/ui/primitives';
import { useAction } from '@/lib/use-action';
import { RequestFormFields, type AnswerValues, type RequestFormField } from './form-fields';

const PRIORITIES = ['none', 'low', 'medium', 'high', 'urgent'] as const;

/** Files a request on behalf of a client (or an internal request with no client). */
export function NewRequestForm({ org, forms, clients, projects, defaultClientId }: { org: string; forms: { id: string; name: string; description: string | null; fields: RequestFormField[] }[]; clients: { id: string; name: string }[]; projects: { id: string; key: string; name: string; clientAccountId: string | null }[]; defaultClientId?: string }) {
  const t = useTranslations('requests');
  const te = useTranslations('enums.priority');
  const router = useRouter();
  const { call, pending, fieldErrors, formError } = useAction();
  const [formId, setFormId] = useState(forms[0]?.id ?? '');
  const [clientId, setClientId] = useState(defaultClientId ?? '');
  const [projectId, setProjectId] = useState('');
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [priority, setPriority] = useState<(typeof PRIORITIES)[number]>('none');
  const [answers, setAnswers] = useState<AnswerValues>({});
  const form = forms.find((f) => f.id === formId);
  const projectOptions = useMemo(() => projects.filter((p) => !clientId || !p.clientAccountId || p.clientAccountId === clientId), [projects, clientId]);

  if (!forms.length) {
    return (
      <Card className="mt-6">
        <EmptyState icon={<FileQuestion />} title={t('noForms')} description={t('noFormsHint')} />
      </Card>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await call(
      () => submitRequestAction(org, { formId, title, details, answers, clientAccountId: clientId || null, projectId: projectId || null, priority }),
      { success: t('submitted'), inlineFieldErrors: true, refresh: false },
    );
    if (res.ok) router.push(`/${org}/requests/${res.data.number}`);
  };

  return (
    <form onSubmit={submit} className="mt-6 flex flex-col gap-5" noValidate>
      <Card className="flex flex-col gap-4 p-4 sm:p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('fields.client')} hint={t('fields.clientHint')} error={fieldErrors.clientAccountId}>
            <NativeSelect value={clientId} onChange={(e) => { setClientId(e.target.value); setProjectId(''); }}>
              <option value="">{t('fields.noClient')}</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label={t('fields.project')} optional={t('form.optional')} error={fieldErrors.projectId}>
            <NativeSelect value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">{t('fields.noProject')}</option>
              {projectOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.key} · {p.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>
        {forms.length > 1 ? (
          <Field label={t('fields.form')} hint={form?.description ?? undefined} error={fieldErrors.formId}>
            <NativeSelect value={formId} onChange={(e) => { setFormId(e.target.value); setAnswers({}); }}>
              {forms.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
        ) : (
          <p className="text-[12px] text-ink-3">{t('usingForm', { name: form?.name ?? '' })}</p>
        )}
      </Card>

      <Card className="flex flex-col gap-4 p-4 sm:p-5">
        <Field label={t('fields.title')} error={fieldErrors.title}>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required autoFocus />
        </Field>
        <Field label={t('fields.details')} optional={t('form.optional')} hint={t('fields.detailsHint')} error={fieldErrors.details}>
          <Textarea value={details} onChange={(e) => setDetails(e.target.value)} maxLength={10000} rows={5} />
        </Field>
        {form ? <RequestFormFields fields={form.fields} values={answers} onChange={(k, v) => setAnswers((a) => ({ ...a, [k]: v }))} errors={fieldErrors} /> : null}
        <Field label={t('fields.priority')} hint={t('fields.priorityHint')} className="sm:w-56">
          <NativeSelect value={priority} onChange={(e) => setPriority(e.target.value as (typeof PRIORITIES)[number])}>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {te(p)}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </Card>

      <FormError message={formError ?? (fieldErrors._form || null)} />
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" onClick={() => router.push(`/${org}/requests`)}>
          {t('cancel')}
        </Button>
        <Button type="submit" variant="primary" loading={pending}>
          {t('submit')}
        </Button>
      </div>
    </form>
  );
}
