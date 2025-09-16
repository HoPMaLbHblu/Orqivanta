'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowDown, ArrowUp, GripVertical, Plus, Trash2 } from 'lucide-react';
import { saveFormAction } from '@/actions/settings';
import { Button } from '@/components/ui/button';
import { Checkbox, Switch } from '@/components/ui/checkbox';
import { Field, FormError } from '@/components/ui/field';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { Notice } from '@/components/ui/primitives';
import { useAction } from '@/lib/use-action';
import { SettingsSection } from './settings-nav';

export type FieldType = 'short_text' | 'long_text' | 'select' | 'date' | 'url' | 'number';
export const FIELD_TYPES: FieldType[] = ['short_text', 'long_text', 'select', 'date', 'url', 'number'];

export interface BuilderField {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  options?: string[];
  help?: string;
}

export interface FormDraft {
  id?: string;
  name: string;
  description: string | null;
  audience: 'internal' | 'client' | 'both';
  active: boolean;
  defaultOwnerId: string | null;
  fields: BuilderField[];
}

const keyFor = (label: string, taken: string[]) => {
  const base = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').replace(/^([0-9])/, 'f$1').slice(0, 24) || 'field';
  let k = base;
  let i = 2;
  while (taken.includes(k)) k = `${base}_${i++}`;
  return k;
};

/**
 * Request form builder. Field order, type, options and help text are edited here and
 * saved as the form's typed field list; the request form renders exactly these fields.
 */
export function FormBuilder({ org, form, people }: { org: string; form: FormDraft; people: { id: string; name: string }[] }) {
  const t = useTranslations('settings.forms');
  const tc = useTranslations('common');
  const tt = useTranslations('enums.fieldType');
  const router = useRouter();
  const { call, pending, fieldErrors, formError } = useAction();
  const [draft, setDraft] = useState<FormDraft>(form);

  const set = (patch: Partial<FormDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const setField = (i: number, patch: Partial<BuilderField>) => setDraft((d) => ({ ...d, fields: d.fields.map((f, j) => (j === i ? { ...f, ...patch } : f)) }));
  const move = (i: number, dir: -1 | 1) =>
    setDraft((d) => {
      const fields = [...d.fields];
      const j = i + dir;
      if (j < 0 || j >= fields.length) return d;
      [fields[i], fields[j]] = [fields[j]!, fields[i]!];
      return { ...d, fields };
    });

  function addField() {
    setDraft((d) => ({ ...d, fields: [...d.fields, { key: keyFor('field', d.fields.map((f) => f.key)), label: '', type: 'short_text', required: false }] }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const fields = draft.fields.map((f) => ({
      key: f.key,
      label: f.label.trim(),
      type: f.type,
      required: f.required,
      ...(f.type === 'select' ? { options: (f.options ?? []).map((o) => o.trim()).filter(Boolean) } : {}),
      ...(f.help?.trim() ? { help: f.help.trim() } : {}),
    }));
    const res = await call(() => saveFormAction(org, { formId: draft.id, name: draft.name, description: draft.description, audience: draft.audience, active: draft.active, defaultOwnerId: draft.defaultOwnerId, fields }), {
      success: draft.id ? t('saved') : t('created'),
      inlineFieldErrors: true,
      refresh: Boolean(draft.id),
    });
    if (res.ok && !draft.id) router.push(`/${org}/settings/forms/${res.data.id}`);
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-6" noValidate>
      <SettingsSection title={t('detailsTitle')} description={t('detailsDescription')}>
        <div className="flex flex-col gap-4 p-4">
          <FormError message={formError} />
          <Field label={t('name')} error={fieldErrors.name}>
            <Input value={draft.name} onChange={(e) => set({ name: e.target.value })} maxLength={80} required />
          </Field>
          <Field label={t('formDescription')} optional={tc('optional')} error={fieldErrors.description}>
            <Textarea value={draft.description ?? ''} onChange={(e) => set({ description: e.target.value })} rows={2} maxLength={300} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('audience')} hint={t('audienceHint')} error={fieldErrors.audience}>
              <NativeSelect value={draft.audience} onChange={(e) => set({ audience: e.target.value as FormDraft['audience'] })}>
                <option value="internal">{t('audienceInternal')}</option>
                <option value="client">{t('audienceClient')}</option>
                <option value="both">{t('audienceBoth')}</option>
              </NativeSelect>
            </Field>
            <Field label={t('defaultOwner')} hint={t('defaultOwnerHint')} error={fieldErrors.defaultOwnerId}>
              <NativeSelect value={draft.defaultOwnerId ?? ''} onChange={(e) => set({ defaultOwnerId: e.target.value || null })}>
                <option value="">{tc('unassigned')}</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </div>
          <div className="flex items-center gap-3 rounded-md border border-line bg-surface-2 px-3 py-2">
            <Switch checked={draft.active} onCheckedChange={(v) => set({ active: v })} id="form-active" />
            <label htmlFor="form-active" className="text-[13px] text-ink">
              {t('active')}
              <span className="block text-[12px] text-ink-3">{draft.active ? t('activeHint') : t('inactiveHint')}</span>
            </label>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        title={t('fieldsTitle')}
        description={t('fieldsDescription')}
        action={
          <Button size="sm" onClick={addField} type="button" disabled={draft.fields.length >= 15}>
            <Plus /> {t('addField')}
          </Button>
        }
      >
        {draft.fields.length ? (
          <ol className="divide-y divide-line">
            {draft.fields.map((f, i) => (
              <li key={i} className="flex gap-3 p-4">
                <span className="mt-2 flex flex-col items-center gap-1">
                  <GripVertical className="size-4 text-ink-3" aria-hidden />
                  <Button variant="ghost" size="icon-sm" type="button" aria-label={t('moveUp', { n: i + 1 })} disabled={i === 0} onClick={() => move(i, -1)}>
                    <ArrowUp />
                  </Button>
                  <Button variant="ghost" size="icon-sm" type="button" aria-label={t('moveDown', { n: i + 1 })} disabled={i === draft.fields.length - 1} onClick={() => move(i, 1)}>
                    <ArrowDown />
                  </Button>
                </span>
                <div className="min-w-0 flex-1 space-y-3">
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px]">
                    <Field label={t('fieldLabel', { n: i + 1 })} error={fieldErrors[`fields.${i}.label`]}>
                      <Input
                        value={f.label}
                        onChange={(e) => {
                          const label = e.target.value;
                          const autoKey = !f.label || f.key === keyFor(f.label, draft.fields.filter((_, j) => j !== i).map((x) => x.key));
                          setField(i, { label, ...(autoKey ? { key: keyFor(label, draft.fields.filter((_, j) => j !== i).map((x) => x.key)) } : {}) });
                        }}
                        maxLength={120}
                        required
                      />
                    </Field>
                    <Field label={t('fieldType')} error={fieldErrors[`fields.${i}.type`]}>
                      <NativeSelect value={f.type} onChange={(e) => setField(i, { type: e.target.value as FieldType, options: e.target.value === 'select' ? (f.options ?? ['', '']) : undefined })}>
                        {FIELD_TYPES.map((ty) => (
                          <option key={ty} value={ty}>
                            {tt(ty)}
                          </option>
                        ))}
                      </NativeSelect>
                    </Field>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_200px]">
                    <Field label={t('help')} optional={tc('optional')} error={fieldErrors[`fields.${i}.help`]}>
                      <Input value={f.help ?? ''} onChange={(e) => setField(i, { help: e.target.value })} maxLength={200} />
                    </Field>
                    <Field label={t('fieldKey')} hint={t('fieldKeyHint')} error={fieldErrors[`fields.${i}.key`]}>
                      <Input value={f.key} onChange={(e) => setField(i, { key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 31) })} className="font-mono text-[13px]" />
                    </Field>
                  </div>
                  {f.type === 'select' ? (
                    <fieldset className="space-y-2">
                      <legend className="text-[13px] font-medium text-ink">{t('options')}</legend>
                      {(f.options ?? []).map((o, oi) => (
                        <div key={oi} className="flex items-center gap-2">
                          <Input value={o} onChange={(e) => setField(i, { options: (f.options ?? []).map((x, xi) => (xi === oi ? e.target.value : x)) })} maxLength={80} aria-label={t('optionN', { n: oi + 1 })} />
                          <Button variant="ghost" size="icon-sm" type="button" aria-label={t('removeOption', { n: oi + 1 })} onClick={() => setField(i, { options: (f.options ?? []).filter((_, xi) => xi !== oi) })}>
                            <Trash2 />
                          </Button>
                        </div>
                      ))}
                      <Button size="xs" type="button" onClick={() => setField(i, { options: [...(f.options ?? []), ''] })}>
                        <Plus /> {t('addOption')}
                      </Button>
                      {fieldErrors[`fields.${i}.options`] ? <p className="text-[12px] text-danger">{fieldErrors[`fields.${i}.options`]}</p> : null}
                    </fieldset>
                  ) : null}
                  <label className="flex w-fit cursor-pointer items-center gap-2 text-[13px] text-ink">
                    <Checkbox checked={f.required} onCheckedChange={(v) => setField(i, { required: v })} />
                    {t('required')}
                  </label>
                </div>
                <Button variant="ghost" size="icon-sm" type="button" aria-label={t('removeField', { n: i + 1 })} onClick={() => setDraft((d) => ({ ...d, fields: d.fields.filter((_, j) => j !== i) }))}>
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ol>
        ) : (
          <p className="px-4 py-6 text-center text-[13px] text-ink-3">{t('noFields')}</p>
        )}
        {fieldErrors.fields ? (
          <div className="px-4 pb-4">
            <Notice tone="danger">{fieldErrors.fields}</Notice>
          </div>
        ) : null}
      </SettingsSection>

      <div className="flex items-center gap-3">
        <Button type="submit" variant="primary" loading={pending} disabled={!draft.name.trim()}>
          {draft.id ? tc('saveChanges') : t('createForm')}
        </Button>
        <span className="text-[12px] text-ink-3">{t('titleNote')}</span>
      </div>
    </form>
  );
}
