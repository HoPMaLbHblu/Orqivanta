'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check, Mail, RotateCw, Send, X } from 'lucide-react';
import { createInvitationsAction, resendInvitationAction, revokeInvitationAction } from '@/actions/settings';
import { Badge } from '@/components/domain/badges';
import { FormattedDate, RelativeTime } from '@/components/domain/dates';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm';
import { Field, FormError } from '@/components/ui/field';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { EmptyState, Notice } from '@/components/ui/primitives';
import { useAction } from '@/lib/use-action';
import { SettingsSection } from './settings-nav';

export interface InvitationRow {
  id: string;
  email: string;
  role: 'owner' | 'admin' | 'member' | 'client';
  clientName: string | null;
  invitedByName: string | null;
  expiresAt: string;
  createdAt: string;
}

const splitEmails = (raw: string) =>
  raw
    .split(/[\s,;]+/)
    .map((e) => e.trim())
    .filter(Boolean);

export function InviteForm({ org, assignable, clients }: { org: string; assignable: string[]; clients: { id: string; name: string }[] }) {
  const t = useTranslations('settings.invitations');
  const tr = useTranslations('enums.orgRole');
  const { call, pending, fieldErrors, formError } = useAction();
  const [emails, setEmails] = useState('');
  const [role, setRole] = useState(assignable.includes('member') ? 'member' : (assignable[0] ?? 'member'));
  const [clientAccountId, setClientAccountId] = useState('');
  const [message, setMessage] = useState('');
  const [result, setResult] = useState<{ email: string; status: string }[] | null>(null);
  const list = splitEmails(emails);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await call(() => createInvitationsAction(org, { emails: list, role: role as 'admin' | 'member' | 'client', clientAccountId: role === 'client' ? clientAccountId || null : null, message: message.trim() || null }), {
      success: t('sent', { count: list.length }),
      inlineFieldErrors: true,
    });
    if (res.ok) {
      setResult(res.data);
      setEmails('');
      setMessage('');
    }
  }

  return (
    <SettingsSection title={t('inviteTitle')} description={t('inviteDescription')}>
      <form onSubmit={submit} className="flex max-w-xl flex-col gap-4 p-4" noValidate>
        <FormError message={formError} />
        <Field label={t('emails')} hint={t('emailsHint')} error={fieldErrors.emails ?? fieldErrors['emails.0']}>
          <Textarea value={emails} onChange={(e) => setEmails(e.target.value)} rows={3} placeholder="alex@studio.example, sam@studio.example" spellCheck={false} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('role')} error={fieldErrors.role}>
            <NativeSelect value={role} onChange={(e) => setRole(e.target.value)}>
              {assignable.map((r) => (
                <option key={r} value={r}>
                  {tr(r as never)}
                </option>
              ))}
            </NativeSelect>
          </Field>
          {role === 'client' ? (
            <Field label={t('client')} error={fieldErrors.clientAccountId}>
              <NativeSelect value={clientAccountId} onChange={(e) => setClientAccountId(e.target.value)}>
                <option value="">{t('chooseClient')}</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          ) : null}
        </div>
        <Field label={t('message')} optional={t('optionalNote')} error={fieldErrors.message}>
          <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={2} maxLength={500} />
        </Field>
        <div className="flex items-center gap-3">
          <Button type="submit" variant="primary" loading={pending} disabled={!list.length}>
            <Send /> {t('sendInvites', { count: list.length })}
          </Button>
          <span className="text-[12px] text-ink-3">{t('expiryNote')}</span>
        </div>
        {result?.length ? (
          <Notice tone="success" icon={<Check />}>
            <ul className="space-y-0.5">
              {result.map((r) => (
                <li key={r.email}>{t(`result.${r.status as 'invited' | 'resent' | 'already_member'}`, { email: r.email })}</li>
              ))}
            </ul>
          </Notice>
        ) : null}
      </form>
    </SettingsSection>
  );
}

export function PendingInvitations({ org, invitations }: { org: string; invitations: InvitationRow[] }) {
  const t = useTranslations('settings.invitations');
  const tr = useTranslations('enums.orgRole');
  const { call } = useAction();
  const [revoking, setRevoking] = useState<InvitationRow | null>(null);
  return (
    <SettingsSection title={t('pendingTitle')} description={t('pendingDescription')}>
      {invitations.length ? (
        <ul className="divide-y divide-line">
          {invitations.map((inv) => {
            const expired = new Date(inv.expiresAt) < new Date();
            return (
              <li key={inv.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                <Mail className="size-4 shrink-0 text-ink-3" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-ink">{inv.email}</span>
                  <span className="block text-[12px] text-ink-3">
                    {t('invitedBy', { name: inv.invitedByName ?? '—' })} · <RelativeTime date={inv.createdAt} />
                    {expired ? ` · ${t('expired')}` : <> · {t('expires', { date: '' })}<FormattedDate date={inv.expiresAt} /></>}
                  </span>
                </span>
                <Badge tone={expired ? 'attention' : 'neutral'}>{tr(inv.role)}</Badge>
                {inv.clientName ? <span className="text-[12px] text-ink-3">{inv.clientName}</span> : null}
                <span className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => call(() => resendInvitationAction(org, inv.id), { success: t('resent', { email: inv.email }) })}>
                    <RotateCw /> {t('resend')}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setRevoking(inv)}>
                    <X /> {t('revoke')}
                  </Button>
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState compact icon={<Mail />} title={t('noPending')} description={t('noPendingHint')} />
      )}
      <ConfirmDialog
        open={Boolean(revoking)}
        onOpenChange={(o) => !o && setRevoking(null)}
        title={t('revokeConfirmTitle', { email: revoking?.email ?? '' })}
        description={t('revokeConfirmBody')}
        confirmLabel={t('revoke')}
        onConfirm={async () => {
          if (!revoking) return false;
          const res = await call(() => revokeInvitationAction(org, revoking.id), { success: t('revoked', { email: revoking.email }) });
          return res.ok;
        }}
      />
    </SettingsSection>
  );
}
