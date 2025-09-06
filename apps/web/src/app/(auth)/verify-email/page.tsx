import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { AuthHeading, VerifyEmail } from '@/components/auth-forms';
import { safeNext } from '@/lib/routes';

export async function generateMetadata() {
  const t = await getTranslations('auth.verify');
  return { title: t('confirmTitle') };
}

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string; next?: string }> }) {
  const sp = await searchParams;
  const t = await getTranslations('auth');
  if (!sp.token) {
    return (
      <>
        <AuthHeading title={t('linkExpired.title')} subtitle={t('linkExpired.body')} />
        <Link href="/sign-in" className="font-medium text-accent hover:underline">{t('signIn')} →</Link>
      </>
    );
  }
  return <VerifyEmail token={sp.token} next={safeNext(sp.next) ?? undefined} />;
}
