'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { updateProjectAction } from '@/actions/projects';
import { toneInk } from '@/components/domain/tone';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Field, FormError } from '@/components/ui/field';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { Card, CardHeader } from '@/components/ui/primitives';
import { cn } from '@/lib/cn';
import { useAction } from '@/lib/use-action';

const COLORS = ['verdigris', 'amber', 'plum', 'ocean', 'moss', 'rose', 'slate', 'sand'] as const;

export interface ProjectFormData {
  id: string;
  key: string;
  name: string;
  description: string | null;
  goals: string[];
  visibility: 'private' | 'team' | 'org';
  teamId: string | null;
  clientAccountId: string | null;
  ownerId: string | null;
  startDate: string | null;
  dueDate: string | null;
  status: 'active' | 'paused' | 'completed';
  color: string;
  version: number;
}

export function ProjectDetailsForm({ org, project, clients, teams, owners }: { org: string; project: ProjectFormData; clients: { id: string; name: string }[]; teams: { id: string; name: string }[]; owners: { id: string; name: string }[] }) {
  const t = useTranslations('projects');
  const tc = useTranslations('common');
  const tv = useTranslations('enums.visibility');
  const ts = useTranslations('enums.projectStatus');
  const router = useRouter();
  const { call, pending, fieldErrors, formError } = useAction();
  const [form, setForm] = useState(project);
  const [version, setVersion] = useState(project.version);
  const [conflict, setConflict] = useState(false);
  const [goal, setGoal] = useState('');
  useEffect(() => {
    setForm(project);
    setVersion(project.version);
  }, [project]);
  const set = <K extends keyof ProjectFormData>(k: K, v: ProjectFormData[K]) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Card>
      <CardHeader title={t('settings.details')} description={t('settings.detailsHint')} />
      <form
        noValidate
        className="flex flex-col gap-4 px-4 py-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const res = await call(
            () =>
              updateProjectAction(org, {
                projectId: project.id,
                version,
                name: form.name,
                description: form.description || null,
                goals: form.goals,
                visibility: form.visibility,
                teamId: form.visibility === 'team' ? form.teamId : null,
                clientAccountId: form.clientAccountId || null,
                ownerId: form.ownerId || null,
                startDate: form.startDate || null,
                dueDate: form.dueDate || null,
                status: form.status,
                color: form.color,
              }),
            { inlineFieldErrors: true, success: t('settings.saved') },
          );
          if (res.ok) setVersion(res.data.version);
          else if (res.error.code === 'CONFLICT') setConflict(true);
        }}
      >
        <FormError message={formError} />
        <Field label={t('new.name')} error={fieldErrors.name}>
          <Input value={form.name} onChange={(e) => set('name', e.target.value)} maxLength={80} />
        </Field>
        <Field label={t('new.descriptionLabel')} optional={tc('optional')} error={fieldErrors.description}>
          <Textarea value={form.description ?? ''} onChange={(e) => set('description', e.target.value)} maxLength={2000} />
        </Field>

        <fieldset>
          <legend className="text-[13px] font-medium text-ink">{t('settings.goals')}</legend>
          <p className="mt-0.5 text-[12px] text-ink-3">{t('settings.goalsHint')}</p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {form.goals.map((g, i) => (
              <li key={i} className="flex items-center gap-2">
                <Input
                  value={g}
                  aria-label={t('settings.goalN', { n: i + 1 })}
                  maxLength={200}
                  onChange={(e) => set('goals', form.goals.map((x, j) => (j === i ? e.target.value : x)))}
                  className="h-8 text-[13px]"
                />
                <Button size="icon-sm" variant="ghost" aria-label={t('settings.removeGoal', { n: i + 1 })} onClick={() => set('goals', form.goals.filter((_, j) => j !== i))}>
                  <X />
                </Button>
              </li>
            ))}
          </ul>
          {form.goals.length < 10 ? (
            <div className="mt-2 flex items-center gap-2">
              <Input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder={t('settings.addGoalPlaceholder')} aria-label={t('settings.addGoalPlaceholder')} maxLength={200} className="h-8 text-[13px]" />
              <Button
                size="sm"
                disabled={!goal.trim()}
                onClick={() => {
                  set('goals', [...form.goals, goal.trim()]);
                  setGoal('');
                }}
              >
                <Plus /> {t('settings.addGoal')}
              </Button>
            </div>
          ) : null}
          {fieldErrors.goals ? (
            <p role="alert" className="mt-1 text-[12px] text-danger">
              {fieldErrors.goals}
            </p>
          ) : null}
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('new.client')} optional={tc('optional')} error={fieldErrors.clientAccountId}>
            <NativeSelect value={form.clientAccountId ?? ''} onChange={(e) => set('clientAccountId', e.target.value || null)}>
              <option value="">{t('new.internalProject')}</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label={t('settings.owner')} optional={tc('optional')} error={fieldErrors.ownerId}>
            <NativeSelect value={form.ownerId ?? ''} onChange={(e) => set('ownerId', e.target.value || null)}>
              <option value="">{tc('none')}</option>
              {owners.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label={t('new.visibility')} error={fieldErrors.visibility}>
            <NativeSelect value={form.visibility} onChange={(e) => set('visibility', e.target.value as ProjectFormData['visibility'])}>
              <option value="org">{tv('org')}</option>
              {teams.length ? <option value="team">{tv('team')}</option> : null}
              <option value="private">{tv('private')}</option>
            </NativeSelect>
          </Field>
          {form.visibility === 'team' ? (
            <Field label={t('new.team')} error={fieldErrors.teamId}>
              <NativeSelect value={form.teamId ?? ''} onChange={(e) => set('teamId', e.target.value || null)}>
                <option value="">{t('new.chooseTeam')}</option>
                {teams.map((tm) => (
                  <option key={tm.id} value={tm.id}>
                    {tm.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          ) : null}
          <Field label={t('settings.status')} error={fieldErrors.status}>
            <NativeSelect value={form.status} onChange={(e) => set('status', e.target.value as ProjectFormData['status'])}>
              {(['active', 'paused', 'completed'] as const).map((s) => (
                <option key={s} value={s}>
                  {ts(s)}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label={t('new.startDate')} optional={tc('optional')} error={fieldErrors.startDate}>
            <Input type="date" value={form.startDate ?? ''} onChange={(e) => set('startDate', e.target.value || null)} />
          </Field>
          <Field label={t('new.dueDate')} optional={tc('optional')} error={fieldErrors.dueDate}>
            <Input type="date" value={form.dueDate ?? ''} onChange={(e) => set('dueDate', e.target.value || null)} />
          </Field>
        </div>

        <fieldset>
          <legend className="text-[13px] font-medium text-ink">{t('settings.color')}</legend>
          <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label={t('settings.color')}>
            {COLORS.map((c) => (
              <label key={c} className={cn('flex size-8 cursor-pointer items-center justify-center rounded-md border has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent/40', form.color === c ? 'border-ink' : 'border-line')}>
                <input type="radio" name="color" value={c} checked={form.color === c} onChange={() => set('color', c)} className="sr-only" />
                <span className="size-4 rounded-[3px]" style={{ background: toneInk(c) }} aria-hidden />
                <span className="sr-only">{t(`settings.colorName.${c}`)}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex items-center gap-2">
          <Button type="submit" variant="primary" loading={pending}>
            {tc('saveChanges')}
          </Button>
        </div>
      </form>

      <Dialog open={conflict} onOpenChange={setConflict}>
        <DialogContent title={t('settings.conflictTitle')} description={t('settings.conflictBody')} size="sm">
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConflict(false)}>
              {tc('cancel')}
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setConflict(false);
                router.refresh();
              }}
            >
              {t('settings.reload')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
