'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Send } from 'lucide-react';
import { submitPortalRequestAction } from '@/actions/portal';
import { FileUploader } from '@/components/files/uploader';
import { Button } from '@/components/ui/button';
import { Field, FormError } from '@/components/ui/field';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { useAction } from '@/lib/use-action';

export interface PortalFormField {
  key: string;
  label: string;
  type: 'short_text' | 'long_text' | 'select' | 'date' | 'url' | 'number';
  required: boolean;
  options?: string[];
  help?: string;
}

export interface PortalForm {
  id: string;
  name: string;
  description: string | null;
  fields: PortalFormField[];
}

export interface PortalFormProject {
  id: string;
  name: string;
}

/**
 * The client-facing intake form. Fields come from the org's request form, so the portal
 * never invents questions; validation is the server's, shown inline per field.
 */
export function RequestForm({ org, forms, projects, cancelHref }: { org: string; forms: PortalForm[]; projects: PortalFormProject[]; cancelHref: string }) {
  const t = useTranslations('portal.requests');
  const tc = useTranslations('common');
  const router = useRouter();
  const { call, pending, fieldErrors, formError } = useAction();
  const [formId, setFormId] = useState(forms[0]!.id);
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [projectId, setProjectId] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [created, setCreated] = useState<{ id: string; number: number } | null>(null);

  const form = forms.find((f) => f.id === formId) ?? forms[0]!;
  const setAnswer = (key: string, value: string) => setAnswers((a) => ({ ...a, [key]: value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await call(
      () =>
        submitPortalRequestAction(org, {
          formId: form.id,
          title,
          details,
          answers: Object.fromEntries(form.fields.map((f) => [f.key, answers[f.key] ?? ''])),
          projectId: projectId || null,
        }),
      { inlineFieldErrors: true, success: t('submitted_toast'), refresh: false },
    );
    if (res.ok) setCreated(res.data);
  }

  // Once the request exists, attachments can be uploaded against it, then the client opens it.
  if (created) {
    return (
      <div className="flex flex-col gap-6">
        <div className="rounded-xl border border-success/25 bg-success-soft px-5 py-4 text-[14px] text-ink">
          <p className="font-medium">{t('submitted_toast')}</p>
          <p className="mt-1 text-[13px] text-ink-2">#{created.number}</p>
        </div>
        <div>
          <h2 className="text-[15px] font-semibold text-ink">{t('attachments')}</h2>
          <p className="mt-1 text-[13px] text-ink-3">{t('attachHint')}</p>
          <FileUploader className="mt-3" endpoint={`/api/orgs/${org}/files`} meta={{ requestId: created.id }} label={t('attach')} />
        </div>
        <div className="flex gap-2">
          <Button variant="primary" onClick={() => router.push(`/portal/${org}/requests/${created.number}`)}>
            {tc('done')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <FormError message={formError} />
      {forms.length > 1 ? (
        <Field label={t('form')} error={fieldErrors.formId}>
          <NativeSelect value={formId} onChange={(e) => setFormId(e.target.value)}>
            {forms.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
      ) : null}
      {form.description ? <p className="text-[13px] text-ink-2">{form.description}</p> : null}

      <Field label={t('fieldTitle')} hint={t('fieldTitleHint')} error={fieldErrors.title}>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required autoFocus />
      </Field>

      {form.fields.map((f) => {
        const error = fieldErrors[`answers.${f.key}`];
        const value = answers[f.key] ?? '';
        return (
          <Field key={f.key} label={f.label} hint={f.help} optional={f.required ? undefined : tc('optional')} error={error}>
            {f.type === 'long_text' ? (
              <Textarea value={value} onChange={(e) => setAnswer(f.key, e.target.value)} maxLength={5000} required={f.required} />
            ) : f.type === 'select' ? (
              <NativeSelect value={value} onChange={(e) => setAnswer(f.key, e.target.value)} required={f.required}>
                <option value="">{t('choose')}</option>
                {(f.options ?? []).map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </NativeSelect>
            ) : (
              <Input
                type={f.type === 'date' ? 'date' : f.type === 'number' ? 'number' : f.type === 'url' ? 'url' : 'text'}
                value={value}
                onChange={(e) => setAnswer(f.key, e.target.value)}
                required={f.required}
                maxLength={f.type === 'short_text' ? 200 : undefined}
                placeholder={f.type === 'url' ? 'https://' : undefined}
              />
            )}
          </Field>
        );
      })}

      <Field label={t('fieldDetails')} hint={t('fieldDetailsHint')} error={fieldErrors.details}>
        <Textarea value={details} onChange={(e) => setDetails(e.target.value)} maxLength={10000} className="min-h-32" />
      </Field>

      {projects.length ? (
        <Field label={t('fieldProject')} optional={tc('optional')} error={fieldErrors.projectId}>
          <NativeSelect value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">{t('noProject')}</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button type="submit" variant="primary" loading={pending}>
          <Send /> {t('submit')}
        </Button>
        <Button variant="ghost" onClick={() => router.push(cancelHref)}>
          {tc('cancel')}
        </Button>
      </div>
    </form>
  );
}
