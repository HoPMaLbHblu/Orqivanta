'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowRightLeft, Trash2 } from 'lucide-react';
import { deleteOrganizationAction, transferOwnershipAction, updateOrganizationAction } from '@/actions/settings';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm';
import { Field, FormError } from '@/components/ui/field';
import { Input, NativeSelect } from '@/components/ui/input';
import { useAction } from '@/lib/use-action';
import { SettingsSection } from './settings-nav';
import { SlugField } from './slug-field';

export function GeneralForm({ org, name: initialName }: { org: string; name: string }) {
  const t = useTranslations('settings.general');
  const tc = useTranslations('common');
  const router = useRouter();
  const { call, pending, fieldErrors, formError } = useAction();
  const [name, setName] = useState(initialName);
  const [slug, setSlug] = useState(org);
  const [slugOk, setSlugOk] = useState<boolean | null>(true);
  const dirty = name.trim() !== initialName || slug !== org;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const res = await call(() => updateOrganizationAction(org, { name, slug }), { success: t('saved'), inlineFieldErrors: true, refresh: slug === org });
    if (res.ok && res.data.slug !== org) router.replace(`/${res.data.slug}/settings/general`);
  }

  return (
    <SettingsSection title={t('title')} description={t('description')}>
      <form onSubmit={save} className="flex max-w-xl flex-col gap-4 p-4" noValidate>
        <FormError message={formError} />
        <Field label={t('name')} error={fieldErrors.name}>
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required />
        </Field>
        <SlugField value={slug} onChange={setSlug} current={org} error={fieldErrors.slug} onAvailability={setSlugOk} />
        {slug !== org ? <p className="text-[12px] text-attention">{t('slugWarning')}</p> : null}
        <div>
          <Button type="submit" variant="primary" loading={pending} disabled={!dirty || slugOk === false || !name.trim()}>
            {tc('saveChanges')}
          </Button>
        </div>
      </form>
    </SettingsSection>
  );
}

export function DangerZone({ org, orgName, members }: { org: string; orgName: string; members: { userId: string; name: string; email: string }[] }) {
  const t = useTranslations('settings.general');
  const { call } = useAction();
  const [target, setTarget] = useState('');
  const [transferOpen, setTransferOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmName, setConfirmName] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const targetName = members.find((m) => m.userId === target)?.name ?? '';

  return (
    <SettingsSection title={t('dangerTitle')} description={t('dangerDescription')} danger>
      <div className="divide-y divide-line">
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 flex-1">
            <h3 className="text-[13px] font-semibold text-ink">{t('transferTitle')}</h3>
            <p className="mt-0.5 text-[13px] text-ink-3">{t('transferBody')}</p>
            {members.length ? (
              <div className="mt-3 max-w-sm">
                <Field label={t('transferTo')}>
                  <NativeSelect value={target} onChange={(e) => setTarget(e.target.value)}>
                    <option value="">{t('chooseMember')}</option>
                    {members.map((m) => (
                      <option key={m.userId} value={m.userId}>
                        {m.name} ({m.email})
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
              </div>
            ) : (
              <p className="mt-2 text-[13px] text-ink-3">{t('noOtherMembers')}</p>
            )}
          </div>
          {members.length ? (
            <Button variant="secondary" disabled={!target} onClick={() => setTransferOpen(true)}>
              <ArrowRightLeft /> {t('transfer')}
            </Button>
          ) : null}
        </div>
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h3 className="text-[13px] font-semibold text-ink">{t('deleteTitle')}</h3>
            <p className="mt-0.5 text-[13px] text-ink-3">{t('deleteBody')}</p>
          </div>
          <Button variant="danger" onClick={() => { setConfirmName(''); setDeleteError(null); setDeleteOpen(true); }}>
            <Trash2 /> {t('delete')}
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={transferOpen}
        onOpenChange={setTransferOpen}
        tone="primary"
        title={t('transferConfirmTitle', { name: targetName })}
        description={t('transferConfirmBody', { name: targetName })}
        confirmLabel={t('transfer')}
        onConfirm={async () => {
          const res = await call(() => transferOwnershipAction(org, target), { success: t('transferred', { name: targetName }) });
          return res.ok;
        }}
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t('deleteConfirmTitle', { name: orgName })}
        description={t('deleteConfirmBody')}
        confirmLabel={t('deleteForever')}
        onConfirm={async () => {
          if (confirmName.trim() !== orgName) {
            setDeleteError(t('typeNameError'));
            return false;
          }
          const res = await call(() => deleteOrganizationAction(org, confirmName), { refresh: false, inlineFieldErrors: true });
          if (res.ok) window.location.href = res.data.to;
          else setDeleteError(res.error.fieldErrors?.confirmName ?? res.error.message);
          return false;
        }}
      >
        <Field label={t('typeName', { name: orgName })} error={deleteError}>
          <Input value={confirmName} onChange={(e) => setConfirmName(e.target.value)} autoComplete="off" />
        </Field>
      </ConfirmDialog>
    </SettingsSection>
  );
}
