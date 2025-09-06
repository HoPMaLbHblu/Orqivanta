'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { MailCheck } from 'lucide-react';
import { forgotPasswordAction, resendVerificationAction, resetPasswordAction, signInAction, signUpAction, verifyEmailAction } from '@/actions/auth';
import { Button } from '@/components/ui/button';
import { Field, FormError } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Notice } from '@/components/ui/primitives';
import { useAction } from '@/lib/use-action';

export function AuthHeading({ title, subtitle }: { title: string; subtitle?: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h1 className="font-serif text-[34px] leading-tight text-ink">{title}</h1>
      {subtitle ? <p className="mt-2 text-[14px] text-ink-2">{subtitle}</p> : null}
    </div>
  );
}

function CheckInbox({ email, title, body }: { email: string; title: string; body: string }) {
  const t = useTranslations('auth');
  const { call, pending } = useAction();
  const [sent, setSent] = useState(false);
  return (
    <div>
      <div className="mb-6 flex size-11 items-center justify-center rounded-full bg-accent-soft text-accent">
        <MailCheck className="size-5" />
      </div>
      <AuthHeading title={title} subtitle={body.replace('{email}', email)} />
      <Notice tone="neutral">{t('devMailboxHint')} <Link href="/dev/mailbox" className="font-medium text-accent underline underline-offset-2">{t('devMailbox')}</Link></Notice>
      <div className="mt-6 flex items-center gap-3 text-[13px] text-ink-2">
        <span>{t('noEmail')}</span>
        <Button
          variant="link"
          loading={pending}
          disabled={sent}
          onClick={async () => {
            const res = await call(() => resendVerificationAction(email), { refresh: false });
            if (res.ok) setSent(true);
          }}
        >
          {sent ? t('resent') : t('resend')}
        </Button>
      </div>
    </div>
  );
}

export function SignInForm({ next, initialEmail }: { next?: string; initialEmail?: string }) {
  const t = useTranslations('auth');
  const router = useRouter();
  const { call, pending, fieldErrors, formError } = useAction();
  const [email, setEmail] = useState(initialEmail ?? '');
  const [password, setPassword] = useState('');
  const [unverified, setUnverified] = useState<string | null>(null);

  if (unverified) return <CheckInbox email={unverified} title={t('verify.title')} body={t('verify.unverifiedBody')} />;

  return (
    <form
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        const res = await call(() => signInAction({ email, password, next }), { refresh: false, inlineFieldErrors: true });
        if (!res.ok) return;
        if (res.data.status === 'unverified') setUnverified(res.data.email);
        else {
          router.push(res.data.to);
          router.refresh();
        }
      }}
      className="flex flex-col gap-4"
    >
      <FormError message={formError} />
      <Field label={t('email')} error={fieldErrors.email}>
        <Input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
      </Field>
      <Field label={t('password')} error={fieldErrors.password}>
        <Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </Field>
      <div className="-mt-1 text-right">
        <Link href="/forgot-password" className="text-[13px] text-accent hover:underline">
          {t('forgot')}
        </Link>
      </div>
      <Button type="submit" variant="primary" size="lg" loading={pending}>
        {t('signIn')}
      </Button>
    </form>
  );
}

export function SignUpForm({ next, initialEmail, lockedEmail }: { next?: string; initialEmail?: string; lockedEmail?: boolean }) {
  const t = useTranslations('auth');
  const { call, pending, fieldErrors, formError } = useAction();
  const [name, setName] = useState('');
  const [email, setEmail] = useState(initialEmail ?? '');
  const [password, setPassword] = useState('');
  const [done, setDone] = useState<string | null>(null);

  if (done) return <CheckInbox email={done} title={t('verify.title')} body={t('verify.sentBody')} />;

  return (
    <form
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const res = await call(() => signUpAction({ name, email, password, next, timeZone }), { refresh: false, inlineFieldErrors: true });
        if (res.ok) setDone(res.data.email);
      }}
      className="flex flex-col gap-4"
    >
      <FormError message={formError} />
      <Field label={t('name')} error={fieldErrors.name}>
        <Input autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
      </Field>
      <Field label={t('workEmail')} error={fieldErrors.email} hint={lockedEmail ? t('inviteEmailHint') : undefined}>
        <Input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} readOnly={lockedEmail} required />
      </Field>
      <Field label={t('password')} error={fieldErrors.password} hint={t('passwordHint')}>
        <Input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={10} />
      </Field>
      <Button type="submit" variant="primary" size="lg" loading={pending}>
        {t('createAccount')}
      </Button>
      <p className="text-[12px] text-ink-3">
        {t.rich('agree', {
          terms: (c) => <Link href="/legal/terms" className="underline underline-offset-2">{c}</Link>,
          privacy: (c) => <Link href="/legal/privacy" className="underline underline-offset-2">{c}</Link>,
        })}
      </p>
    </form>
  );
}

export function VerifyEmail({ token, next }: { token: string; next?: string }) {
  const t = useTranslations('auth');
  const router = useRouter();
  const { call, pending } = useAction();
  const [error, setError] = useState<string | null>(null);
  // Verification is a button press, not a page load, so link scanners in mail clients can't consume the token.
  return (
    <div>
      <AuthHeading title={t('verify.confirmTitle')} subtitle={t('verify.confirmBody')} />
      <FormError message={error} />
      <Button
        variant="primary"
        size="lg"
        className="mt-4 w-full justify-center"
        loading={pending}
        onClick={async () => {
          const res = await call(() => verifyEmailAction(token, next), { refresh: false, inlineFieldErrors: true });
          if (res.ok) {
            router.push(res.data.to);
            router.refresh();
          } else setError(res.error.message);
        }}
      >
        {t('verify.confirmButton')}
      </Button>
      {error ? (
        <p className="mt-4 text-[13px] text-ink-2">
          {t('verify.expiredHelp')} <Link href="/sign-in" className="text-accent underline underline-offset-2">{t('signIn')}</Link>
        </p>
      ) : null}
    </div>
  );
}

export function ForgotPasswordForm() {
  const t = useTranslations('auth');
  const { call, pending, fieldErrors, formError } = useAction();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  if (sent)
    return (
      <div>
        <AuthHeading title={t('forgotSent.title')} subtitle={t('forgotSent.body', { email })} />
        <Notice tone="neutral">{t('devMailboxHint')} <Link href="/dev/mailbox" className="font-medium text-accent underline underline-offset-2">{t('devMailbox')}</Link></Notice>
      </div>
    );
  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const res = await call(() => forgotPasswordAction(email), { refresh: false, inlineFieldErrors: true });
        if (res.ok) setSent(true);
      }}
    >
      <FormError message={formError} />
      <Field label={t('email')} error={fieldErrors.email}>
        <Input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
      </Field>
      <Button type="submit" variant="primary" size="lg" loading={pending}>
        {t('sendResetLink')}
      </Button>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const t = useTranslations('auth');
  const router = useRouter();
  const { call, pending, fieldErrors, formError, setFieldErrors } = useAction();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (password !== confirm) {
          setFieldErrors({ confirm: t('passwordsDontMatch') });
          return;
        }
        const res = await call(() => resetPasswordAction({ token, password }), { refresh: false, inlineFieldErrors: true, success: t('passwordChanged') });
        if (res.ok) {
          router.push(res.data.to);
          router.refresh();
        }
      }}
    >
      <FormError message={formError} />
      <Field label={t('newPassword')} error={fieldErrors.password} hint={t('passwordHint')}>
        <Input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required autoFocus />
      </Field>
      <Field label={t('confirmPassword')} error={fieldErrors.confirm}>
        <Input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
      </Field>
      <Button type="submit" variant="primary" size="lg" loading={pending}>
        {t('setPassword')}
      </Button>
    </form>
  );
}

/** Keeps the browser's time zone handy for the profile form. */
export function useBrowserTimeZone() {
  const [tz, setTz] = useState('UTC');
  useEffect(() => setTz(Intl.DateTimeFormat().resolvedOptions().timeZone), []);
  return tz;
}
