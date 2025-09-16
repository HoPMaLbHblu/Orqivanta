'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { ClipboardList, FileText, Gavel, Lightbulb, ScrollText, type LucideIcon } from 'lucide-react';
import { createDocumentAction } from '@/actions/documents';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Field, FormError } from '@/components/ui/field';
import { Input, NativeSelect } from '@/components/ui/input';
import { cn } from '@/lib/cn';
import { useAction } from '@/lib/use-action';
import type { BrowserCollection, BrowserProject } from './browser';

const TEMPLATES: { id: 'blank' | 'meeting_notes' | 'spec' | 'decision' | 'brief'; icon: LucideIcon }[] = [
  { id: 'blank', icon: FileText },
  { id: 'meeting_notes', icon: ClipboardList },
  { id: 'spec', icon: ScrollText },
  { id: 'decision', icon: Gavel },
  { id: 'brief', icon: Lightbulb },
];

/** Value used for workspace pages (documents that belong to no project). */
export const WORKSPACE = 'workspace';

export function NewDocumentDialog({ org, open, onOpenChange, projects, collections, canCreateWorkspace, defaultProjectId, defaultCollectionId }: { org: string; open: boolean; onOpenChange: (o: boolean) => void; projects: BrowserProject[]; collections: BrowserCollection[]; canCreateWorkspace: boolean; defaultProjectId?: string | null; defaultCollectionId?: string | null }) {
  const t = useTranslations('documents.new');
  const tc = useTranslations('common');
  const router = useRouter();
  const { call, pending, fieldErrors, formError } = useAction();
  const targets = projects.filter((p) => p.canCreate);
  const initialProject = defaultProjectId && targets.some((p) => p.id === defaultProjectId) ? defaultProjectId : canCreateWorkspace ? WORKSPACE : (targets[0]?.id ?? '');
  const [project, setProject] = useState(initialProject);
  const [collection, setCollection] = useState(defaultCollectionId ?? '');
  const [template, setTemplate] = useState<(typeof TEMPLATES)[number]['id']>('blank');
  const [title, setTitle] = useState('');

  useEffect(() => {
    if (open) {
      setProject(initialProject);
      setCollection(defaultCollectionId ?? '');
      setTemplate('blank');
      setTitle('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const projectId = project === WORKSPACE ? null : project || null;
  const available = collections.filter((c) => (c.projectId ?? null) === projectId && c.canEdit);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await call(() => createDocumentAction(org, { title: title.trim() || undefined, projectId, collectionId: collection || null, template }), { inlineFieldErrors: true, refresh: false });
    if (res.ok) {
      onOpenChange(false);
      router.push(`/${org}/documents/${res.data.id}`);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={t('title')} description={t('description')} size="lg">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <FormError message={formError} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('project')} error={fieldErrors.projectId}>
              <NativeSelect
                value={project}
                onChange={(e) => {
                  setProject(e.target.value);
                  setCollection('');
                }}
              >
                {canCreateWorkspace ? <option value={WORKSPACE}>{t('workspace')}</option> : null}
                {targets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.key} · {p.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label={t('collection')} error={fieldErrors.collectionId} hint={available.length ? undefined : t('noCollections')}>
              <NativeSelect value={collection} onChange={(e) => setCollection(e.target.value)} disabled={!available.length}>
                <option value="">{t('noCollection')}</option>
                {available.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </div>
          <fieldset>
            <legend className="mb-1.5 text-[13px] font-medium text-ink">{t('template')}</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5" role="radiogroup" aria-label={t('template')}>
              {TEMPLATES.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  role="radio"
                  aria-checked={template === tpl.id}
                  onClick={() => setTemplate(tpl.id)}
                  className={cn('flex flex-col items-start gap-1.5 rounded-lg border px-3 py-2.5 text-left transition-colors', template === tpl.id ? 'border-accent bg-accent-soft/60' : 'border-line hover:border-line-strong hover:bg-surface-2')}
                >
                  <tpl.icon className={cn('size-4', template === tpl.id ? 'text-accent' : 'text-ink-3')} aria-hidden />
                  <span className="text-[13px] font-medium text-ink">{t(`templates.${tpl.id}`)}</span>
                </button>
              ))}
            </div>
          </fieldset>
          <Field label={t('docTitle')} optional={tc('optional')} hint={t('titleHint')} error={fieldErrors.title}>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder={t(`defaultTitles.${template}`)} />
          </Field>
          <DialogFooter>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              {tc('cancel')}
            </Button>
            <Button type="submit" variant="primary" loading={pending} disabled={!project}>
              {t('create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
