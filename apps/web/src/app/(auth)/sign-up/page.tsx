import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { AuthHeading, SignUpForm } from '@/components/auth-forms';
import { getSession } from '@/lib/session';
import { homePathFor, safeNext } from '@/lib/routes';

export async function generateMetadata() {
  const t = await getTranslations('auth');
  return { title: t('createAccount') };
}

export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ next?: string; email?: string }> }) {
  const sp = await searchParams;
  const next = safeNext(sp.next) ?? undefined;
  const session = await getSession();
  if (session) redirect(next ?? (await homePathFor(session.user)));
  const t = await getTranslations('auth');
  const signInHref = `/sign-in${next ? `?next=${encodeURIComponent(next)}` : ''}`;
  return (
    <>
      <AuthHeading title={t('signUpTitle')} subtitle={t.rich('haveAccount', { link: (c) => <Link href={signInHref} className="font-medium text-accent hover:underline">{c}</Link> })} />
      <SignUpForm next={next} initialEmail={sp.email} lockedEmail={Boolean(sp.email && next?.startsWith('/invite/'))} />
    </>
  );
}
