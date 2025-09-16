'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Mail, Send } from 'lucide-react';
import { inviteClientContactsAction } from '@/actions/clients';
import { Button } from '@/components/ui/button';
import { Field, FormError } from '@/components/ui/field';
import { Input, Textarea } from '@/components/ui/input';
import { Card, CardHeader } from '@/components/ui/primitives';
import { useAction } from '@/lib/use-action';

/** Invites a client contact to the portal. The invitation is always scoped to this client. */
export function InviteContactPanel({ org, clientId, archived }: { org: string; clientId: string; archived: boolean }) {
  const t = useTranslations('clients.invite');
  const { call, pending, fieldErrors, formError } = useAction();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [result, setResult] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await call(() => inviteClientContactsAction(org, { clientAccountId: clientId, emails: [email.trim().toLowerCase()], message: message.trim() || null }), { inlineFieldErrors: true });
    if (res.ok) {
      const status = res.data[0]?.status ?? 'invited';
      setResult(t(`result.${status}`, { email: email.trim() }));
      setEmail('');
      setMessage('');
      setOpen(false);
    }
  };

  return (
    <Card>
      <CardHeader title={t('title')} description={t('hint')} />
      <div className="flex flex-col gap-3 px-4 py-3">
        {archived ? (
          <p className="text-[12px] text-ink-3">{t('archivedHint')}</p>
        ) : open ? (
          <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
            <Field label={t('email')} error={fieldErrors.emails}>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus placeholder="name@company.example" />
            </Field>
            <Field label={t('message')} optional={t('optional')} error={fieldErrors.message}>
              <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} maxLength={500} />
            </Field>
            <FormError message={formError} />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
                {t('cancel')}
              </Button>
              <Button size="sm" type="submit" variant="primary" loading={pending}>
                <Send /> {t('send')}
              </Button>
            </div>
          </form>
        ) : (
          <>
            {result ? <p className="text-[13px] text-success">{result}</p> : null}
            <Button size="sm" variant="secondary" className="w-fit" onClick={() => { setResult(null); setOpen(true); }}>
              <Mail /> {t('invite')}
            </Button>
          </>
        )}
      </div>
    </Card>
  );
}
