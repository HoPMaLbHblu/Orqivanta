'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { UserPlus, X } from 'lucide-react';
import { addProjectMembersAction, changeProjectMemberRoleAction, removeProjectMemberAction } from '@/actions/projects';
import { Avatar } from '@/components/domain/avatar';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ConfirmDialog } from '@/components/ui/confirm';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { NativeSelect } from '@/components/ui/input';
import { Card, CardHeader, EmptyState } from '@/components/ui/primitives';
import { useAction } from '@/lib/use-action';

type Role = 'manager' | 'contributor' | 'viewer';

export function ProjectMembers({ org, projectId, members, candidates, canManage, currentUserId }: { org: string; projectId: string; members: { userId: string; name: string; email: string; avatarColor: string | null; role: Role }[]; candidates: { id: string; name: string; email: string; avatarColor: string | null }[]; canManage: boolean; currentUserId: string }) {
  const t = useTranslations('projects');
  const tr = useTranslations('enums.projectRole');
  const tc = useTranslations('common');
  const { call } = useAction();
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<{ userId: string; name: string } | null>(null);

  return (
    <Card>
      <CardHeader
        title={t('members.title')}
        description={t('members.hint')}
        action={
          canManage && candidates.length ? (
            <Button size="xs" onClick={() => setAdding(true)}>
              <UserPlus /> {t('members.add')}
            </Button>
          ) : null
        }
      />
      {members.length ? (
        <ul className="divide-y divide-line">
          {members.map((m) => (
            <li key={m.userId} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
              <Avatar name={m.name} color={m.avatarColor} size="sm" title="" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] text-ink">
                  {m.name}
                  {m.userId === currentUserId ? <span className="ml-1.5 text-[12px] text-ink-3">({tc('you')})</span> : null}
                </p>
                <p className="truncate text-[12px] text-ink-3">{m.email}</p>
              </div>
              {canManage ? (
                <>
                  <NativeSelect
                    value={m.role}
                    aria-label={t('members.roleFor', { name: m.name })}
                    className="h-8 w-36 text-[13px]"
                    onChange={(e) => call(() => changeProjectMemberRoleAction(org, { projectId, userId: m.userId, role: e.target.value as Role }), { success: t('members.roleChanged') })}
                  >
                    {(['manager', 'contributor', 'viewer'] as const).map((r) => (
                      <option key={r} value={r}>
                        {tr(r)}
                      </option>
                    ))}
                  </NativeSelect>
                  <Button size="icon-sm" variant="ghost" aria-label={t('members.remove', { name: m.name })} onClick={() => setRemoving({ userId: m.userId, name: m.name })}>
                    <X />
                  </Button>
                </>
              ) : (
                <span className="text-[12px] text-ink-3">{tr(m.role)}</span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState compact title={t('members.empty')} description={canManage ? t('members.emptyBody') : undefined} />
      )}

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent title={t('members.addTitle')} description={t('members.addBody')}>
          {adding ? <AddMembersForm org={org} projectId={projectId} candidates={candidates} onDone={() => setAdding(false)} /> : null}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={t('members.removeTitle', { name: removing?.name ?? '' })}
        description={t('members.removeBody')}
        confirmLabel={tc('remove')}
        onConfirm={async () => {
          if (!removing) return false;
          const res = await call(() => removeProjectMemberAction(org, { projectId, userId: removing.userId }), { success: t('members.removed') });
          return res.ok;
        }}
      />
    </Card>
  );
}

function AddMembersForm({ org, projectId, candidates, onDone }: { org: string; projectId: string; candidates: { id: string; name: string; email: string; avatarColor: string | null }[]; onDone: () => void }) {
  const t = useTranslations('projects');
  const tr = useTranslations('enums.projectRole');
  const tc = useTranslations('common');
  const { call, pending, fieldErrors } = useAction();
  const [ids, setIds] = useState<string[]>([]);
  const [role, setRole] = useState<Role>('contributor');
  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const res = await call(() => addProjectMembersAction(org, { projectId, userIds: ids, role }), { inlineFieldErrors: true, success: t('members.added', { count: ids.length }) });
        if (res.ok) onDone();
      }}
    >
      <fieldset>
        <legend className="text-[13px] font-medium text-ink">{t('members.people')}</legend>
        <ul className="mt-2 max-h-64 overflow-y-auto rounded-md border border-line">
          {candidates.map((c) => (
            <li key={c.id} className="border-b border-line last:border-0">
              <label className="flex cursor-pointer items-center gap-2.5 px-3 py-2 hover:bg-surface-2">
                <Checkbox checked={ids.includes(c.id)} onCheckedChange={(v) => setIds((s) => (v ? [...s, c.id] : s.filter((x) => x !== c.id)))} aria-label={c.name} />
                <Avatar name={c.name} color={c.avatarColor} size="sm" title="" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] text-ink">{c.name}</span>
                  <span className="block truncate text-[12px] text-ink-3">{c.email}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
        {fieldErrors.userIds ? (
          <p role="alert" className="mt-1 text-[12px] text-danger">
            {fieldErrors.userIds}
          </p>
        ) : null}
      </fieldset>
      <label className="text-[13px] font-medium text-ink">
        {t('members.role')}
        <NativeSelect value={role} onChange={(e) => setRole(e.target.value as Role)} className="mt-1.5">
          {(['manager', 'contributor', 'viewer'] as const).map((r) => (
            <option key={r} value={r}>
              {tr(r)}
            </option>
          ))}
        </NativeSelect>
      </label>
      <DialogFooter>
        <Button variant="ghost" onClick={onDone} disabled={pending}>
          {tc('cancel')}
        </Button>
        <Button type="submit" variant="primary" loading={pending} disabled={!ids.length}>
          {t('members.add')}
        </Button>
      </DialogFooter>
    </form>
  );
}
