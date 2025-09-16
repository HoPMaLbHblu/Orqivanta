'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Stamp } from 'lucide-react';
import { createApprovalAction, listReviewerCandidatesAction } from '@/actions/documents';
import { Avatar } from '@/components/domain/avatar';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Field, FormError } from '@/components/ui/field';
import { Input, Textarea } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/primitives';
import { cn } from '@/lib/cn';
import { useAction } from '@/lib/use-action';

/**
 * What is being sent for review. A document is frozen into a version snapshot by the server
 * when the review is created; a file review always pins one exact file version.
 */
export type ApprovalTarget =
  | { type: 'document'; projectId: string; documentId: string; title: string }
  | { type: 'file'; projectId: string; fileId: string; fileVersionId: string; title: string; version: number };

type Candidate = { id: string; name: string; email: string; avatarColor: string | null; role: string };

export function RequestApprovalDialog({
  org,
  open,
  onOpenChange,
  target,
  sharedWithClient,
  currentUserId,
  beforeSubmit,
}: {
  org: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  target: ApprovalTarget;
  /** Client contacts can only review items that are shared with them. */
  sharedWithClient: boolean;
  currentUserId?: string;
  /** Runs first (for example, to save pending document edits); return false to stop. */
  beforeSubmit?: () => Promise<boolean>;
}) {
  const t = useTranslations('documents.approval');
  const tc = useTranslations('common');
  const tr = useTranslations('enums.rule');
  const tRole = useTranslations('enums.projectRole');
  const router = useRouter();
  const { call, pending, fieldErrors, formError, setFormError } = useAction();
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [reviewers, setReviewers] = useState<string[]>([]);
  const [rule, setRule] = useState<'all' | 'any'>('all');
  const [due, setDue] = useState('');
  const [busy, setBusy] = useState(false);

  const subjectLabel = target.type === 'file' ? `${target.title} (v${target.version})` : target.title;

  useEffect(() => {
    if (!open) return;
    setTitle(t('defaultTitle', { name: target.title }));
    setInstructions('');
    setReviewers([]);
    setRule('all');
    setDue('');
    setFormError(null);
    setCandidates(null);
    setLoadError(null);
    let live = true;
    listReviewerCandidatesAction(org, target.projectId)
      .then((res) => {
        if (!live) return;
        if (res.ok) setCandidates(res.data);
        else setLoadError(res.error.message);
      })
      .catch(() => live && setLoadError(t('loadFailed')));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, org, target.projectId]);

  const team = (candidates ?? []).filter((c) => c.role !== 'client');
  const clients = (candidates ?? []).filter((c) => c.role === 'client');
  const today = new Date().toISOString().slice(0, 10);

  function toggle(id: string, on: boolean) {
    setReviewers((cur) => (on ? [...cur, id] : cur.filter((x) => x !== id)));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (beforeSubmit && !(await beforeSubmit())) return;
      const subject = target.type === 'document' ? { documentId: target.documentId } : { fileId: target.fileId, fileVersionId: target.fileVersionId };
      const res = await call(() => createApprovalAction(org, { projectId: target.projectId, title, instructions: instructions.trim() || null, reviewerIds: reviewers, rule, dueDate: due || null, ...subject }), { inlineFieldErrors: true });
      if (res.ok) {
        onOpenChange(false);
        toast.success(t('created'), { action: { label: t('open'), onClick: () => router.push(`/${org}/approvals/${res.data.id}`) } });
      }
    } finally {
      setBusy(false);
    }
  }

  const renderPerson = (c: Candidate, disabled: boolean) => {
    const id = `reviewer-${c.id}`;
    return (
      <li key={c.id}>
        <label htmlFor={id} className={cn('flex items-center gap-2.5 rounded-md px-2 py-1.5', disabled ? 'opacity-60' : 'cursor-pointer hover:bg-surface-2')}>
          <Checkbox id={id} checked={reviewers.includes(c.id)} onCheckedChange={(v) => toggle(c.id, v)} disabled={disabled} />
          <Avatar name={c.name} color={c.avatarColor} size="xs" title="" />
          <span className="min-w-0 flex-1 truncate text-[13px] text-ink">
            {c.name}
            {c.id === currentUserId ? <span className="text-ink-3"> ({tc('you')})</span> : null}
          </span>
          <span className="shrink-0 text-[12px] text-ink-3">{tRole(c.role as 'manager')}</span>
        </label>
      </li>
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent title={t('title')} description={target.type === 'document' ? t('descriptionDocument', { name: subjectLabel }) : t('descriptionFile', { name: subjectLabel })} size="lg">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <FormError message={formError ?? fieldErrors.subject} />
          <Field label={t('reviewTitle')} error={fieldErrors.title}>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required />
          </Field>
          <fieldset aria-describedby={fieldErrors.reviewerIds ? 'reviewers-error' : undefined}>
            <legend className="mb-1.5 text-[13px] font-medium text-ink">{t('reviewers')}</legend>
            <div className="max-h-56 overflow-y-auto rounded-lg border border-line p-1">
              {loadError ? (
                <p className="px-2 py-3 text-[13px] text-danger" role="alert">
                  {loadError}
                </p>
              ) : !candidates ? (
                <div className="flex flex-col gap-2 p-2" aria-busy="true">
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="h-5 w-1/2" />
                  <Skeleton className="h-5 w-3/5" />
                </div>
              ) : (
                <>
                  <p className="px-2 pt-1.5 pb-1 text-[11px] font-medium tracking-wide text-ink-3 uppercase">{t('team')}</p>
                  <ul>{team.map((c) => renderPerson(c, false))}</ul>
                  {clients.length ? (
                    <>
                      <p className="px-2 pt-2.5 pb-1 text-[11px] font-medium tracking-wide text-ink-3 uppercase">{t('clientContacts')}</p>
                      {!sharedWithClient ? <p className="px-2 pb-1 text-[12px] text-ink-3">{t('shareFirst')}</p> : null}
                      <ul>{clients.map((c) => renderPerson(c, !sharedWithClient))}</ul>
                    </>
                  ) : null}
                </>
              )}
            </div>
            {fieldErrors.reviewerIds ? (
              <p id="reviewers-error" role="alert" className="mt-1.5 text-[12px] text-danger">
                {fieldErrors.reviewerIds}
              </p>
            ) : null}
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_180px]">
            <fieldset>
              <legend className="mb-1.5 text-[13px] font-medium text-ink">{t('rule')}</legend>
              <div className="flex flex-col gap-1.5" role="radiogroup">
                {(['all', 'any'] as const).map((r) => (
                  <label key={r} className="flex cursor-pointer items-center gap-2 text-[13px] text-ink">
                    <input type="radio" name="rule" value={r} checked={rule === r} onChange={() => setRule(r)} className="accent-[var(--accent)]" />
                    {tr(r)}
                  </label>
                ))}
              </div>
            </fieldset>
            <Field label={t('due')} optional={tc('optional')} error={fieldErrors.dueDate}>
              <Input type="date" value={due} min={today} onChange={(e) => setDue(e.target.value)} />
            </Field>
          </div>
          <Field label={t('instructions')} optional={tc('optional')} error={fieldErrors.instructions}>
            <Textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} maxLength={2000} placeholder={t('instructionsPlaceholder')} className="min-h-20" />
          </Field>
          <p className="text-[12px] text-ink-3">{target.type === 'document' ? t('pinnedDocument') : t('pinnedFile', { version: target.version })}</p>
          <DialogFooter>
            <Link href={`/${org}/approvals`} className="mr-auto text-[12px] text-ink-3 hover:text-ink hover:underline">
              {t('allApprovals')}
            </Link>
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
              {tc('cancel')}
            </Button>
            <Button type="submit" variant="primary" loading={busy || pending} disabled={!reviewers.length || !title.trim()}>
              <Stamp /> {t('submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
