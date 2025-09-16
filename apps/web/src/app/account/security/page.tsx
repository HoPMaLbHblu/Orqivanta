import { getTranslations } from 'next-intl/server';
import { listSessions } from '@orqivanta/core';
import { PasswordForm, SessionsPanel } from '@/components/account/security-panel';
import { getSession, requireUser } from '@/lib/session';

export async function generateMetadata() {
  const t = await getTranslations('account');
  return { title: t('nav.security') };
}

export default async function SecurityPage() {
  const user = await requireUser();
  const session = await getSession();
  const sessions = await listSessions(user.id, session?.sessionId ?? '');
  return (
    <div className="flex flex-col gap-6">
      <PasswordForm isDemo={user.isDemo} />
      <SessionsPanel sessions={sessions.map((s) => ({ id: s.id, userAgent: s.userAgent, ipAddress: s.ipAddress, createdAt: s.createdAt.toISOString(), lastSeenAt: s.lastSeenAt.toISOString(), current: s.current }))} />
    </div>
  );
}
