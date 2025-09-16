'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { setNotificationPreferenceAction } from '@/actions/account';
import { CategoryIcon } from '@/components/inbox/category-icon';
import { SettingsSection } from '@/components/settings/settings-nav';
import { Switch } from '@/components/ui/checkbox';
import { useAction } from '@/lib/use-action';

export interface PrefRow {
  id: string;
  description: string;
  inApp: boolean;
  email: boolean;
}

/** One switch per category × channel; each toggle saves on its own. */
export function NotificationPrefs({ prefs }: { prefs: PrefRow[] }) {
  const t = useTranslations('account.notifications');
  const tc = useTranslations('enums.notificationCategory');
  const { call } = useAction();
  const [rows, setRows] = useState(prefs);

  async function toggle(id: string, channel: 'inApp' | 'email', value: boolean) {
    const next = rows.map((r) => (r.id === id ? { ...r, [channel]: value } : r));
    setRows(next);
    const row = next.find((r) => r.id === id)!;
    const res = await call(() => setNotificationPreferenceAction({ category: id, inApp: row.inApp, email: row.email }), { refresh: false });
    if (!res.ok) setRows(rows);
  }

  return (
    <SettingsSection title={t('title')} description={t('description')}>
      <table className="w-full border-collapse text-[13px]">
        <caption className="sr-only">{t('caption')}</caption>
        <thead>
          <tr className="border-b border-line text-left">
            <th scope="col" className="px-4 py-2 text-[12px] font-medium text-ink-3">
              {t('category')}
            </th>
            <th scope="col" className="w-24 px-4 py-2 text-center text-[12px] font-medium text-ink-3">
              {t('inApp')}
            </th>
            <th scope="col" className="w-24 px-4 py-2 text-center text-[12px] font-medium text-ink-3">
              {t('email')}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r) => (
            <tr key={r.id}>
              <th scope="row" className="px-4 py-2.5 text-left font-normal">
                <span className="flex items-start gap-2.5">
                  <CategoryIcon category={r.id} className="mt-0.5 text-ink-3" />
                  <span className="min-w-0">
                    <span className="block font-medium text-ink">{tc(r.id as never)}</span>
                    <span className="block text-[12px] text-ink-3">{r.description}</span>
                  </span>
                </span>
              </th>
              <td className="px-4 py-2.5 text-center">
                <Switch checked={r.inApp} onCheckedChange={(v) => toggle(r.id, 'inApp', v)} aria-label={t('inAppFor', { category: tc(r.id as never) })} />
              </td>
              <td className="px-4 py-2.5 text-center">
                <Switch checked={r.email} onCheckedChange={(v) => toggle(r.id, 'email', v)} aria-label={t('emailFor', { category: tc(r.id as never) })} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-line px-4 py-3 text-[12px] text-ink-3">{t('footnote')}</p>
    </SettingsSection>
  );
}
