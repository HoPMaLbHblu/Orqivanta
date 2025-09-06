import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { config } from '@orqivanta/core';
import { AuthHeading, SignInForm } from '@/components/auth-forms';
import { getSession } from '@/lib/session';
import { homePathFor, safeNext } from '@/lib/routes';

export async function generateMetadata() {
  const t = await getTranslations('auth');
  return { title: t('signIn') };
}

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string; email?: string }> }) {
  const sp = await searchParams;
  const next = safeNext(sp.next) ?? undefined;
  const session = await getSession();
  if (session) redirect(next ?? (await homePathFor(session.user)));
  const t = await getTranslations('auth');
  return (
    <>
      <AuthHeading title={t('signInTitle')} subtitle={t.rich('noAccount', { link: (c) => <Link href={`/sign-up${next ? `?next=${encodeURIComponent(next)}` : ''}`} className="font-medium text-accent hover:underline">{c}</Link> })} />
      <SignInForm next={next} initialEmail={sp.email} />
      {config.demoMode ? (
        <div className="mt-8 rounded-lg border border-line bg-surface p-4 text-[13px]">
          <p className="font-medium text-ink">{t('demoTitle')}</p>
          <p className="mt-1 text-ink-2">{t('demoBody')}</p>
          <Link href="/demo" className="mt-2 inline-block font-medium text-accent hover:underline">
            {t('demoLink')} →
          </Link>
        </div>
      ) : null}
    </>
  );
}
