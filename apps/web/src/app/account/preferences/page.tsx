import { getTranslations } from 'next-intl/server';
import { PreferencesForm } from '@/components/account/preferences-form';
import { requireUser } from '@/lib/session';

export async function generateMetadata() {
  const t = await getTranslations('account');
  return { title: t('nav.preferences') };
}

export default async function PreferencesPage() {
  const user = await requireUser();
  const supported = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : ['UTC'];
  const zones = supported.includes(user.timeZone) ? supported : [user.timeZone, ...supported];
  return (
    <PreferencesForm
      profile={{ name: user.name, email: user.email, avatarColor: user.avatarColor, timeZone: user.timeZone, locale: user.locale, dateFormat: user.dateFormat, theme: user.theme, emailVerified: Boolean(user.emailVerifiedAt) }}
      timeZones={zones}
    />
  );
}
