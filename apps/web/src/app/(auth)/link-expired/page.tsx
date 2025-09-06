import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui/button';
import { AuthHeading } from '@/components/auth-forms';

export default async function LinkExpiredPage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const { kind } = await searchParams;
  const t = await getTranslations('auth.linkExpired');
  return (
    <>
      <AuthHeading title={t('title')} subtitle={kind === 'reset' ? t('resetBody') : kind === 'invite' ? t('inviteBody') : t('body')} />
      <div className="flex gap-2">
        {kind === 'reset' ? (
          <Button asChild variant="primary">
            <Link href="/forgot-password">{t('newResetLink')}</Link>
          </Button>
        ) : null}
        <Button asChild variant="secondary">
          <Link href="/sign-in">{t('toSignIn')}</Link>
        </Button>
      </div>
    </>
  );
}
