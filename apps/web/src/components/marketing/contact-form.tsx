'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { CheckCircle2, Send } from 'lucide-react';
import { submitContactAction } from '@/actions/contact';
import { Button } from '@/components/ui/button';
import { Field, FormError } from '@/components/ui/field';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { useAction } from '@/lib/use-action';

const TOPICS = ['general', 'demo', 'feedback', 'accessibility', 'privacy'] as const;

/** Public contact form. Validation, the honeypot and rate limits are enforced in core. */
export function ContactForm() {
  const t = useTranslations('marketing.contact');
  const tc = useTranslations('common');
  const { call, pending, fieldErrors, formError } = useAction();
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form)) as Record<string, string>;
    const res = await call(() => submitContactAction(data), { inlineFieldErrors: true, refresh: false });
    if (res.ok) {
      setSentTo(data.email ?? '');
      form.reset();
    }
  }

  if (sentTo) {
    return (
      <div className="rounded-xl border border-line bg-surface p-7">
        <CheckCircle2 className="size-6 text-success" aria-hidden />
        <h2 className="mt-4 font-serif text-[26px] leading-tight text-ink">{t('sentTitle')}</h2>
        <p className="mt-2 text-[14.5px] leading-[1.65] text-ink-2">{t('sentBody', { email: sentTo })}</p>
        <Button className="mt-6" onClick={() => setSentTo(null)}>
          {t('sendAnother')}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="rounded-xl border border-line bg-surface p-6 sm:p-7">
      <h2 className="font-serif text-[26px] leading-tight text-ink">{t('formTitle')}</h2>
      <div className="mt-6 flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('name')} error={fieldErrors.name}>
            <Input name="name" autoComplete="name" required maxLength={120} />
          </Field>
          <Field label={t('email')} error={fieldErrors.email}>
            <Input name="email" type="email" autoComplete="email" required maxLength={254} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('company')} optional={tc('optional')} error={fieldErrors.company}>
            <Input name="company" autoComplete="organization" maxLength={160} />
          </Field>
          <Field label={t('topic')} error={fieldErrors.topic}>
            <NativeSelect name="topic" defaultValue="general">
              {TOPICS.map((v) => (
                <option key={v} value={v}>
                  {t(`topics.${v}`)}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>
        <Field label={t('message')} hint={t('messageHint')} error={fieldErrors.message}>
          <Textarea name="message" required rows={6} maxLength={5000} className="min-h-36" />
        </Field>
        {/* Honeypot: hidden from people, tempting to bots. Never shown, never required. */}
        <div aria-hidden className="absolute h-0 w-0 overflow-hidden opacity-0">
          <label htmlFor="contact-website">{t('website')}</label>
          <input id="contact-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
        </div>
        <FormError message={formError} />
        <div>
          <Button type="submit" variant="primary" size="lg" loading={pending}>
            {pending ? null : <Send />}
            {t('send')}
          </Button>
        </div>
      </div>
    </form>
  );
}
