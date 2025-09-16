import { getTranslations } from 'next-intl/server';
import { assignableRoles, listClients, listInvitations } from '@orqivanta/core';
import { InviteForm, PendingInvitations } from '@/components/settings/invitations-panel';
import { requireActor } from '@/lib/session';

export async function generateMetadata() {
  const t = await getTranslations('settings');
  return { title: t('nav.invitations') };
}

export default async function InvitationsSettings({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const actor = await requireActor(org);
  const [invitations, clients] = await Promise.all([listInvitations(actor), listClients(actor)]);
  return (
    <div className="flex flex-col gap-6">
      <InviteForm org={org} assignable={assignableRoles(actor.role)} clients={clients.map((c) => ({ id: c.id, name: c.name }))} />
      <PendingInvitations
        org={org}
        invitations={invitations.map((i) => ({ id: i.id, email: i.email, role: i.role, clientName: i.clientName, invitedByName: i.invitedByName, expiresAt: i.expiresAt.toISOString(), createdAt: i.createdAt.toISOString() }))}
      />
    </div>
  );
}
