import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { checkResetToken } from '@orqivanta/core';
import { AuthHeading, ResetPasswordForm } from '@/components/auth-forms';

export async function generateMetadata() {
  const t = await getTranslations('auth');
  return { title: t('resetTitle') };
}

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  if (!token || !(await checkResetToken(token))) redirect('/link-expired?kind=reset');
  const t = await getTranslations('auth');
  return (
    <>
      <AuthHeading title={t('resetTitle')} subtitle={t('resetBody')} />
      <ResetPasswordForm token={token} />
    </>
  );
}
