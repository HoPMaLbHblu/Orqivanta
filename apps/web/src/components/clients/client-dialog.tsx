'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { saveClientAction } from '@/actions/clients';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Field, FormError } from '@/components/ui/field';
import { Input, Textarea } from '@/components/ui/input';
import { useAction } from '@/lib/use-action';

export interface ClientDraft {
  id?: string;
  name?: string;
  website?: string | null;
  internalNotes?: string | null;
}

/** Create or edit a client account. Internal notes are never shown in the portal. */
export function ClientDialog({ org, open, onOpenChange, client }: { org: string; open: boolean; onOpenChange: (o: boolean) => void; client?: ClientDraft }) {
  const t = useTranslations('clients.dialog');
  const router = useRouter();
  const { call, pending, fieldErrors, formError } = useAction();
  const [name, setName] = useState(client?.name ?? '');
  const [website, setWebsite] = useState(client?.website ?? '');
  const [notes, setNotes] = useState(client?.internalNotes ?? '');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await call(() => saveClientAction(org, { clientId: client?.id, name, website: website || null, internalNotes: notes || null }), { success: client?.id ? t('saved') : t('created'), inlineFieldErrors: true });
    if (res.ok) {
      onOpenChange(false);
      if (!client?.id) router.push(`/${org}/clients/${res.data.id}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={client?.id ? t('editTitle') : t('newTitle')} description={client?.id ? undefined : t('newBody')}>
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <Field label={t('name')} error={fieldErrors.name}>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required autoFocus />
          </Field>
          <Field label={t('website')} optional={t('optional')} error={fieldErrors.website}>
            <Input value={website ?? ''} onChange={(e) => setWebsite(e.target.value)} placeholder="example.com" maxLength={200} />
          </Field>
          <Field label={t('notes')} hint={t('notesHint')} optional={t('optional')} error={fieldErrors.internalNotes}>
            <Textarea value={notes ?? ''} onChange={(e) => setNotes(e.target.value)} rows={4} maxLength={5000} />
          </Field>
          <FormError message={formError} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              {t('cancel')}
            </Button>
            <Button type="submit" variant="primary" loading={pending}>
              {client?.id ? t('save') : t('create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
