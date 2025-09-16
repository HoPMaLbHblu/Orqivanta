'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowRight, Check, CircleDashed, Users } from 'lucide-react';
import { createFirstProjectAction, createOrganizationAction, completeOnboardingStepAction, inviteTeammatesAction } from '@/actions/onboarding';
import { SlugField, slugify } from '@/components/settings/slug-field';
import { Button } from '@/components/ui/button';
import { Field, FormError } from '@/components/ui/field';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { useAction } from '@/lib/use-action';
import { cn } from '@/lib/cn';
import { ONBOARDING_STEPS, STEP_FLAG, suggestKey, type OnboardingStep } from './steps';

export interface WizardProps {
  step: OnboardingStep;
  org: string | null;
  orgName: string | null;
  done: string[];
  purposes: { id: string; label: string }[];
  templates: { id: string; name: string; description: string }[];
}

export function Checklist({ step, done }: { step: OnboardingStep; done: string[] }) {
  const t = useTranslations('onboarding');
  return (
    <ol className="flex flex-col gap-1" aria-label={t('checklist')}>
      {ONBOARDING_STEPS.map((s, i) => {
        const flag = STEP_FLAG[s];
        const complete = s === 'organization' ? step !== 'organization' : flag ? done.includes(flag) : false;
        const current = s === step;
        return (
          <li key={s} className={cn('flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px]', current ? 'bg-surface-2 font-medium text-ink' : 'text-ink-2')} aria-current={current ? 'step' : undefined}>
            {complete ? <Check className="size-4 text-success" aria-hidden /> : <CircleDashed className={cn('size-4', current ? 'text-accent' : 'text-ink-3')} aria-hidden />}
            <span>
              {i + 1}. {t(`step.${s}.name`)}
            </span>
            {complete ? <span className="sr-only">{t('completed')}</span> : null}
          </li>
        );
      })}
    </ol>
  );
}

export function Wizard(props: WizardProps) {
  switch (props.step) {
    case 'organization':
      return <OrganizationStep purposes={props.purposes} />;
    case 'template':
      return <TemplateStep org={props.org!} templates={props.templates} />;
    case 'teammates':
      return <TeammatesStep org={props.org!} />;
    case 'project':
      return <ProjectStep org={props.org!} orgName={props.orgName ?? ''} templates={props.templates} />;
  }
}

function StepShell({ step, children }: { step: OnboardingStep; children: React.ReactNode }) {
  const t = useTranslations('onboarding');
  return (
    <div>
      <h2 className="font-serif text-[28px] leading-tight text-ink">{t(`step.${step}.title`)}</h2>
      <p className="mt-1 max-w-xl text-[14px] text-ink-2">{t(`step.${step}.body`)}</p>
      <div className="mt-6">{children}</div>
    </div>
  );
}

function OrganizationStep({ purposes }: { purposes: { id: string; label: string }[] }) {
  const t = useTranslations('onboarding');
  const router = useRouter();
  const { call, pending, fieldErrors, formError } = useAction();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [touchedSlug, setTouchedSlug] = useState(false);
  const [purpose, setPurpose] = useState('');
  const [slugOk, setSlugOk] = useState<boolean | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await call(() => createOrganizationAction({ name, slug, purpose: purpose || undefined }), { inlineFieldErrors: true, refresh: false });
    if (res.ok) router.replace(`/onboarding?org=${res.data.slug}&step=template`);
  }

  return (
    <StepShell step="organization">
      <form onSubmit={submit} className="flex max-w-md flex-col gap-4" noValidate>
        <FormError message={formError} />
        <Field label={t('orgName')} error={fieldErrors.name}>
          <Input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!touchedSlug) setSlug(slugify(e.target.value));
            }}
            maxLength={60}
            autoFocus
            required
          />
        </Field>
        <SlugField
          value={slug}
          onChange={(v) => {
            setTouchedSlug(true);
            setSlug(v);
          }}
          error={fieldErrors.slug}
          onAvailability={setSlugOk}
        />
        <Field label={t('purpose')} optional={t('optional')} error={fieldErrors.purpose}>
          <NativeSelect value={purpose} onChange={(e) => setPurpose(e.target.value)}>
            <option value="">{t('purposeChoose')}</option>
            {purposes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <div>
          <Button type="submit" variant="primary" size="lg" loading={pending} disabled={!name.trim() || !slug || slugOk === false}>
            {t('createWorkspace')} <ArrowRight />
          </Button>
        </div>
      </form>
    </StepShell>
  );
}

function TemplateStep({ org, templates }: { org: string; templates: { id: string; name: string; description: string }[] }) {
  const t = useTranslations('onboarding');
  const router = useRouter();
  const { call, pending } = useAction();
  const [choice, setChoice] = useState(templates[1]?.id ?? 'blank');

  async function next() {
    await call(() => completeOnboardingStepAction(org, 'template'), { refresh: false });
    router.push(`/onboarding?org=${org}&step=teammates&template=${choice}`);
  }

  return (
    <StepShell step="template">
      <fieldset className="flex flex-col gap-2">
        <legend className="sr-only">{t('step.template.name')}</legend>
        {templates.map((tpl) => (
          <label key={tpl.id} className={cn('flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors', choice === tpl.id ? 'border-accent bg-accent-soft/40' : 'border-line bg-surface hover:border-line-strong')}>
            <input type="radio" name="template" value={tpl.id} checked={choice === tpl.id} onChange={() => setChoice(tpl.id)} className="mt-1 size-4 accent-[var(--accent)]" />
            <span className="min-w-0">
              <span className="block text-[14px] font-medium text-ink">{tpl.name}</span>
              <span className="block text-[13px] text-ink-2">{tpl.description}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <div className="mt-5 flex items-center gap-3">
        <Button variant="primary" size="lg" loading={pending} onClick={next}>
          {t('continue')} <ArrowRight />
        </Button>
      </div>
    </StepShell>
  );
}

function TeammatesStep({ org }: { org: string }) {
  const t = useTranslations('onboarding');
  const router = useRouter();
  const { call, pending, fieldErrors, formError } = useAction();
  const [emails, setEmails] = useState('');
  const [role, setRole] = useState('member');
  const list = emails.split(/[\s,;]+/).map((e) => e.trim()).filter(Boolean);
  const nextHref = (search: string) => `/onboarding?org=${org}&step=project${search}`;
  const template = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('template') : null;
  const suffix = template ? `&template=${template}` : '';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await call(() => inviteTeammatesAction(org, { emails: list, role: role as 'admin' | 'member' }), { success: t('invited', { count: list.length }), inlineFieldErrors: true, refresh: false });
    if (res.ok) router.push(nextHref(suffix));
  }

  return (
    <StepShell step="teammates">
      <form onSubmit={submit} className="flex max-w-md flex-col gap-4" noValidate>
        <FormError message={formError} />
        <Field label={t('emails')} hint={t('emailsHint')} error={fieldErrors.emails ?? fieldErrors['emails.0']}>
          <Textarea value={emails} onChange={(e) => setEmails(e.target.value)} rows={3} spellCheck={false} placeholder="alex@studio.example, sam@studio.example" />
        </Field>
        <Field label={t('role')} error={fieldErrors.role}>
          <NativeSelect value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="member">{t('roleMember')}</option>
            <option value="admin">{t('roleAdmin')}</option>
          </NativeSelect>
        </Field>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" variant="primary" size="lg" loading={pending} disabled={!list.length}>
            <Users /> {t('sendInvites', { count: list.length })}
          </Button>
          <Button variant="ghost" type="button" onClick={() => router.push(nextHref(suffix))}>
            {t('skipForNow')}
          </Button>
        </div>
      </form>
    </StepShell>
  );
}

function ProjectStep({ org, orgName, templates }: { org: string; orgName: string; templates: { id: string; name: string; description: string }[] }) {
  const t = useTranslations('onboarding');
  const { call, pending, fieldErrors, formError } = useAction();
  const initialTemplate = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('template') : null;
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [touchedKey, setTouchedKey] = useState(false);
  const [templateId, setTemplateId] = useState(templates.find((x) => x.id === initialTemplate)?.id ?? 'blank');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await call(() => createFirstProjectAction(org, { name, key, templateId }), { inlineFieldErrors: true, refresh: false });
    if (res.ok) window.location.href = `/${org}/projects/${res.data.key}`;
  }

  return (
    <StepShell step="project">
      <form onSubmit={submit} className="flex max-w-md flex-col gap-4" noValidate>
        <FormError message={formError} />
        <Field label={t('projectName')} error={fieldErrors.name}>
          <Input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!touchedKey) setKey(suggestKey(e.target.value));
            }}
            maxLength={80}
            autoFocus
            required
            placeholder={t('projectPlaceholder', { org: orgName })}
          />
        </Field>
        <Field label={t('projectKey')} hint={t('projectKeyHint')} error={fieldErrors.key}>
          <Input
            value={key}
            onChange={(e) => {
              setTouchedKey(true);
              setKey(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6));
            }}
            className="w-32 font-mono"
            required
          />
        </Field>
        <Field label={t('template')} error={fieldErrors.templateId}>
          <NativeSelect value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
            {templates.map((tpl) => (
              <option key={tpl.id} value={tpl.id}>
                {tpl.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" variant="primary" size="lg" loading={pending} disabled={!name.trim() || key.length < 2}>
            {t('createProject')} <ArrowRight />
          </Button>
          <a href={`/${org}`} className="text-[13px] font-medium text-ink-2 hover:text-ink hover:underline">
            {t('finishLater')}
          </a>
        </div>
      </form>
    </StepShell>
  );
}
