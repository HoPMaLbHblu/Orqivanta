import { getTranslations } from 'next-intl/server';
import { listSessions, twoFactorStatus } from '@orqivanta/core';
import { TwoFactorPanel } from '@/components/account/two-factor-panel';
import { PasswordForm, SessionsPanel } from '@/components/account/security-panel';
import { getSession, requireUser } from '@/lib/session';

export async function generateMetadata() {
  const t = await getTranslations('account');
  return { title: t('nav.security') };
}

export default async function SecurityPage() {
  const user = await requireUser();
  const session = await getSession();
  const [sessions, tf] = await Promise.all([listSessions(user.id, session?.sessionId ?? ''), twoFactorStatus(user.id)]);
  return (
    <div className="flex flex-col gap-6">
      <PasswordForm isDemo={user.isDemo} />
      <TwoFactorPanel isDemo={user.isDemo} state={{ enabled: tf.enabled, enabledAt: tf.enabledAt?.toISOString() ?? null, recoveryCodesLeft: tf.recoveryCodesLeft }} />
      <SessionsPanel sessions={sessions.map((s) => ({ id: s.id, userAgent: s.userAgent, ipAddress: s.ipAddress, createdAt: s.createdAt.toISOString(), lastSeenAt: s.lastSeenAt.toISOString(), current: s.current }))} />
    </div>
  );
}
