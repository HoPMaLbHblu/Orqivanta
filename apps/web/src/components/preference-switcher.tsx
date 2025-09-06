'use client';

import { Languages, Monitor, Moon, Sun } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { setPreferenceAction } from '@/actions/auth';
import { Menu, MenuCheckItem, MenuContent, MenuLabel, MenuSeparator, MenuTrigger } from '@/components/ui/menu';
import { Button } from '@/components/ui/button';

export function applyTheme(theme: string) {
  const root = document.documentElement;
  root.dataset.themePref = theme;
  root.dataset.theme = theme === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : theme;
}

/** Language and theme, for pages outside the app (the app has them in the account menu). */
export function PreferenceSwitcher() {
  const t = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const [, start] = useTransition();
  const theme = typeof document !== 'undefined' ? (document.documentElement.dataset.themePref ?? 'system') : 'system';
  return (
    <Menu>
      <MenuTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={`${t('language')} / ${t('theme')}`}>
          <Languages />
          <span className="uppercase">{locale}</span>
        </Button>
      </MenuTrigger>
      <MenuContent align="end">
        <MenuLabel>{t('language')}</MenuLabel>
        {(['en', 'ru'] as const).map((l) => (
          <MenuCheckItem key={l} checked={locale === l} onCheckedChange={() => start(async () => { await setPreferenceAction({ locale: l }); router.refresh(); })}>
            {t(l)}
          </MenuCheckItem>
        ))}
        <MenuSeparator />
        <MenuLabel>{t('theme')}</MenuLabel>
        {([['system', Monitor], ['light', Sun], ['dark', Moon]] as const).map(([v, Icon]) => (
          <MenuCheckItem key={v} checked={theme === v} onCheckedChange={() => { applyTheme(v); start(async () => { await setPreferenceAction({ theme: v }); }); }}>
            <Icon className="size-4" />
            {t(v === 'system' ? 'themeSystem' : v === 'light' ? 'themeLight' : 'themeDark')}
          </MenuCheckItem>
        ))}
      </MenuContent>
    </Menu>
  );
}
