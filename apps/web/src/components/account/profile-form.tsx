'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check } from 'lucide-react';
import { updateProfileAction } from '@/actions/account';
import { Avatar } from '@/components/domain/avatar';
import { Button } from '@/components/ui/button';
import { Field, FormError } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { SettingsSection } from '@/components/settings/settings-nav';
import { useAction } from '@/lib/use-action';
import { cn } from '@/lib/cn';

export const AVATAR_COLORS = ['verdigris', 'amber', 'plum', 'slate', 'clay', 'moss', 'ocean', 'rose'] as const;

export interface ProfileData {
  name: string;
  email: string;
  avatarColor: string;
  timeZone: string;
  locale: string;
  dateFormat: string;
  theme: string;
  emailVerified: boolean;
}

export function ProfileForm({ profile }: { profile: ProfileData }) {
  const t = useTranslations('account.profile');
  const tc = useTranslations('common');
  const { call, pending, fieldErrors, formError } = useAction();
  const [name, setName] = useState(profile.name);
  const [avatarColor, setAvatarColor] = useState(profile.avatarColor);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    await call(() => updateProfileAction({ ...profile, name, avatarColor }), { success: t('saved'), inlineFieldErrors: true });
  }

  return (
    <SettingsSection title={t('title')} description={t('description')}>
      <form onSubmit={save} className="flex max-w-xl flex-col gap-4 p-4" noValidate>
        <FormError message={formError} />
        <div className="flex items-center gap-4">
          <Avatar name={name} color={avatarColor} size="lg" title="" />
          <div className="min-w-0 flex-1">
            <Field label={t('name')} error={fieldErrors.name}>
              <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required autoComplete="name" />
            </Field>
          </div>
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className="text-[13px] font-medium text-ink">{t('avatarColor')}</legend>
          <div className="flex flex-wrap gap-1.5">
            {AVATAR_COLORS.map((c) => (
              <button key={c} type="button" onClick={() => setAvatarColor(c)} aria-pressed={avatarColor === c} className={cn('flex size-8 items-center justify-center rounded-full border-2', avatarColor === c ? 'border-ink' : 'border-transparent hover:border-line-strong')} style={{ background: `var(--c-${c}, var(--surface-3))` }}>
                {avatarColor === c ? <Check className="size-4" style={{ color: `var(--c-${c}-ink, var(--ink))` }} aria-hidden /> : null}
                <span className="sr-only">{c}</span>
              </button>
            ))}
          </div>
          <p className="text-[12px] text-ink-3">{t('avatarHint')}</p>
        </fieldset>
        <Field label={t('email')} hint={profile.emailVerified ? t('emailVerified') : t('emailUnverified')}>
          <Input value={profile.email} readOnly disabled className="font-mono text-[13px]" />
        </Field>
        <div>
          <Button type="submit" variant="primary" loading={pending} disabled={name.trim() === profile.name && avatarColor === profile.avatarColor}>
            {tc('saveChanges')}
          </Button>
        </div>
      </form>
    </SettingsSection>
  );
}
