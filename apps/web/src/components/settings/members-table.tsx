'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { MoreHorizontal, PauseCircle, PlayCircle, PencilLine, UserMinus } from 'lucide-react';
import { changeMemberRoleAction, removeMemberAction, setMemberSuspendedAction, updateMemberTitleAction } from '@/actions/settings';
import { Avatar } from '@/components/domain/avatar';
import { Badge } from '@/components/domain/badges';
import { RelativeTime } from '@/components/domain/dates';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input, NativeSelect } from '@/components/ui/input';
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@/components/ui/menu';
import { useAction } from '@/lib/use-action';

export interface MemberRow {
  membershipId: string;
  userId: string;
  name: string;
  email: string;
  avatarColor: string;
  role: 'owner' | 'admin' | 'member' | 'client';
  status: string;
  title: string | null;
  clientName: string | null;
  joinedAt: string;
  lastSeenAt: string | null;
}

export function MembersTable({ org, members, assignable, isSelf }: { org: string; members: MemberRow[]; assignable: string[]; isSelf: string }) {
  const t = useTranslations('settings.members');
  const tc = useTranslations('common');
  const tr = useTranslations('enums.orgRole');
  const { call } = useAction();
  const [editing, setEditing] = useState<MemberRow | null>(null);
  const [title, setTitle] = useState('');
  const [removing, setRemoving] = useState<MemberRow | null>(null);

  const canManage = (m: MemberRow) => m.role !== 'owner' && assignable.includes(m.role === 'admin' ? 'admin' : m.role) !== false && !(m.role === 'admin' && !assignable.includes('admin'));

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-[13px]">
          <caption className="sr-only">{t('caption')}</caption>
          <thead>
            <tr className="border-b border-line text-left">
              <th scope="col" className="px-4 py-2 text-[12px] font-medium text-ink-3">{t('person')}</th>
              <th scope="col" className="px-4 py-2 text-[12px] font-medium text-ink-3">{t('role')}</th>
              <th scope="col" className="px-4 py-2 text-[12px] font-medium text-ink-3">{t('titleColumn')}</th>
              <th scope="col" className="px-4 py-2 text-[12px] font-medium text-ink-3">{t('lastSeen')}</th>
              <th scope="col" className="px-4 py-2"><span className="sr-only">{tc('more')}</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {members.map((m) => (
              <tr key={m.membershipId} className={m.status === 'suspended' ? 'bg-surface-2/60' : undefined}>
                <th scope="row" className="px-4 py-2.5 text-left font-normal">
                  <span className="flex items-center gap-2.5">
                    <Avatar name={m.name} color={m.avatarColor} size="sm" title="" />
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-ink">
                        {m.name}
                        {m.userId === isSelf ? <span className="ml-1.5 text-[12px] font-normal text-ink-3">({tc('you')})</span> : null}
                      </span>
                      <span className="block truncate text-[12px] text-ink-3">{m.email}</span>
                    </span>
                  </span>
                </th>
                <td className="px-4 py-2.5">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <Badge tone={m.role === 'owner' ? 'accent' : 'neutral'}>{tr(m.role)}</Badge>
                    {m.clientName ? <span className="text-[12px] text-ink-3">{m.clientName}</span> : null}
                    {m.status === 'suspended' ? <Badge tone="attention">{t('suspended')}</Badge> : null}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-ink-2">{m.title ?? '—'}</td>
                <td className="px-4 py-2.5 text-ink-3">{m.lastSeenAt ? <RelativeTime date={m.lastSeenAt} /> : t('never')}</td>
                <td className="px-4 py-2.5 text-right">
                  <Menu>
                    <MenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm" aria-label={t('actionsFor', { name: m.name })}>
                        <MoreHorizontal />
                      </Button>
                    </MenuTrigger>
                    <MenuContent align="end">
                      <MenuItem onSelect={() => { setEditing(m); setTitle(m.title ?? ''); }}>
                        <PencilLine /> {t('editTitle')}
                      </MenuItem>
                      {m.role !== 'owner' && m.userId !== isSelf ? (
                        <>
                          {assignable
                            .filter((r) => r !== 'client' && r !== m.role)
                            .map((r) => (
                              <MenuItem key={r} onSelect={() => call(() => changeMemberRoleAction(org, { membershipId: m.membershipId, role: r as 'admin' | 'member' }), { success: t('roleChanged', { name: m.name, role: tr(r as never) }) })}>
                                {t('makeRole', { role: tr(r as never) })}
                              </MenuItem>
                            ))}
                          <MenuSeparator />
                          <MenuItem onSelect={() => call(() => setMemberSuspendedAction(org, { membershipId: m.membershipId, suspended: m.status !== 'suspended' }), { success: m.status === 'suspended' ? t('reactivated', { name: m.name }) : t('suspendedToast', { name: m.name }) })}>
                            {m.status === 'suspended' ? <PlayCircle /> : <PauseCircle />}
                            {m.status === 'suspended' ? t('reactivate') : t('suspend')}
                          </MenuItem>
                          <MenuItem danger onSelect={() => setRemoving(m)}>
                            <UserMinus /> {t('remove')}
                          </MenuItem>
                        </>
                      ) : null}
                    </MenuContent>
                  </Menu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={Boolean(editing)} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent title={t('editTitleFor', { name: editing?.name ?? '' })} size="sm">
          <Field label={t('titleColumn')} hint={t('titleHint')}>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} />
          </Field>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              {tc('cancel')}
            </Button>
            <Button
              variant="primary"
              onClick={async () => {
                if (!editing) return;
                const res = await call(() => updateMemberTitleAction(org, { membershipId: editing.membershipId, title }), { success: tc('saved') });
                if (res.ok) setEditing(null);
              }}
            >
              {tc('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(removing)}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={t('removeConfirmTitle', { name: removing?.name ?? '' })}
        description={t('removeConfirmBody')}
        confirmLabel={t('remove')}
        onConfirm={async () => {
          if (!removing) return false;
          const res = await call(() => removeMemberAction(org, removing.membershipId), { success: t('removed', { name: removing.name }) });
          return res.ok;
        }}
      />
    </>
  );
}
