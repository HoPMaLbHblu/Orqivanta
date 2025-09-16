import { getTranslations } from 'next-intl/server';
import { getNotificationPreferences } from '@orqivanta/core';
import { NotificationPrefs } from '@/components/account/notification-prefs';
import { requireUser } from '@/lib/session';

export async function generateMetadata() {
  const t = await getTranslations('account');
  return { title: t('nav.notifications') };
}

export default async function NotificationsPage() {
  const user = await requireUser();
  const prefs = await getNotificationPreferences(user.id);
  return <NotificationPrefs prefs={prefs.map((p) => ({ id: p.id, description: p.description, inApp: p.inApp, email: p.email }))} />;
}
