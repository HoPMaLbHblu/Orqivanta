'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Laptop, LogOut, Smartphone } from 'lucide-react';
import { changePasswordAction, revokeOtherSessionsAction, revokeSessionAction } from '@/actions/account';
import { Badge } from '@/components/domain/badges';
import { FormattedDate, RelativeTime } from '@/components/domain/dates';
import { SettingsSection } from '@/components/settings/settings-nav';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm';
import { Field, FormError } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Notice } from '@/components/ui/primitives';
import { useAction } from '@/lib/use-action';

export interface SessionRow {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  lastSeenAt: string;
  current: boolean;
}

/** A readable name for a session from its user agent; no fingerprinting, just the basics. */
export function describeAgent(ua: string | null) {
  if (!ua) return { label: 'Unknown device', mobile: false };
  const mobile = /Mobile|Android|iPhone|iPad/i.test(ua);
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : /Firefox\//.test(ua) ? 'Firefox' : 'Browser';
  const os = /Windows/.test(ua) ? 'Windows' : /Mac OS X|Macintosh/.test(ua) ? 'macOS' : /Android/.test(ua) ? 'Android' : /iPhone|iPad|iOS/.test(ua) ? 'iOS' : /Linux/.test(ua) ? 'Linux' : '';
  return { label: os ? `${browser} on ${os}` : browser, mobile };
}

export function PasswordForm({ isDemo }: { isDemo: boolean }) {
  const t = useTranslations('account.security');
  const { call, pending, fieldErrors, formError } = useAction();
  const [currentPassword, setCurrent] = useState('');
  const [newPassword, setNew] = useState('');
  const [confirm, setConfirm] = useState('');
  const [mismatch, setMismatch] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirm) {
      setMismatch(t('mismatch'));
      return;
    }
    setMismatch(null);
    const res = await call(() => changePasswordAction({ currentPassword, newPassword }), { success: t('passwordChanged'), inlineFieldErrors: true });
    if (res.ok) {
      setCurrent('');
      setNew('');
      setConfirm('');
    }
  }

  return (
    <SettingsSection title={t('passwordTitle')} description={t('passwordDescription')}>
      <form onSubmit={submit} className="flex max-w-md flex-col gap-4 p-4" noValidate>
        {isDemo ? <Notice tone="attention">{t('demoNotice')}</Notice> : null}
        <FormError message={formError} />
        <Field label={t('currentPassword')} error={fieldErrors.currentPassword}>
          <Input type="password" value={currentPassword} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required disabled={isDemo} />
        </Field>
        <Field label={t('newPassword')} hint={t('passwordHint')} error={fieldErrors.newPassword}>
          <Input type="password" value={newPassword} onChange={(e) => setNew(e.target.value)} autoComplete="new-password" required disabled={isDemo} />
        </Field>
        <Field label={t('confirmPassword')} error={mismatch}>
          <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required disabled={isDemo} />
        </Field>
        <div>
          <Button type="submit" variant="primary" loading={pending} disabled={isDemo || !currentPassword || !newPassword}>
            {t('changePassword')}
          </Button>
        </div>
        <p className="text-[12px] text-ink-3">{t('signsOutOthers')}</p>
      </form>
    </SettingsSection>
  );
}

export function SessionsPanel({ sessions }: { sessions: SessionRow[] }) {
  const t = useTranslations('account.security');
  const { call } = useAction();
  const [revokeAll, setRevokeAll] = useState(false);
  const others = sessions.filter((s) => !s.current).length;
  return (
    <SettingsSection
      title={t('sessionsTitle')}
      description={t('sessionsDescription')}
      action={
        others ? (
          <Button size="sm" onClick={() => setRevokeAll(true)}>
            <LogOut /> {t('signOutOthers')}
          </Button>
        ) : null
      }
    >
      <ul className="divide-y divide-line">
        {sessions.map((s) => {
          const { label, mobile } = describeAgent(s.userAgent);
          const Icon = mobile ? Smartphone : Laptop;
          return (
            <li key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
              <Icon className="size-4 shrink-0 text-ink-3" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate text-[13px] font-medium text-ink">{label}</span>
                  {s.current ? <Badge tone="accent">{t('thisDevice')}</Badge> : null}
                </span>
                <span className="block text-[12px] text-ink-3">
                  {s.ipAddress ? <span className="font-mono">{s.ipAddress}</span> : t('unknownIp')} · {t('lastActive')} <RelativeTime date={s.lastSeenAt} /> · {t('signedIn')} <FormattedDate date={s.createdAt} />
                </span>
              </span>
              {s.current ? null : (
                <Button variant="ghost" size="sm" onClick={() => call(() => revokeSessionAction(s.id), { success: t('revoked') })}>
                  {t('revoke')}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      <ConfirmDialog
        open={revokeAll}
        onOpenChange={setRevokeAll}
        title={t('signOutOthersTitle')}
        description={t('signOutOthersBody', { count: others })}
        confirmLabel={t('signOutOthers')}
        onConfirm={async () => {
          const res = await call(() => revokeOtherSessionsAction(), { success: t('othersRevoked') });
          return res.ok;
        }}
      />
    </SettingsSection>
  );
}
