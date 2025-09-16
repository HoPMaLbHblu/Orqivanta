'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { moveDocumentAction, saveCollectionAction } from '@/actions/documents';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Field, FormError } from '@/components/ui/field';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { useAction } from '@/lib/use-action';
import type { BrowserCollection, BrowserProject } from './browser';
import { WORKSPACE } from './new-document-dialog';

/** Create a collection (choosing where it lives) or rename/describe an existing one. */
export function CollectionDialog({ org, open, onOpenChange, collection, projects, canCreateWorkspace, defaultProjectId }: { org: string; open: boolean; onOpenChange: (o: boolean) => void; collection?: BrowserCollection | null; projects: BrowserProject[]; canCreateWorkspace: boolean; defaultProjectId?: string | null }) {
  const t = useTranslations('documents.collection');
  const tc = useTranslations('common');
  const { call, pending, fieldErrors, formError } = useAction();
  const targets = projects.filter((p) => p.canCreate);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');

  useEffect(() => {
    if (!open) return;
    setName(collection?.name ?? '');
    setDescription(collection?.description ?? '');
    const fallback = defaultProjectId && targets.some((p) => p.id === defaultProjectId) ? defaultProjectId : canCreateWorkspace ? WORKSPACE : (targets[0]?.id ?? '');
    setLocation(collection ? (collection.projectId ?? WORKSPACE) : fallback);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, collection]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await call(
      () =>
        saveCollectionAction(org, {
          collectionId: collection?.id,
          projectId: location === WORKSPACE ? null : location,
          name,
          description: description.trim() || null,
        }),
      { inlineFieldErrors: true, success: collection ? t('renamed') : t('created') },
    );
    if (res.ok) onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={collection ? t('editTitle') : t('newTitle')} description={collection ? undefined : t('newDescription')}>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <FormError message={formError} />
          <Field label={t('name')} error={fieldErrors.name}>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoFocus required />
          </Field>
          <Field label={t('descriptionLabel')} optional={tc('optional')} error={fieldErrors.description}>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={200} className="min-h-16" />
          </Field>
          {collection ? null : (
            <Field label={t('location')} hint={t('locationHint')} error={fieldErrors.projectId}>
              <NativeSelect value={location} onChange={(e) => setLocation(e.target.value)}>
                {canCreateWorkspace ? <option value={WORKSPACE}>{t('workspace')}</option> : null}
                {targets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.key} · {p.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              {tc('cancel')}
            </Button>
            <Button type="submit" variant="primary" loading={pending} disabled={!location}>
              {collection ? tc('saveChanges') : tc('create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Moves a document between collections of the same project (or out of any collection). */
export function MoveDocumentDialog({ org, open, onOpenChange, doc, collections }: { org: string; open: boolean; onOpenChange: (o: boolean) => void; doc: { id: string; title: string; projectId: string | null; collectionId: string | null } | null; collections: BrowserCollection[] }) {
  const t = useTranslations('documents.move');
  const tc = useTranslations('common');
  const { call, pending, fieldErrors } = useAction();
  const [target, setTarget] = useState('');
  useEffect(() => {
    if (open) setTarget(doc?.collectionId ?? '');
  }, [open, doc]);
  if (!doc) return null;
  const options = collections.filter((c) => (c.projectId ?? null) === (doc.projectId ?? null));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await call(() => moveDocumentAction(org, { documentId: doc!.id, collectionId: target || null }), { success: t('moved') });
    if (res.ok) onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={t('title', { name: doc.title })} description={t('description')} size="sm">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field label={t('collection')} error={fieldErrors.collectionId} hint={options.length ? undefined : t('none')}>
            <NativeSelect value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="">{t('noCollection')}</option>
              {options.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <DialogFooter>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              {tc('cancel')}
            </Button>
            <Button type="submit" variant="primary" loading={pending} disabled={target === (doc.collectionId ?? '')}>
              {t('submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
