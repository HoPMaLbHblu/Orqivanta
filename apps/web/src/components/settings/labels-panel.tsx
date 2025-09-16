'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Pencil, Plus, Tag, Trash2 } from 'lucide-react';
import { deleteLabelAction, saveLabelAction } from '@/actions/settings';
import { LabelChip } from '@/components/domain/badges';
import { NAMED_COLORS } from '@/components/domain/tone';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Field, FormError } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/primitives';
import { useAction } from '@/lib/use-action';
import { ColorPicker } from './color-picker';
import { SettingsSection } from './settings-nav';

export interface LabelRow {
  id: string;
  name: string;
  color: string;
  useCount: number;
}

export function LabelsPanel({ org, labels }: { org: string; labels: LabelRow[] }) {
  const t = useTranslations('settings.labels');
  const tc = useTranslations('common');
  const { call, pending, fieldErrors, formError, setFieldErrors } = useAction();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<LabelRow | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState<string>(NAMED_COLORS[0]);
  const [removing, setRemoving] = useState<LabelRow | null>(null);

  function start(label: LabelRow | null) {
    setEditing(label);
    setName(label?.name ?? '');
    setColor(label?.color ?? NAMED_COLORS[0]);
    setFieldErrors({});
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const res = await call(() => saveLabelAction(org, { labelId: editing?.id, name, color }), { success: editing ? t('updated') : t('created'), inlineFieldErrors: true });
    if (res.ok) setOpen(false);
  }

  return (
    <SettingsSection
      title={t('title')}
      description={t('description')}
      action={
        <Button size="sm" variant="primary" onClick={() => start(null)}>
          <Plus /> {t('newLabel')}
        </Button>
      }
    >
      {labels.length ? (
        <ul className="divide-y divide-line">
          {labels.map((l) => (
            <li key={l.id} className="flex items-center gap-3 px-4 py-2.5">
              <LabelChip name={l.name} color={l.color} />
              <span className="min-w-0 flex-1 text-[12px] text-ink-3">{t('usedOn', { count: l.useCount })}</span>
              <Button variant="ghost" size="icon-sm" aria-label={t('editLabel', { name: l.name })} onClick={() => start(l)}>
                <Pencil />
              </Button>
              <Button variant="ghost" size="icon-sm" aria-label={t('deleteLabel', { name: l.name })} onClick={() => setRemoving(l)}>
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState compact icon={<Tag />} title={t('emptyTitle')} description={t('emptyBody')} />
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title={editing ? t('editTitle') : t('newLabel')} size="sm">
          <form onSubmit={save} className="flex flex-col gap-4" noValidate>
            <FormError message={formError} />
            <Field label={t('name')} error={fieldErrors.name}>
              <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={30} required autoFocus />
            </Field>
            <ColorPicker label={t('color')} value={color} onChange={setColor} />
            <div className="flex items-center gap-2 rounded-md border border-line bg-surface-2 px-3 py-2">
              <span className="text-[12px] text-ink-3">{t('preview')}</span>
              <LabelChip name={name || t('name')} color={color} />
            </div>
            <DialogFooter>
              <Button variant="ghost" type="button" onClick={() => setOpen(false)}>
                {tc('cancel')}
              </Button>
              <Button type="submit" variant="primary" loading={pending}>
                {editing ? tc('saveChanges') : tc('create')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(removing)}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={tc('confirmDelete', { name: removing?.name ?? '' })}
        description={t('deleteBody', { count: removing?.useCount ?? 0 })}
        confirmLabel={tc('delete')}
        onConfirm={async () => {
          if (!removing) return false;
          const res = await call(() => deleteLabelAction(org, removing.id), { success: t('deleted', { name: removing.name }) });
          return res.ok;
        }}
      />
    </SettingsSection>
  );
}
