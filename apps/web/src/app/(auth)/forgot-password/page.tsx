import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { AuthHeading, ForgotPasswordForm } from '@/components/auth-forms';

export async function generateMetadata() {
  const t = await getTranslations('auth');
  return { title: t('forgotTitle') };
}

export default async function ForgotPasswordPage() {
  const t = await getTranslations('auth');
  return (
    <>
      <AuthHeading title={t('forgotTitle')} subtitle={t('forgotBody')} />
      <ForgotPasswordForm />
      <Link href="/sign-in" className="mt-6 inline-block text-[13px] text-accent hover:underline">← {t('backToSignIn')}</Link>
    </>
  );
}
