'use client';

import { useTranslations } from 'next-intl';
import { Field } from '@/components/ui/field';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';

/** Mirrors the FormField shape stored on request forms (packages/db clientwork schema). */
export interface RequestFormField {
  key: string;
  label: string;
  type: 'short_text' | 'long_text' | 'select' | 'date' | 'url' | 'number';
  required: boolean;
  options?: string[];
  help?: string;
}

export type AnswerValues = Record<string, string>;

/**
 * Renders a request form's typed fields as real inputs. Values are kept as strings and
 * validated by the server (validateAnswers), whose errors come back keyed `answers.<key>`.
 * Used by the internal "New request" page and the client portal.
 */
export function RequestFormFields({ fields, values, onChange, errors, disabled, idPrefix = 'answer' }: { fields: RequestFormField[]; values: AnswerValues; onChange: (key: string, value: string) => void; errors?: Record<string, string>; disabled?: boolean; idPrefix?: string }) {
  const t = useTranslations('requests.form');
  if (!fields.length) return null;
  return (
    <div className="flex flex-col gap-4">
      {fields.map((f) => {
        const id = `${idPrefix}-${f.key}`;
        const error = errors?.[`answers.${f.key}`] ?? null;
        const value = values[f.key] ?? '';
        const common = { id, disabled, required: f.required, value, name: `answers.${f.key}` };
        let control;
        switch (f.type) {
          case 'long_text':
            control = <Textarea {...common} maxLength={5000} onChange={(e) => onChange(f.key, e.target.value)} />;
            break;
          case 'select':
            control = (
              <NativeSelect {...common} onChange={(e) => onChange(f.key, e.target.value)}>
                <option value="">{t('choose')}</option>
                {(f.options ?? []).map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </NativeSelect>
            );
            break;
          case 'date':
            control = <Input {...common} type="date" className="sm:w-48" onChange={(e) => onChange(f.key, e.target.value)} />;
            break;
          case 'url':
            control = <Input {...common} type="url" inputMode="url" placeholder="https://" onChange={(e) => onChange(f.key, e.target.value)} />;
            break;
          case 'number':
            control = <Input {...common} type="number" inputMode="decimal" className="sm:w-48" onChange={(e) => onChange(f.key, e.target.value)} />;
            break;
          default:
            control = <Input {...common} maxLength={200} onChange={(e) => onChange(f.key, e.target.value)} />;
        }
        return (
          <Field key={f.key} label={f.label} hint={f.help} error={error} optional={f.required ? undefined : t('optional')}>
            {control}
          </Field>
        );
      })}
    </div>
  );
}
