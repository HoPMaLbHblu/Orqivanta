import { getTranslations } from 'next-intl/server';
import { ProfileForm } from '@/components/account/profile-form';
import { requireUser } from '@/lib/session';

export async function generateMetadata() {
  const t = await getTranslations('account');
  return { title: t('nav.profile') };
}

export default async function ProfilePage() {
  const user = await requireUser();
  return (
    <ProfileForm
      profile={{ name: user.name, email: user.email, avatarColor: user.avatarColor, timeZone: user.timeZone, locale: user.locale, dateFormat: user.dateFormat, theme: user.theme, emailVerified: Boolean(user.emailVerifiedAt) }}
    />
  );
}
