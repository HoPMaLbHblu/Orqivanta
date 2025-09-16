'use client';

import { Check, Plus } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { createProjectAction, suggestKeyAction } from '@/actions/projects';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Field, FormError } from '@/components/ui/field';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { cn } from '@/lib/cn';
import { useAction } from '@/lib/use-action';

export interface TemplateOption {
  id: string;
  name: string;
  description: string;
  milestones: number;
  tasks: number;
}

export function NewProjectButton({ org, templates, clients, teams, openInitially }: { org: string; templates: TemplateOption[]; clients: { id: string; name: string }[]; teams: { id: string; name: string }[]; openInitially?: boolean }) {
  const t = useTranslations('projects');
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [open, setOpen] = useState(Boolean(openInitially));
  useEffect(() => {
    if (sp.get('new') === '1') setOpen(true);
  }, [sp]);
  const onOpenChange = (o: boolean) => {
    setOpen(o);
    if (!o && sp.get('new')) {
      const next = new URLSearchParams(sp.toString());
      next.delete('new');
      router.replace(next.size ? `${pathname}?${next}` : pathname, { scroll: false });
    }
  };
  return (
    <>
      <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
        <Plus /> {t('newProject')}
      </Button>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent title={t('new.title')} description={t('new.description')} size="lg">
          {open ? <NewProjectForm org={org} templates={templates} clients={clients} teams={teams} onDone={() => onOpenChange(false)} /> : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function NewProjectForm({ org, templates, clients, teams, onDone }: { org: string; templates: TemplateOption[]; clients: { id: string; name: string }[]; teams: { id: string; name: string }[]; onDone: () => void }) {
  const t = useTranslations('projects');
  const tc = useTranslations('common');
  const tv = useTranslations('enums.visibility');
  const router = useRouter();
  const { call, pending, fieldErrors, formError } = useAction();
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const keyTouched = useRef(false);
  const [template, setTemplate] = useState('blank');
  const [clientId, setClientId] = useState('');
  const [visibility, setVisibility] = useState<'org' | 'team' | 'private'>('org');
  const [teamId, setTeamId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (keyTouched.current) return;
    if (!name.trim()) {
      setKey('');
      return;
    }
    let live = true;
    const id = setTimeout(async () => {
      const k = await suggestKeyAction(name);
      if (live && !keyTouched.current) setKey(k);
    }, 200);
    return () => {
      live = false;
      clearTimeout(id);
    };
  }, [name]);

  const tplLabel = (tpl: TemplateOption) => (t.has(`templates.${tpl.id}.name`) ? t(`templates.${tpl.id}.name`) : tpl.name);
  const tplDesc = (tpl: TemplateOption) => (t.has(`templates.${tpl.id}.description`) ? t(`templates.${tpl.id}.description`) : tpl.description);

  return (
    <form
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        const res = await call(
          () =>
            createProjectAction(org, {
              name,
              key,
              templateId: template,
              clientAccountId: clientId || null,
              visibility,
              teamId: visibility === 'team' ? teamId || null : null,
              startDate: startDate || null,
              dueDate: dueDate || null,
              description: description || null,
            }),
          { inlineFieldErrors: true, refresh: false, success: t('new.created') },
        );
        if (res.ok) {
          onDone();
          router.push(`/${org}/projects/${res.data.key}`);
        }
      }}
      className="flex flex-col gap-4"
    >
      <FormError message={formError} />
      <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
        <Field label={t('new.name')} error={fieldErrors.name}>
          <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus maxLength={80} placeholder={t('new.namePlaceholder')} />
        </Field>
        <Field label={t('new.key')} hint={t('new.keyHint')} error={fieldErrors.key}>
          <Input
            value={key}
            onChange={(e) => {
              keyTouched.current = true;
              setKey(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6));
            }}
            className="font-mono uppercase"
            maxLength={6}
            spellCheck={false}
            autoCapitalize="characters"
          />
        </Field>
      </div>

      <fieldset>
        <legend className="text-[13px] font-medium text-ink">{t('new.template')}</legend>
        <div className="mt-1.5 grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label={t('new.template')}>
          {templates.map((tpl) => (
            <label key={tpl.id} className={cn('relative flex cursor-pointer flex-col gap-0.5 rounded-lg border p-3 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent/30', template === tpl.id ? 'border-accent bg-accent-soft/40' : 'border-line hover:border-line-strong')}>
              <input type="radio" name="template" value={tpl.id} checked={template === tpl.id} onChange={() => setTemplate(tpl.id)} className="sr-only" />
              <span className="flex items-center gap-1.5 text-[13px] font-medium text-ink">
                {tplLabel(tpl)}
                {template === tpl.id ? <Check className="ml-auto size-4 text-accent" aria-hidden /> : null}
              </span>
              <span className="text-[12px] text-ink-3">{tplDesc(tpl)}</span>
              {tpl.tasks || tpl.milestones ? <span className="mt-1 text-[11px] text-ink-3">{t('new.templateContents', { tasks: tpl.tasks, milestones: tpl.milestones })}</span> : null}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('new.client')} optional={tc('optional')} hint={clients.length ? t('new.clientHint') : t('new.noClients')} error={fieldErrors.clientAccountId}>
          <NativeSelect value={clientId} onChange={(e) => setClientId(e.target.value)} disabled={!clients.length}>
            <option value="">{t('new.internalProject')}</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label={t('new.visibility')} error={fieldErrors.visibility}>
          <NativeSelect value={visibility} onChange={(e) => setVisibility(e.target.value as typeof visibility)}>
            <option value="org">{tv('org')}</option>
            {teams.length ? <option value="team">{tv('team')}</option> : null}
            <option value="private">{tv('private')}</option>
          </NativeSelect>
        </Field>
        {visibility === 'team' ? (
          <Field label={t('new.team')} error={fieldErrors.teamId}>
            <NativeSelect value={teamId} onChange={(e) => setTeamId(e.target.value)}>
              <option value="">{t('new.chooseTeam')}</option>
              {teams.map((tm) => (
                <option key={tm.id} value={tm.id}>
                  {tm.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
        ) : null}
        <Field label={t('new.startDate')} optional={tc('optional')} error={fieldErrors.startDate}>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </Field>
        <Field label={t('new.dueDate')} optional={tc('optional')} error={fieldErrors.dueDate}>
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </Field>
      </div>
      <Field label={t('new.descriptionLabel')} optional={tc('optional')} error={fieldErrors.description}>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} className="min-h-20" />
      </Field>
      <DialogFooter className="mt-1">
        <Button variant="ghost" onClick={onDone} disabled={pending}>
          {tc('cancel')}
        </Button>
        <Button type="submit" variant="primary" loading={pending}>
          {t('new.submit')}
        </Button>
      </DialogFooter>
    </form>
  );
}
