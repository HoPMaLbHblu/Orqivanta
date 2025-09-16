import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Mail } from 'lucide-react';
import { assignableRoles, listInvitations, listMembers } from '@orqivanta/core';
import { MembersTable } from '@/components/settings/members-table';
import { SettingsSection } from '@/components/settings/settings-nav';
import { requireActor } from '@/lib/session';

export async function generateMetadata() {
  const t = await getTranslations('settings');
  return { title: t('nav.members') };
}

export default async function MembersSettings({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const actor = await requireActor(org);
  const t = await getTranslations('settings.members');
  const [members, invitations] = await Promise.all([listMembers(actor, { includeClients: true }), listInvitations(actor)]);
  return (
    <SettingsSection
      title={t('title')}
      description={t('description', { count: members.length })}
      action={
        <Link href={`/${org}/settings/invitations`} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line-strong bg-surface px-2.5 text-[13px] font-medium text-ink hover:bg-surface-2">
          <Mail className="size-4" aria-hidden /> {t('invite')}
          {invitations.length ? <span className="ml-1 rounded-full bg-surface-3 px-1.5 text-[11px] tabular-nums">{invitations.length}</span> : null}
        </Link>
      }
    >
      <MembersTable
        org={org}
        isSelf={actor.userId}
        assignable={assignableRoles(actor.role)}
        members={members.map((m) => ({
          membershipId: m.membershipId,
          userId: m.userId,
          name: m.name,
          email: m.email,
          avatarColor: m.avatarColor,
          role: m.role,
          status: m.status,
          title: m.title,
          clientName: m.clientName,
          joinedAt: m.joinedAt.toISOString(),
          lastSeenAt: m.lastSeenAt ? new Date(m.lastSeenAt).toISOString() : null,
        }))}
      />
    </SettingsSection>
  );
}
