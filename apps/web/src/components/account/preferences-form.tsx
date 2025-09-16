'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Monitor, Moon, Sun } from 'lucide-react';
import { updateProfileAction } from '@/actions/account';
import { applyTheme } from '@/components/preference-switcher';
import { SettingsSection } from '@/components/settings/settings-nav';
import { Button } from '@/components/ui/button';
import { Field, FormError } from '@/components/ui/field';
import { NativeSelect } from '@/components/ui/input';
import { useAction } from '@/lib/use-action';
import type { ProfileData } from './profile-form';
import { cn } from '@/lib/cn';

const DATE_FORMATS = ['d MMM yyyy', 'MMM d, yyyy', 'dd.MM.yyyy', 'yyyy-MM-dd'] as const;
const SAMPLE = new Date('2026-03-09T10:00:00Z');

function sampleDate(fmt: string, locale: string) {
  const d = SAMPLE;
  const month = new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' }).format(d);
  const pad = (n: number) => String(n).padStart(2, '0');
  switch (fmt) {
    case 'MMM d, yyyy':
      return `${month} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
    case 'dd.MM.yyyy':
      return `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}`;
    case 'yyyy-MM-dd':
      return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
    default:
      return `${d.getUTCDate()} ${month} ${d.getUTCFullYear()}`;
  }
}

export function PreferencesForm({ profile, timeZones }: { profile: ProfileData; timeZones: string[] }) {
  const t = useTranslations('account.preferences');
  const tc = useTranslations('common');
  const { call, pending, fieldErrors, formError } = useAction();
  const [theme, setTheme] = useState(profile.theme);
  const [locale, setLocale] = useState(profile.locale);
  const [timeZone, setTimeZone] = useState(profile.timeZone);
  const [dateFormat, setDateFormat] = useState(profile.dateFormat);
  const dirty = theme !== profile.theme || locale !== profile.locale || timeZone !== profile.timeZone || dateFormat !== profile.dateFormat;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    await call(() => updateProfileAction({ name: profile.name, avatarColor: profile.avatarColor, theme, locale, timeZone, dateFormat }), { success: t('saved'), inlineFieldErrors: true });
  }

  return (
    <SettingsSection title={t('title')} description={t('description')}>
      <form onSubmit={save} className="flex max-w-xl flex-col gap-4 p-4" noValidate>
        <FormError message={formError} />
        <fieldset className="flex flex-col gap-2">
          <legend className="text-[13px] font-medium text-ink">{tc('theme')}</legend>
          <div className="flex flex-wrap gap-2">
            {([['system', Monitor, tc('themeSystem')], ['light', Sun, tc('themeLight')], ['dark', Moon, tc('themeDark')]] as const).map(([v, Icon, label]) => (
              <button
                key={v}
                type="button"
                aria-pressed={theme === v}
                onClick={() => {
                  setTheme(v);
                  applyTheme(v);
                }}
                className={cn('inline-flex h-9 items-center gap-2 rounded-md border px-3 text-[13px] font-medium', theme === v ? 'border-accent bg-accent-soft text-accent' : 'border-line-strong bg-surface text-ink-2 hover:bg-surface-2')}
              >
                <Icon className="size-4" aria-hidden />
                {label}
              </button>
            ))}
          </div>
        </fieldset>
        <Field label={tc('language')} error={fieldErrors.locale}>
          <NativeSelect value={locale} onChange={(e) => setLocale(e.target.value)}>
            <option value="en">{tc('en')}</option>
            <option value="ru">{tc('ru')}</option>
          </NativeSelect>
        </Field>
        <Field label={t('timeZone')} hint={t('timeZoneHint')} error={fieldErrors.timeZone}>
          <NativeSelect value={timeZone} onChange={(e) => setTimeZone(e.target.value)}>
            {timeZones.map((tz) => (
              <option key={tz} value={tz}>
                {tz.replace(/_/g, ' ')}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label={t('dateFormat')} error={fieldErrors.dateFormat}>
          <NativeSelect value={dateFormat} onChange={(e) => setDateFormat(e.target.value)}>
            {DATE_FORMATS.map((f) => (
              <option key={f} value={f}>
                {sampleDate(f, locale)}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <div>
          <Button type="submit" variant="primary" loading={pending} disabled={!dirty}>
            {tc('saveChanges')}
          </Button>
        </div>
      </form>
    </SettingsSection>
  );
}
