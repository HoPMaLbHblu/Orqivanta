'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Pencil, Plus, Trash2, Users } from 'lucide-react';
import { deleteTeamAction, saveTeamAction } from '@/actions/settings';
import { AvatarStack } from '@/components/domain/avatar';
import { NAMED_COLORS } from '@/components/domain/tone';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ConfirmDialog } from '@/components/ui/confirm';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Field, FormError } from '@/components/ui/field';
import { Input, Textarea } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/primitives';
import { useAction } from '@/lib/use-action';
import { SettingsSection } from './settings-nav';
import { ColorPicker } from './color-picker';

export interface TeamRow {
  id: string;
  name: string;
  description: string | null;
  color: string;
  members: { userId: string; name: string; avatarColor: string }[];
}

export function TeamsPanel({ org, teams, people }: { org: string; teams: TeamRow[]; people: { id: string; name: string; avatarColor: string }[] }) {
  const t = useTranslations('settings.teams');
  const tc = useTranslations('common');
  const { call, pending, fieldErrors, formError, setFieldErrors } = useAction();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TeamRow | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState<string>(NAMED_COLORS[0]);
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [removing, setRemoving] = useState<TeamRow | null>(null);

  function start(team: TeamRow | null) {
    setEditing(team);
    setName(team?.name ?? '');
    setDescription(team?.description ?? '');
    setColor(team?.color ?? NAMED_COLORS[0]);
    setMemberIds(team?.members.map((m) => m.userId) ?? []);
    setFieldErrors({});
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const res = await call(() => saveTeamAction(org, { teamId: editing?.id, name, description: description.trim() || null, color, memberIds }), { success: editing ? t('updated') : t('created'), inlineFieldErrors: true });
    if (res.ok) setOpen(false);
  }

  return (
    <SettingsSection
      title={t('title')}
      description={t('description')}
      action={
        <Button size="sm" variant="primary" onClick={() => start(null)}>
          <Plus /> {t('newTeam')}
        </Button>
      }
    >
      {teams.length ? (
        <ul className="divide-y divide-line">
          {teams.map((team) => (
            <li key={team.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: `var(--c-${team.color})` }} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-ink">{team.name}</span>
                {team.description ? <span className="block truncate text-[12px] text-ink-3">{team.description}</span> : null}
              </span>
              {team.members.length ? <AvatarStack people={team.members.map((m) => ({ name: m.name, color: m.avatarColor }))} /> : <span className="text-[12px] text-ink-3">{t('noMembers')}</span>}
              <span className="flex items-center gap-1">
                <Button variant="ghost" size="icon-sm" aria-label={t('editTeam', { name: team.name })} onClick={() => start(team)}>
                  <Pencil />
                </Button>
                <Button variant="ghost" size="icon-sm" aria-label={t('deleteTeam', { name: team.name })} onClick={() => setRemoving(team)}>
                  <Trash2 />
                </Button>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState compact icon={<Users />} title={t('emptyTitle')} description={t('emptyBody')} />
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title={editing ? t('editTitle') : t('newTeam')} size="md">
          <form onSubmit={save} className="flex flex-col gap-4" noValidate>
            <FormError message={formError} />
            <Field label={t('name')} error={fieldErrors.name}>
              <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={50} required autoFocus />
            </Field>
            <Field label={tc('more')} labelHidden error={fieldErrors.description}>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} maxLength={200} placeholder={t('descriptionPlaceholder')} />
            </Field>
            <ColorPicker label={t('color')} value={color} onChange={setColor} />
            <fieldset className="flex flex-col gap-2">
              <legend className="text-[13px] font-medium text-ink">{t('members')}</legend>
              <div className="max-h-56 overflow-y-auto rounded-md border border-line">
                {people.map((p) => {
                  const checked = memberIds.includes(p.id);
                  return (
                    <label key={p.id} className="flex cursor-pointer items-center gap-2.5 px-3 py-1.5 text-[13px] text-ink hover:bg-surface-2">
                      <Checkbox checked={checked} onCheckedChange={(v) => setMemberIds((ids) => (v ? [...ids, p.id] : ids.filter((i) => i !== p.id)))} />
                      {p.name}
                    </label>
                  );
                })}
              </div>
              {fieldErrors.memberIds ? <p className="text-[12px] text-danger">{fieldErrors.memberIds}</p> : null}
            </fieldset>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)} type="button">
                {tc('cancel')}
              </Button>
              <Button type="submit" variant="primary" loading={pending}>
                {editing ? tc('saveChanges') : tc('create')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(removing)}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={tc('confirmDelete', { name: removing?.name ?? '' })}
        description={t('deleteBody')}
        confirmLabel={tc('delete')}
        onConfirm={async () => {
          if (!removing) return false;
          const res = await call(() => deleteTeamAction(org, removing.id), { success: t('deleted', { name: removing.name }) });
          return res.ok;
        }}
      />
    </SettingsSection>
  );
}
