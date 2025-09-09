'use client';

import { Keyboard, Languages, LogOut, Monitor, Moon, Sun, UserRound } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useTransition, type ReactNode } from 'react';
import { setPreferenceAction, signOutAction } from '@/actions/auth';
import { applyTheme } from '@/components/preference-switcher';
import { Menu, MenuCheckItem, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuSub, MenuSubContent, MenuSubTrigger, MenuTrigger } from '@/components/ui/menu';
import { useShortcutHelp } from './shortcuts';

export function AccountMenu({ user, orgSlug, children }: { user: { name: string; email: string }; orgSlug?: string; children: ReactNode }) {
  const t = useTranslations('common');
  const ts = useTranslations('shell');
  const locale = useLocale();
  const router = useRouter();
  const [, start] = useTransition();
  const help = useShortcutHelp();
  const theme = typeof document !== 'undefined' ? (document.documentElement.dataset.themePref ?? 'system') : 'system';
  return (
    <Menu>
      <MenuTrigger asChild>{children}</MenuTrigger>
      <MenuContent align="start" className="w-60">
        <MenuLabel>{user.email}</MenuLabel>
        <MenuItem onSelect={() => router.push(`/account/profile${orgSlug ? `?org=${orgSlug}` : ''}`)}>
          <UserRound /> {ts('accountSettings')}
        </MenuItem>
        <MenuSub>
          <MenuSubTrigger>
            <Languages className="size-4 text-ink-3" /> {t('language')}
          </MenuSubTrigger>
          <MenuSubContent>
            {(['en', 'ru'] as const).map((l) => (
              <MenuCheckItem key={l} checked={locale === l} onCheckedChange={() => start(async () => { await setPreferenceAction({ locale: l }); router.refresh(); })}>
                {t(l)}
              </MenuCheckItem>
            ))}
          </MenuSubContent>
        </MenuSub>
        <MenuSub>
          <MenuSubTrigger>
            <Monitor className="size-4 text-ink-3" /> {t('theme')}
          </MenuSubTrigger>
          <MenuSubContent>
            {([['system', Monitor], ['light', Sun], ['dark', Moon]] as const).map(([v, Icon]) => (
              <MenuCheckItem key={v} checked={theme === v} onCheckedChange={() => { applyTheme(v); start(async () => { await setPreferenceAction({ theme: v }); }); }}>
                <Icon className="size-4" /> {t(v === 'system' ? 'themeSystem' : v === 'light' ? 'themeLight' : 'themeDark')}
              </MenuCheckItem>
            ))}
          </MenuSubContent>
        </MenuSub>
        <MenuItem onSelect={() => help.open()} shortcut="?">
          <Keyboard /> {t('keyboardShortcuts')}
        </MenuItem>
        <MenuSeparator />
        <MenuItem onSelect={() => start(() => signOutAction())}>
          <LogOut /> {t('signOut')}
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}
