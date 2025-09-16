'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { CheckCircle2, Circle, CircleDot, Flag, Pencil, Plus, Trash2, XCircle } from 'lucide-react';
import { deleteMilestoneAction, saveMilestoneAction } from '@/actions/projects';
import { Badge } from '@/components/domain/badges';
import { DueDate } from '@/components/domain/dates';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ConfirmDialog } from '@/components/ui/confirm';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Field, FormError } from '@/components/ui/field';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { Card, CardHeader, EmptyState } from '@/components/ui/primitives';
import { useAction } from '@/lib/use-action';

export interface MilestoneData {
  id: string;
  name: string;
  description: string | null;
  dueDate: string | null;
  status: 'planned' | 'in_progress' | 'done' | 'missed';
  sharedWithClient: boolean;
  taskTotal: number;
  taskDone: number;
}

const ICON = { planned: Circle, in_progress: CircleDot, done: CheckCircle2, missed: XCircle } as const;
const TONE = { planned: 'text-ink-3', in_progress: 'text-info', done: 'text-success', missed: 'text-danger' } as const;

export function MilestonesPanel({ org, projectId, projectKey, milestones, canManage, canShare, portalEnabled }: { org: string; projectId: string; projectKey: string; milestones: MilestoneData[]; canManage: boolean; canShare: boolean; portalEnabled: boolean }) {
  const t = useTranslations('projects');
  const tms = useTranslations('enums.milestoneStatus');
  const [editing, setEditing] = useState<MilestoneData | 'new' | null>(null);
  const [removing, setRemoving] = useState<MilestoneData | null>(null);
  const { call } = useAction();

  return (
    <Card>
      <CardHeader
        title={t('milestones.title')}
        description={t('milestones.hint')}
        action={
          canManage ? (
            <Button size="xs" onClick={() => setEditing('new')}>
              <Plus /> {t('milestones.add')}
            </Button>
          ) : null
        }
      />
      {milestones.length ? (
        <ol className="divide-y divide-line">
          {milestones.map((m) => {
            const Icon = ICON[m.status];
            return (
              <li key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3">
                <Icon className={`size-4 shrink-0 ${TONE[m.status]}`} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-medium text-ink">{m.name}</p>
                  {m.description ? <p className="mt-0.5 line-clamp-2 text-[12px] text-ink-3">{m.description}</p> : null}
                </div>
                <span className="text-[12px] text-ink-3">{tms(m.status)}</span>
                {m.taskTotal ? (
                  <Link href={`/${org}/projects/${projectKey}/tasks?milestone=${m.id}`} className="text-[12px] tabular-nums text-ink-2 hover:text-ink hover:underline">
                    {t('milestones.taskCount', { done: m.taskDone, total: m.taskTotal })}
                  </Link>
                ) : (
                  <span className="text-[12px] text-ink-3">{t('milestones.noTasks')}</span>
                )}
                {m.sharedWithClient ? <Badge tone="accent">{t('milestones.shared')}</Badge> : null}
                {m.dueDate ? <DueDate date={m.dueDate} done={m.status === 'done'} className="w-24 justify-end" /> : null}
                {canManage ? (
                  <span className="flex items-center gap-0.5">
                    <Button variant="ghost" size="icon-sm" aria-label={t('milestones.edit', { name: m.name })} onClick={() => setEditing(m)}>
                      <Pencil />
                    </Button>
                    <Button variant="ghost" size="icon-sm" aria-label={t('milestones.delete', { name: m.name })} onClick={() => setRemoving(m)}>
                      <Trash2 />
                    </Button>
                  </span>
                ) : null}
              </li>
            );
          })}
        </ol>
      ) : (
        <EmptyState compact icon={<Flag />} title={t('milestones.empty')} description={canManage ? t('milestones.emptyBody') : undefined} action={canManage ? <Button size="sm" onClick={() => setEditing('new')}>{t('milestones.add')}</Button> : null} />
      )}

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent title={editing === 'new' ? t('milestones.newTitle') : t('milestones.editTitle')}>
          {editing ? (
            <MilestoneForm
              org={org}
              projectId={projectId}
              milestone={editing === 'new' ? null : editing}
              canShare={canShare}
              portalEnabled={portalEnabled}
              onDone={() => setEditing(null)}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={t('milestones.deleteTitle', { name: removing?.name ?? '' })}
        description={t('milestones.deleteBody')}
        confirmLabel={t('milestones.deleteConfirm')}
        onConfirm={async () => {
          if (!removing) return false;
          const res = await call(() => deleteMilestoneAction(org, { projectId, milestoneId: removing.id }), { success: t('milestones.deleted') });
          return res.ok;
        }}
      />
    </Card>
  );
}

function MilestoneForm({ org, projectId, milestone, canShare, portalEnabled, onDone }: { org: string; projectId: string; milestone: MilestoneData | null; canShare: boolean; portalEnabled: boolean; onDone: () => void }) {
  const t = useTranslations('projects');
  const tc = useTranslations('common');
  const tms = useTranslations('enums.milestoneStatus');
  const { call, pending, fieldErrors, formError } = useAction();
  const [name, setName] = useState(milestone?.name ?? '');
  const [description, setDescription] = useState(milestone?.description ?? '');
  const [dueDate, setDueDate] = useState(milestone?.dueDate ?? '');
  const [status, setStatus] = useState(milestone?.status ?? 'planned');
  const [shared, setShared] = useState(milestone?.sharedWithClient ?? false);

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const res = await call(
          () => saveMilestoneAction(org, { projectId, milestoneId: milestone?.id, name, description: description || null, dueDate: dueDate || null, status, sharedWithClient: shared }),
          { inlineFieldErrors: true, success: milestone ? t('milestones.saved') : t('milestones.created') },
        );
        if (res.ok) onDone();
      }}
    >
      <FormError message={formError} />
      <Field label={t('milestones.name')} error={fieldErrors.name}>
        <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus maxLength={120} />
      </Field>
      <Field label={t('milestones.description')} optional={tc('optional')} error={fieldErrors.description}>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} className="min-h-16" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('milestones.dueDate')} optional={tc('optional')} error={fieldErrors.dueDate}>
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </Field>
        <Field label={t('milestones.status')} error={fieldErrors.status}>
          <NativeSelect value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
            {(['planned', 'in_progress', 'done', 'missed'] as const).map((s) => (
              <option key={s} value={s}>
                {tms(s)}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>
      {canShare && portalEnabled ? (
        <label className="flex items-start gap-2.5 text-[13px] text-ink">
          <Checkbox checked={shared} onCheckedChange={setShared} />
          <span>
            {t('milestones.shareWithClient')}
            <span className="block text-[12px] text-ink-3">{t('milestones.shareHint')}</span>
          </span>
        </label>
      ) : null}
      <DialogFooter>
        <Button variant="ghost" onClick={onDone} disabled={pending}>
          {tc('cancel')}
        </Button>
        <Button type="submit" variant="primary" loading={pending}>
          {milestone ? tc('save') : tc('create')}
        </Button>
      </DialogFooter>
    </form>
  );
}
