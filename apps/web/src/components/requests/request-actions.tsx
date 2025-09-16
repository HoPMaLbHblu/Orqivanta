'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Ban, CheckCircle2, CircleHelp, Copy, Eye, FolderKanban, Search, SquareCheck, ThumbsUp } from 'lucide-react';
import type { RequestStatus } from '@/components/domain/badges';
import { RequestStatusBadge, type Priority } from '@/components/domain/badges';
import { askForInformationAction, convertRequestToProjectAction, convertRequestToTaskAction, markDuplicateAction, searchRequestsAction, triageRequestAction } from '@/actions/requests';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Field, FormError } from '@/components/ui/field';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { Card, CardHeader } from '@/components/ui/primitives';
import { useAction } from '@/lib/use-action';

/**
 * Every write bumps the request's version; the server rejects a stale one. Each panel keeps
 * the newest version it has seen (from props, or from the action it just ran).
 */
function useVersion(initial: number) {
  const [version, setVersion] = useState(initial);
  useEffect(() => setVersion((v) => (initial > v ? initial : v)), [initial]);
  return [version, setVersion] as const;
}

interface TriageRequest {
  id: string;
  version: number;
  status: RequestStatus;
  hasClient: boolean;
  converted: boolean;
}

/** Status moves. "Needs info" and "Decline" always carry a written explanation. */
export function TriagePanel({ org, request }: { org: string; request: TriageRequest }) {
  const t = useTranslations('requests.triage');
  const { call, pending, fieldErrors, formError, setFormError } = useAction();
  const [dialog, setDialog] = useState<'needs_info' | 'declined' | null>(null);
  const [message, setMessage] = useState('');
  const [version, setVersion] = useVersion(request.version);

  const move = async (status: RequestStatus) => {
    const res = await call(() => triageRequestAction(org, { requestId: request.id, version, status }), { success: t('moved') });
    if (res.ok) setVersion(res.data.version);
    return res;
  };

  const submitDialog = async () => {
    if (!message.trim()) {
      setFormError(t(dialog === 'declined' ? 'reasonRequired' : 'messageRequired'));
      return;
    }
    if (dialog === 'needs_info') {
      const res = await call(() => askForInformationAction(org, { requestId: request.id, message: message.trim() }), { success: t('askedForInfo'), inlineFieldErrors: true });
      if (res.ok) {
        setVersion(res.data.version);
        setDialog(null);
        setMessage('');
      }
      return;
    }
    const res = await call(() => triageRequestAction(org, { requestId: request.id, version, status: 'declined', closureReason: message.trim() }), { success: t('declined'), inlineFieldErrors: true });
    if (res.ok) {
      setVersion(res.data.version);
      setDialog(null);
      setMessage('');
    }
  };

  const open = !['completed', 'declined', 'duplicate'].includes(request.status);
  const actions: { status: RequestStatus; icon: typeof Eye; label: string; variant?: 'primary' | 'secondary' }[] = [];
  if (open) {
    if (request.status === 'submitted') actions.push({ status: 'in_review', icon: Eye, label: t('startReview'), variant: 'primary' });
    if (request.status !== 'accepted' && request.status !== 'in_progress') actions.push({ status: 'accepted', icon: ThumbsUp, label: t('accept'), variant: request.status === 'submitted' ? 'secondary' : 'primary' });
    if (request.status !== 'in_review' && request.status !== 'submitted') actions.push({ status: 'in_review', icon: Eye, label: t('backToReview') });
    actions.push({ status: 'completed', icon: CheckCircle2, label: t('complete') });
  }

  return (
    <Card>
      <CardHeader title={t('title')} description={t('hint')} />
      <div className="flex flex-col gap-2 px-4 py-3">
        <div className="flex items-center justify-between gap-2 text-[13px]">
          <span className="text-ink-3">{t('current')}</span>
          <RequestStatusBadge status={request.status} />
        </div>
        {open ? (
          <div className="mt-1 flex flex-wrap gap-2">
            {actions.map((a) => (
              <Button key={a.label} size="sm" variant={a.variant ?? 'secondary'} loading={pending} onClick={() => move(a.status)}>
                <a.icon /> {a.label}
              </Button>
            ))}
            <Button size="sm" variant="secondary" onClick={() => { setMessage(''); setDialog('needs_info'); }}>
              <CircleHelp /> {t('needsInfo')}
            </Button>
            <Button size="sm" variant="danger-ghost" onClick={() => { setMessage(''); setDialog('declined'); }}>
              <Ban /> {t('decline')}
            </Button>
          </div>
        ) : (
          <p className="text-[12px] text-ink-3">{t('closedHint')}</p>
        )}
      </div>

      <Dialog open={dialog !== null} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent title={dialog === 'declined' ? t('declineTitle') : t('needsInfoTitle')} description={dialog === 'declined' ? t('declineBody') : request.hasClient ? t('needsInfoBody') : t('needsInfoBodyInternal')}>
          <Field label={dialog === 'declined' ? t('reasonLabel') : t('messageLabel')} error={fieldErrors.closureReason}>
            <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} maxLength={2000} autoFocus />
          </Field>
          <FormError message={formError} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialog(null)}>
              {t('cancel')}
            </Button>
            <Button variant={dialog === 'declined' ? 'danger' : 'primary'} loading={pending} onClick={submitDialog}>
              {dialog === 'declined' ? t('decline') : t('sendAndWait')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/** Owner, priority, due date and project — saved one field at a time. */
export function PropertiesPanel({ org, request, people, projects, currentProject }: { org: string; request: { id: string; version: number; ownerId: string | null; priority: Priority; dueDate: string | null; projectId: string | null }; people: { id: string; name: string }[]; projects: { id: string; key: string; name: string }[]; currentProject: { id: string; key: string; name: string } | null }) {
  const t = useTranslations('requests.properties');
  const te = useTranslations('enums.priority');
  const { call, pending } = useAction();
  const [version, setVersion] = useVersion(request.version);
  const patch = async (input: Record<string, unknown>) => {
    const res = await call(() => triageRequestAction(org, { requestId: request.id, version, ...input }), { success: t('saved') });
    if (res.ok) setVersion(res.data.version);
  };
  const projectList = currentProject && !projects.some((p) => p.id === currentProject.id) ? [...projects, currentProject] : projects;

  return (
    <Card>
      <CardHeader title={t('title')} />
      <div className="flex flex-col gap-3 px-4 py-3">
        <Field label={t('owner')}>
          <NativeSelect value={request.ownerId ?? ''} disabled={pending} onChange={(e) => patch({ ownerId: e.target.value || null })}>
            <option value="">{t('unassigned')}</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label={t('priority')}>
          <NativeSelect value={request.priority} disabled={pending} onChange={(e) => patch({ priority: e.target.value })}>
            {(['none', 'low', 'medium', 'high', 'urgent'] as const).map((p) => (
              <option key={p} value={p}>
                {te(p)}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label={t('dueDate')}>
          <Input type="date" value={request.dueDate ?? ''} disabled={pending} onChange={(e) => patch({ dueDate: e.target.value })} />
        </Field>
        <Field label={t('project')} hint={t('projectHint')}>
          <NativeSelect value={request.projectId ?? ''} disabled={pending} onChange={(e) => patch({ projectId: e.target.value || null })}>
            <option value="">{t('noProject')}</option>
            {projectList.map((p) => (
              <option key={p.id} value={p.id}>
                {p.key} · {p.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>
    </Card>
  );
}

/** Convert to a task in a project, or start a new project from the request. */
export function ConvertPanel({ org, request, convertedTask, convertedProject, closed, projects, people, templates }: { org: string; request: { id: string; title: string; dueDate: string | null; projectId: string | null; hasClient: boolean; ownerId: string | null }; convertedTask: { ref: string; title: string } | null; convertedProject: { key: string; name: string } | null; closed: boolean; projects: { id: string; key: string; name: string }[]; people: { id: string; name: string }[]; templates: { id: string; name: string }[] }) {
  const t = useTranslations('requests.convert');
  const router = useRouter();
  const { call, pending, fieldErrors, formError } = useAction();
  const [mode, setMode] = useState<'task' | 'project' | null>(null);
  const [projectId, setProjectId] = useState(request.projectId ?? projects[0]?.id ?? '');
  const [title, setTitle] = useState(request.title);
  const [assigneeId, setAssigneeId] = useState(request.ownerId ?? '');
  const [dueDate, setDueDate] = useState(request.dueDate ?? '');
  const [share, setShare] = useState(true);
  const [name, setName] = useState(request.title.slice(0, 80));
  const [key, setKey] = useState('');
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? 'blank');

  const done = Boolean(convertedTask || convertedProject);

  const submitTask = async () => {
    const res = await call(() => convertRequestToTaskAction(org, { requestId: request.id, projectId, title, assigneeId: assigneeId || null, dueDate, shareWithClient: share && request.hasClient }), { success: t('convertedTask'), inlineFieldErrors: true, refresh: false });
    if (res.ok) {
      setMode(null);
      router.push(res.data.href);
    }
  };

  const submitProject = async () => {
    const res = await call(() => convertRequestToProjectAction(org, { requestId: request.id, name, key: key.toUpperCase(), templateId }), { success: t('convertedProject'), inlineFieldErrors: true, refresh: false });
    if (res.ok) {
      setMode(null);
      router.push(`/${org}/projects/${res.data.key}`);
    }
  };

  return (
    <Card>
      <CardHeader title={t('title')} description={done ? undefined : t('hint')} />
      <div className="flex flex-col gap-2 px-4 py-3">
        {convertedTask ? (
          <p className="text-[13px] text-ink-2">
            {t('alreadyTask')}{' '}
            <Link href={`/${org}/tasks/${convertedTask.ref}`} className="font-mono text-[12px] text-accent hover:underline">
              {convertedTask.ref}
            </Link>
          </p>
        ) : convertedProject ? (
          <p className="text-[13px] text-ink-2">
            {t('alreadyProject')}{' '}
            <Link href={`/${org}/projects/${convertedProject.key}`} className="font-medium text-accent hover:underline">
              {convertedProject.name}
            </Link>
          </p>
        ) : closed ? (
          <p className="text-[12px] text-ink-3">{t('closedHint')}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" disabled={!projects.length} onClick={() => setMode('task')}>
              <SquareCheck /> {t('toTask')}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setMode('project')}>
              <FolderKanban /> {t('toProject')}
            </Button>
          </div>
        )}
        {!done && !closed && !projects.length ? <p className="text-[12px] text-ink-3">{t('noProjects')}</p> : null}
      </div>

      <Dialog open={mode === 'task'} onOpenChange={(o) => !o && setMode(null)}>
        <DialogContent title={t('taskTitle')} description={t('taskBody')}>
          <div className="flex flex-col gap-4">
            <Field label={t('project')} error={fieldErrors.projectId}>
              <NativeSelect value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.key} · {p.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label={t('taskName')} error={fieldErrors.title}>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={300} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('assignee')} error={fieldErrors.assigneeId}>
                <NativeSelect value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
                  <option value="">{t('unassigned')}</option>
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label={t('dueDate')} error={fieldErrors.dueDate}>
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </Field>
            </div>
            {request.hasClient ? (
              <label className="flex items-start gap-2 text-[13px] text-ink">
                <input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} className="mt-0.5 size-4 accent-[var(--accent)]" />
                <span>
                  {t('share')}
                  <span className="block text-[12px] text-ink-3">{t('shareHint')}</span>
                </span>
              </label>
            ) : null}
            <p className="text-[12px] text-ink-3">{t('keepsContext')}</p>
            <FormError message={formError} />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setMode(null)}>
              {t('cancel')}
            </Button>
            <Button variant="primary" loading={pending} onClick={submitTask}>
              {t('createTask')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={mode === 'project'} onOpenChange={(o) => !o && setMode(null)}>
        <DialogContent title={t('projectTitle')} description={t('projectBody')}>
          <div className="flex flex-col gap-4">
            <Field label={t('projectName')} error={fieldErrors.name}>
              <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
            </Field>
            <Field label={t('projectKey')} hint={t('projectKeyHint')} error={fieldErrors.key}>
              <Input value={key} onChange={(e) => setKey(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))} className="font-mono sm:w-32" />
            </Field>
            <Field label={t('template')} error={fieldErrors.templateId}>
              <NativeSelect value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
                {templates.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <FormError message={formError} />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setMode(null)}>
              {t('cancel')}
            </Button>
            <Button variant="primary" loading={pending} onClick={submitProject}>
              {t('createProject')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/** Marks this request as a duplicate of another, found by number or words. */
export function DuplicatePanel({ org, request, similar }: { org: string; request: { id: string; number: number }; similar: { id: string; number: number; title: string; status: RequestStatus }[] }) {
  const t = useTranslations('requests.duplicate');
  const { call, pending, fieldErrors } = useAction();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<{ id: string; number: number; title: string; status: RequestStatus }[]>([]);
  const [searched, setSearched] = useState(false);
  const [chosen, setChosen] = useState<{ number: number; title: string } | null>(null);
  const [confirm, setConfirm] = useState(false);

  const runSearch = async () => {
    const res = await call(() => searchRequestsAction(org, q), { refresh: false });
    if (res.ok) {
      setResults(res.data.filter((r) => r.number !== request.number) as typeof results);
      setSearched(true);
    }
  };

  const choices = searched ? results : similar;

  return (
    <Card>
      <CardHeader title={t('title')} description={t('hint')} />
      <div className="px-4 py-3">
        {similar.length && !open ? (
          <ul className="mb-3 flex flex-col gap-1.5">
            {similar.slice(0, 3).map((s) => (
              <li key={s.id} className="flex items-center gap-2 text-[13px]">
                <Link href={`/${org}/requests/${s.number}`} className="min-w-0 flex-1 truncate text-ink-2 hover:text-ink hover:underline">
                  <span className="font-mono text-[12px] text-ink-3">#{s.number}</span> {s.title}
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
        <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
          <Copy /> {t('mark')}
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title={t('dialogTitle')} description={t('dialogBody')}>
          <div className="flex flex-col gap-3">
            <div className="flex items-end gap-2">
              <Field label={t('search')} className="flex-1" error={fieldErrors.duplicateOfNumber}>
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={t('searchPlaceholder')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void runSearch();
                    }
                  }}
                />
              </Field>
              <Button size="md" variant="secondary" loading={pending} onClick={runSearch}>
                <Search /> {t('find')}
              </Button>
            </div>
            {choices.length ? (
              <ul className="divide-y divide-line rounded-md border border-line">
                {choices.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] hover:bg-surface-2"
                      onClick={() => {
                        setChosen({ number: s.number, title: s.title });
                        setConfirm(true);
                      }}
                    >
                      <span className="font-mono text-[12px] text-ink-3">#{s.number}</span>
                      <span className="min-w-0 flex-1 truncate text-ink">{s.title}</span>
                      <RequestStatusBadge status={s.status} />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13px] text-ink-3">{searched ? t('noResults') : t('searchPrompt')}</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        tone="primary"
        title={t('confirmTitle', { number: chosen?.number ?? 0 })}
        description={t('confirmBody')}
        confirmLabel={t('mark')}
        onConfirm={async () => {
          const res = await call(() => markDuplicateAction(org, { requestId: request.id, duplicateOfNumber: chosen?.number }), { success: t('marked') });
          if (res.ok) setOpen(false);
          return res.ok;
        }}
      />
    </Card>
  );
}
