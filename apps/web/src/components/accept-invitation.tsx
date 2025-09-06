'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { acceptInvitationAction } from '@/actions/invitations';
import { signOutAction } from '@/actions/auth';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/primitives';
import { useAction } from '@/lib/use-action';

export function AcceptInvitation({ token, wrongAccount, invitedEmail, currentEmail }: { token: string; wrongAccount: boolean; invitedEmail: string; currentEmail: string }) {
  const t = useTranslations('auth.invite');
  const router = useRouter();
  const { call, pending } = useAction();
  if (wrongAccount) {
    return (
      <div className="flex flex-col gap-4">
        <Notice tone="attention">{t('wrongAccount', { current: currentEmail, invited: invitedEmail })}</Notice>
        <form action={signOutAction}>
          <Button type="submit" variant="primary">{t('switchAccount')}</Button>
        </form>
      </div>
    );
  }
  return (
    <Button
      variant="primary"
      size="lg"
      className="w-full justify-center"
      loading={pending}
      onClick={async () => {
        const res = await call(() => acceptInvitationAction(token), { refresh: false });
        if (res.ok) {
          const slug = (res.data as { orgSlug?: string; role?: string })?.orgSlug;
          const role = (res.data as { role?: string })?.role;
          router.push(slug ? (role === 'client' ? `/portal/${slug}` : `/${slug}`) : '/');
          router.refresh();
        }
      }}
    >
      {t('accept')}
    </Button>
  );
}
