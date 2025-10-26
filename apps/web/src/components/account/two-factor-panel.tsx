'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Copy, Download, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import {
  beginTwoFactorAction,
  confirmTwoFactorAction,
  disableTwoFactorAction,
  regenerateRecoveryCodesAction,
} from '@/actions/account';
import { Badge } from '@/components/domain/badges';
import { FormattedDate } from '@/components/domain/dates';
import { SettingsSection } from '@/components/settings/settings-nav';
import { Button } from '@/components/ui/button';
import { Field, FormError } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Notice } from '@/components/ui/primitives';
import { useAction } from '@/lib/use-action';

export interface TwoFactorState {
  enabled: boolean;
  enabledAt: string | null;
  recoveryCodesLeft: number;
}

type Mode = { kind: 'idle' } | { kind: 'setup'; secret: string; qrSvg: string } | { kind: 'codes'; codes: string[] } | { kind: 'password'; purpose: 'disable' | 'regenerate' };

export function TwoFactorPanel({ state, isDemo }: { state: TwoFactorState; isDemo: boolean }) {
  const t = useTranslations('account.twoFactor');
  const router = useRouter();
  const { call, pending, fieldErrors, formError } = useAction();
  const [mode, setMode] = useState<Mode>({ kind: 'idle' });
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');

  async function start() {
    const res = await call(() => beginTwoFactorAction(), { refresh: false });
    if (res.ok) {
      setCode('');
      setMode({ kind: 'setup', ...res.data });
    }
  }

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    const res = await call(() => confirmTwoFactorAction({ code }), { inlineFieldErrors: true, refresh: false });
    if (res.ok) setMode({ kind: 'codes', codes: res.data.recoveryCodes });
  }

  async function withPassword(e: React.FormEvent, purpose: 'disable' | 'regenerate') {
    e.preventDefault();
    if (purpose === 'disable') {
      const res = await call(() => disableTwoFactorAction({ password }), { inlineFieldErrors: true, success: t('turnedOff') });
      if (res.ok) {
        setPassword('');
        setMode({ kind: 'idle' });
      }
    } else {
      const res = await call(() => regenerateRecoveryCodesAction({ password }), { inlineFieldErrors: true, refresh: false });
      if (res.ok) {
        setPassword('');
        setMode({ kind: 'codes', codes: res.data.recoveryCodes });
      }
    }
  }

  function finish() {
    setMode({ kind: 'idle' });
    router.refresh();
  }

  const status = state.enabled ? <Badge tone="success">{t('on')}</Badge> : <Badge tone="neutral">{t('off')}</Badge>;

  return (
    <SettingsSection title={t('title')} description={t('description')} action={status}>
      <div className="flex max-w-xl flex-col gap-4 p-4">
        {mode.kind === 'idle' && !state.enabled ? (
          <>
            {isDemo ? <Notice tone="attention">{t('demoNotice')}</Notice> : null}
            <p className="text-[13px] text-ink-2">{t('offBody')}</p>
            <div>
              <Button variant="primary" onClick={start} loading={pending} disabled={isDemo}>
                {t('setUp')}
              </Button>
            </div>
            <FormError message={formError} />
          </>
        ) : null}

        {mode.kind === 'setup' ? (
          <form onSubmit={confirm} className="flex flex-col gap-4" noValidate>
            <ol className="flex list-decimal flex-col gap-1 pl-5 text-[13px] text-ink-2">
              <li>{t('step1')}</li>
              <li>{t('step2')}</li>
            </ol>
            <div className="flex flex-wrap items-start gap-5">
              <div
                role="img"
                aria-label={t('qrLabel')}
                className="size-40 shrink-0 rounded-md border border-line bg-white p-2 [&_svg]:size-full"
                dangerouslySetInnerHTML={{ __html: mode.qrSvg }}
              />
              <div className="min-w-0 flex-1 text-[13px]">
                <p className="text-ink-3">{t('manual')}</p>
                <code className="mt-1 block break-all rounded-md bg-surface-2 px-2 py-1.5 font-mono text-[12px] text-ink">{mode.secret.replace(/(.{4})/g, '$1 ').trim()}</code>
              </div>
            </div>
            <FormError message={formError} />
            <Field label={t('codeLabel')} error={fieldErrors.code}>
              <Input
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="max-w-[12rem] font-mono tracking-widest"
                maxLength={7}
                autoFocus
              />
            </Field>
            <div className="flex gap-2">
              <Button type="submit" variant="primary" loading={pending} disabled={code.replace(/\s/g, '').length !== 6}>
                {t('verify')}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setMode({ kind: 'idle' })}>
                {t('cancel')}
              </Button>
            </div>
          </form>
        ) : null}

        {mode.kind === 'codes' ? <RecoveryCodes codes={mode.codes} onDone={finish} /> : null}

        {mode.kind === 'idle' && state.enabled ? (
          <>
            <p className="flex items-center gap-2 text-[13px] text-ink-2">
              <ShieldCheck className="size-4 text-success" aria-hidden />
              <span>
                {state.enabledAt ? t.rich('onSince', { date: () => <FormattedDate date={state.enabledAt!} /> }) : t('onBody')}
              </span>
            </p>
            <p className="text-[13px] text-ink-3">{t('codesLeft', { count: state.recoveryCodesLeft })}</p>
            {state.recoveryCodesLeft <= 2 ? <Notice tone="attention">{t('codesLow')}</Notice> : null}
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setMode({ kind: 'password', purpose: 'regenerate' })}>{t('newCodes')}</Button>
              <Button variant="danger" onClick={() => setMode({ kind: 'password', purpose: 'disable' })}>
                {t('turnOff')}
              </Button>
            </div>
          </>
        ) : null}

        {mode.kind === 'password' ? (
          <form onSubmit={(e) => withPassword(e, mode.purpose)} className="flex flex-col gap-4" noValidate>
            <p className="text-[13px] text-ink-2">{mode.purpose === 'disable' ? t('disableBody') : t('regenerateBody')}</p>
            <FormError message={formError} />
            <Field label={t('password')} error={fieldErrors.password}>
              <Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="max-w-sm" autoFocus />
            </Field>
            <div className="flex gap-2">
              <Button type="submit" variant={mode.purpose === 'disable' ? 'danger' : 'primary'} loading={pending} disabled={!password}>
                {mode.purpose === 'disable' ? t('turnOff') : t('newCodes')}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setMode({ kind: 'idle' })}>
                {t('cancel')}
              </Button>
            </div>
          </form>
        ) : null}
      </div>
    </SettingsSection>
  );
}

function RecoveryCodes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const t = useTranslations('account.twoFactor');
  const text = codes.join('\n');
  return (
    <div className="flex flex-col gap-4">
      <Notice tone="attention">{t('codesOnce')}</Notice>
      <ul aria-label={t('codesTitle')} className="grid max-w-sm grid-cols-2 gap-x-6 gap-y-1 rounded-md border border-line bg-surface-2 px-4 py-3 font-mono text-[13px] text-ink">
        {codes.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text);
              toast.success(t('copied'));
            } catch {
              toast.error(t('copyFailed'));
            }
          }}
        >
          <Copy className="size-4" aria-hidden />
          {t('copy')}
        </Button>
        <Button asChild>
          <a href={`data:text/plain;charset=utf-8,${encodeURIComponent(`Orqivanta recovery codes\n\n${text}\n`)}`} download="orqivanta-recovery-codes.txt">
            <Download className="size-4" aria-hidden />
            {t('download')}
          </a>
        </Button>
        <Button variant="primary" onClick={onDone}>
          {t('saved')}
        </Button>
      </div>
    </div>
  );
}
