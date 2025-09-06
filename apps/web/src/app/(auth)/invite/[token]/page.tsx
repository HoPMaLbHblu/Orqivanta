import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { lookupInvitation, resolveActor } from '@orqivanta/core';
import { AuthHeading } from '@/components/auth-forms';
import { AcceptInvitation } from '@/components/accept-invitation';
import { Button } from '@/components/ui/button';
import { getSession } from '@/lib/session';

export async function generateMetadata() {
  const t = await getTranslations('auth.invite');
  return { title: t('metaTitle') };
}

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const t = await getTranslations('auth.invite');
  const inv = await lookupInvitation(token);
  const session = await getSession();
  if (inv.status !== 'valid') {
    const org = inv.orgName ?? '';
    if (inv.status === 'accepted') {
      if (session && inv.orgSlug && (await resolveActor(session.user.id, inv.orgSlug))) redirect(`/${inv.orgSlug}`);
      return (
        <>
          <AuthHeading title={t('accepted.title')} subtitle={t('accepted.body', { org })} />
          <Button asChild variant="primary">
            <Link href={`/sign-in?next=/${inv.orgSlug ?? ''}`}>{t('toSignIn')}</Link>
          </Button>
        </>
      );
    }
    return (
      <>
        <AuthHeading title={t(`${inv.status}.title`)} subtitle={t(`${inv.status}.body`, { org })} />
        <Button asChild variant="secondary">
          <Link href="/sign-in">{t('toSignIn')}</Link>
        </Button>
      </>
    );
  }
  const here = `/invite/${token}`;
  const heading = <AuthHeading title={t('title', { org: inv.orgName })} subtitle={t('subtitle', { inviter: inv.inviterName ?? t('someone'), role: inv.roleLabel, email: inv.email })} />;
  if (!session) {
    return (
      <>
        {heading}
        <div className="flex flex-col gap-2">
          {inv.accountExists ? (
            <Button asChild variant="primary" size="lg" className="justify-center">
              <Link href={`/sign-in?next=${encodeURIComponent(here)}&email=${encodeURIComponent(inv.email)}`}>{t('signInToAccept')}</Link>
            </Button>
          ) : (
            <Button asChild variant="primary" size="lg" className="justify-center">
              <Link href={`/sign-up?next=${encodeURIComponent(here)}&email=${encodeURIComponent(inv.email)}`}>{t('createToAccept')}</Link>
            </Button>
          )}
        </div>
      </>
    );
  }
  const wrongAccount = session.user.email.toLowerCase() !== inv.email.toLowerCase();
  return (
    <>
      {heading}
      <AcceptInvitation token={token} wrongAccount={wrongAccount} invitedEmail={inv.email} currentEmail={session.user.email} />
    </>
  );
}
