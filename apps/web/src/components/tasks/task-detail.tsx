'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  Ban,
  Check,
  CheckSquare,
  Copy,
  CornerDownRight,
  ExternalLink,
  Eye,
  EyeOff,
  Flag,
  Globe,
  History,
  Inbox,
  Link2,
  MoreHorizontal,
  Paperclip,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import {
  addDependencyAction,
  createTaskAction,
  deleteChecklistItemAction,
  deleteTaskAction,
  duplicateTaskAction,
  removeDependencyAction,
  restoreTaskAction,
  saveChecklistItemAction,
  setWatchingAction,
  updateTaskAction,
} from '@/actions/tasks';
import { CommentThread, type CommentView, type ThreadContext } from '@/components/comments/thread';
import { Avatar, AvatarStack } from '@/components/domain/avatar';
import { Badge, LabelChip, PriorityIcon, StatusIcon, type Priority, type StatusCategory } from '@/components/domain/badges';
import { DueDate, FormattedDate, RelativeTime } from '@/components/domain/dates';
import { FileIcon } from '@/components/files/file-icon';
import { formatBytes } from '@/components/files/format';
import { FileUploader } from '@/components/files/uploader';
import { RichTextEditor } from '@/components/rich-text/editor';
import { isEmptyDoc, RichText } from '@/components/rich-text/render';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ConfirmDialog } from '@/components/ui/confirm';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from '@/components/ui/menu';
import { Divider, Mono, Notice } from '@/components/ui/primitives';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/cn';
import { useAction } from '@/lib/use-action';
import { PRIORITY_VALUES } from './filters';
import type { PersonOption, StatusOption } from './types';

export interface TaskDetailProps {
  org: string;
  variant?: 'page' | 'panel';
  data: {
    task: {
      id: string;
      number: number;
      title: string;
      description: unknown;
      statusId: string;
      priority: Priority;
      assigneeId: string | null;
      dueDate: string | null;
      startDate: string | null;
      milestoneId: string | null;
      sharedWithClient: boolean;
      version: number;
      archivedAt: Date | null;
      deletedAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
    };
    ref: string;
    project: { id: string; key: string; name: string; archived: boolean; portalEnabled: boolean };
    access: { role: string; isClient: boolean; canEdit: boolean; canDelete: boolean; canShare: boolean };
    status: { id: string; name: string; category: StatusCategory };
    statuses: StatusOption[];
    assignee: { id: string; name: string; avatarColor: string | null } | null;
    creator: { id: string; name: string; avatarColor: string | null } | null;
    labels: { id: string; name: string; color: string }[];
    watchers: { id: string; name: string; avatarColor: string | null }[];
    isWatching: boolean;
    subtasks: { id: string; number: number; title: string; statusCategory: StatusCategory; statusName: string; assigneeName: string | null; assigneeColor: string | null; dueDate: string | null }[];
    parent: { id: string; number: number; title: string } | null;
    checklist: { id: string; text: string; done: boolean }[];
    blockedBy: { id: string; number: number; title: string; projectKey: string; statusCategory: StatusCategory }[];
    blocking: { id: string; number: number; title: string; projectKey: string; statusCategory: StatusCategory }[];
    history: { id: string; field: string; fromValue: unknown; toValue: unknown; createdAt: Date; actorName: string | null; actorColor: string | null }[];
    milestone: { id: string; name: string } | null;
    sourceRequest: { id: string; number: number; title: string } | null;
  };
  context: { people: PersonOption[]; milestones: { id: string; name: string }[]; labels: { id: string; name: string; color: string }[] };
  attachments: { id: string; name: string; mimeType: string; sizeBytes: number; currentVersion: number }[];
  thread: { comments: CommentView[]; context: ThreadContext } | null;
  viewer: { userId: string; isAdmin: boolean };
}

export function TaskDetail({ org, variant = 'page', data, context, attachments, thread, viewer }: TaskDetailProps) {
  const t = useTranslations('tasks');
  const tc = useTranslations('common');
  const te = useTranslations('enums');
  const router = useRouter();
  const { call } = useAction();
  const [version, setVersion] = useState(data.task.version);
  const [conflict, setConflict] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const canEdit = data.access.canEdit;
  const detailBase = `/${org}/tasks/${data.ref}`;

  useEffect(() => setVersion(data.task.version), [data.task.version, data.task.id]);

  /** Every field edit goes through here, so version conflicts are handled in one place. */
  const patch = async (fields: Record<string, unknown>, success?: string) => {
    const res = await call(() => updateTaskAction(org, { taskId: data.task.id, version, ...fields }), { success });
    if (res.ok) {
      setVersion(res.data.version);
      return true;
    }
    if (res.error.code === 'CONFLICT') setConflict(true);
    return false;
  };

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col', variant === 'panel' && 'overflow-hidden')}>
      <div className={cn('flex items-center gap-2 border-b border-line px-4 py-2.5', variant === 'page' && 'px-0 pt-0')}>
        {variant === 'panel' ? (
          <>
            <Link href={`/${org}/projects/${data.project.key}/tasks`} className="truncate text-[12px] text-ink-3 hover:text-ink hover:underline">
              {data.project.name}
            </Link>
            <span aria-hidden className="text-ink-3">/</span>
          </>
        ) : null}
        <Mono className="text-[12px]">{data.ref}</Mono>
        {data.task.sharedWithClient ? (
          <Badge tone="accent" icon={Globe}>
            {tc('sharedWithClient')}
          </Badge>
        ) : null}
        {data.task.archivedAt ? <Badge tone="muted">{tc('archived')}</Badge> : null}
        <div className="ml-auto flex items-center gap-1">
          {variant === 'panel' ? (
            <Button size="xs" variant="ghost" asChild>
              <Link href={detailBase}>
                <ExternalLink /> {t('detail.openFull')}
              </Link>
            </Button>
          ) : null}
          {!data.access.isClient ? (
            <Button
              size="xs"
              variant={data.isWatching ? 'secondary' : 'ghost'}
              onClick={async () => {
                await call(() => setWatchingAction(org, { taskId: data.task.id, watching: !data.isWatching }), { success: data.isWatching ? t('detail.unwatched') : t('detail.watched') });
              }}
              aria-pressed={data.isWatching}
            >
              {data.isWatching ? <Eye /> : <EyeOff />} {data.isWatching ? t('detail.watching') : t('detail.watch')}
            </Button>
          ) : null}
          <Menu>
            <MenuTrigger asChild>
              <Button size="icon-sm" variant="ghost" aria-label={tc('more')}>
                <MoreHorizontal />
              </Button>
            </MenuTrigger>
            <MenuContent align="end">
              <MenuItem
                onSelect={async () => {
                  await navigator.clipboard?.writeText(`${window.location.origin}${detailBase}`);
                  toast.success(tc('linkCopied'));
                }}
              >
                <Link2 /> {tc('copyLink')}
              </MenuItem>
              {canEdit ? (
                <MenuItem
                  onSelect={async () => {
                    const res = await call(() => duplicateTaskAction(org, data.task.id), { refresh: false });
                    if (res.ok) {
                      toast.success(t('detail.duplicated', { ref: res.data.ref }));
                      router.push(`/${org}/tasks/${res.data.ref}`);
                    }
                  }}
                >
                  <Copy /> {t('detail.duplicate')}
                </MenuItem>
              ) : null}
              {data.access.canShare && data.project.portalEnabled ? (
                <MenuItem onSelect={() => patch({ sharedWithClient: !data.task.sharedWithClient }, data.task.sharedWithClient ? t('detail.unshared') : t('detail.shared'))}>
                  <Globe /> {data.task.sharedWithClient ? t('detail.stopSharing') : t('detail.shareWithClient')}
                </MenuItem>
              ) : null}
              {data.access.canDelete ? (
                <>
                  <MenuSeparator />
                  <MenuItem danger onSelect={() => setDeleting(true)}>
                    <Trash2 /> {tc('delete')}
                  </MenuItem>
                </>
              ) : null}
            </MenuContent>
          </Menu>
        </div>
      </div>

      <div className={cn('min-h-0 flex-1 gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_260px]', variant === 'panel' ? 'overflow-y-auto px-4 py-4' : 'pt-5')}>
        <div className="flex min-w-0 flex-col gap-6">
          {data.parent ? (
            <p className="flex items-center gap-1.5 text-[12px] text-ink-3">
              <CornerDownRight className="size-3.5" aria-hidden /> {t('detail.subtaskOf')}{' '}
              <Link href={`/${org}/tasks/${data.project.key}-${data.parent.number}`} className="text-accent hover:underline">
                {data.project.key}-{data.parent.number} {data.parent.title}
              </Link>
            </p>
          ) : null}

          <TitleField title={data.task.title} canEdit={canEdit} onSave={(title) => patch({ title }, t('detail.titleSaved'))} />

          <DescriptionField description={data.task.description} canEdit={canEdit} people={context.people.map((p) => ({ id: p.id, name: p.name, color: p.avatarColor }))} onSave={(description) => patch({ description }, t('detail.descriptionSaved'))} />

          {data.sourceRequest ? (
            <Notice tone="info" icon={<Inbox />}>
              {t('detail.fromRequest')}{' '}
              <Link href={`/${org}/requests/${data.sourceRequest.number}`} className="font-medium underline">
                #{data.sourceRequest.number} {data.sourceRequest.title}
              </Link>
            </Notice>
          ) : null}

          <Checklist org={org} taskId={data.task.id} items={data.checklist} canEdit={canEdit} />

          <Subtasks org={org} data={data} canEdit={canEdit} />

          <Dependencies org={org} data={data} canEdit={canEdit} />

          <Attachments org={org} data={data} attachments={attachments} canUpload={canEdit} />

          {thread ? (
            <>
              <Divider />
              <CommentThread
                org={org}
                parent={{ type: 'task', id: data.task.id }}
                comments={thread.comments}
                context={thread.context}
                people={context.people.map((p) => ({ id: p.id, name: p.name, color: p.avatarColor }))}
                currentUserId={viewer.userId}
                isAdmin={viewer.isAdmin}
              />
            </>
          ) : null}

          {data.history.length ? <HistoryList history={data.history} /> : null}
        </div>

        <aside className="mt-6 flex flex-col gap-4 lg:mt-0" aria-label={t('detail.properties')}>
          <Prop label={t('detail.status')}>
            {canEdit ? (
              <Select size="sm" aria-label={t('detail.status')} value={data.task.statusId} onValueChange={(v) => patch({ statusId: v })} options={data.statuses.map((s) => ({ value: s.id, label: s.name, icon: <StatusIcon category={s.category} /> }))} />
            ) : (
              <span className="inline-flex items-center gap-1.5 text-[13px] text-ink">
                <StatusIcon category={data.status.category} /> {data.status.name}
              </span>
            )}
          </Prop>

          <Prop label={t('detail.assignee')}>
            {canEdit ? (
              <Select
                size="sm"
                aria-label={t('detail.assignee')}
                value={data.task.assigneeId ?? 'none'}
                onValueChange={(v) => patch({ assigneeId: v === 'none' ? null : v })}
                options={[{ value: 'none', label: tc('unassigned') }, ...context.people.map((p) => ({ value: p.id, label: p.name, icon: <Avatar name={p.name} color={p.avatarColor} size="xs" title="" /> }))]}
              />
            ) : data.assignee ? (
              <span className="inline-flex items-center gap-1.5 text-[13px] text-ink">
                <Avatar name={data.assignee.name} color={data.assignee.avatarColor} size="xs" title="" /> {data.assignee.name}
              </span>
            ) : (
              <span className="text-[13px] text-ink-3">{tc('unassigned')}</span>
            )}
          </Prop>

          <Prop label={t('detail.priority')}>
            {canEdit ? (
              <Select size="sm" aria-label={t('detail.priority')} value={data.task.priority} onValueChange={(v) => patch({ priority: v })} options={PRIORITY_VALUES.map((p) => ({ value: p, label: te(`priority.${p}`), icon: <PriorityIcon priority={p} /> }))} />
            ) : (
              <PriorityIcon priority={data.task.priority} withLabel />
            )}
          </Prop>

          <Prop label={t('detail.dueDate')}>
            {canEdit ? (
              <Input type="date" value={data.task.dueDate ?? ''} onChange={(e) => patch({ dueDate: e.target.value || null })} aria-label={t('detail.dueDate')} className="h-8 text-[13px]" />
            ) : data.task.dueDate ? (
              <DueDate date={data.task.dueDate} done={data.status.category === 'completed'} />
            ) : (
              <span className="text-[13px] text-ink-3">{tc('noDate')}</span>
            )}
          </Prop>

          {context.milestones.length || data.milestone ? (
            <Prop label={t('detail.milestone')}>
              {canEdit ? (
                <Select size="sm" aria-label={t('detail.milestone')} value={data.task.milestoneId ?? 'none'} onValueChange={(v) => patch({ milestoneId: v === 'none' ? null : v })} options={[{ value: 'none', label: tc('none') }, ...context.milestones.map((m) => ({ value: m.id, label: m.name, icon: <Flag className="size-3.5 text-ink-3" /> }))]} />
              ) : (
                <span className="text-[13px] text-ink">{data.milestone?.name ?? tc('none')}</span>
              )}
            </Prop>
          ) : null}

          {context.labels.length || data.labels.length ? (
            <Prop label={t('detail.labels')}>
              <div className="flex flex-wrap items-center gap-1.5">
                {data.labels.map((l) => (
                  <LabelChip key={l.id} name={l.name} color={l.color} />
                ))}
                {!data.labels.length ? <span className="text-[13px] text-ink-3">{tc('none')}</span> : null}
                {canEdit && context.labels.length ? (
                  <Menu>
                    <MenuTrigger asChild>
                      <Button size="icon-sm" variant="ghost" aria-label={t('detail.editLabels')}>
                        <Plus />
                      </Button>
                    </MenuTrigger>
                    <MenuContent align="end">
                      <MenuLabel>{t('detail.labels')}</MenuLabel>
                      {context.labels.map((l) => {
                        const on = data.labels.some((x) => x.id === l.id);
                        return (
                          <MenuItem
                            key={l.id}
                            onSelect={() => {
                              const next = on ? data.labels.filter((x) => x.id !== l.id).map((x) => x.id) : [...data.labels.map((x) => x.id), l.id];
                              patch({ labelIds: next });
                            }}
                          >
                            {on ? <Check /> : <span className="size-4" aria-hidden />}
                            <LabelChip name={l.name} color={l.color} />
                          </MenuItem>
                        );
                      })}
                    </MenuContent>
                  </Menu>
                ) : null}
              </div>
            </Prop>
          ) : null}

          {!data.access.isClient ? (
            <Prop label={t('detail.watchers')}>
              {data.watchers.length ? <AvatarStack people={data.watchers.map((w) => ({ name: w.name, color: w.avatarColor }))} /> : <span className="text-[13px] text-ink-3">{t('detail.noWatchers')}</span>}
            </Prop>
          ) : null}

          <div className="border-t border-line pt-3 text-[12px] text-ink-3">
            <p>
              {data.creator ? t('detail.createdBy', { name: data.creator.name }) : t('detail.created')} <RelativeTime date={data.task.createdAt} />
            </p>
            <p className="mt-1">
              {tc('updatedAgo', { time: '' })} <RelativeTime date={data.task.updatedAt} />
            </p>
            {data.task.startDate ? (
              <p className="mt-1">
                {t('detail.startDate')}: <FormattedDate date={data.task.startDate} />
              </p>
            ) : null}
          </div>
        </aside>
      </div>

      <Dialog open={conflict} onOpenChange={setConflict}>
        <DialogContent title={t('conflict.title')} description={t('conflict.body')} size="sm">
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
              {t('conflict.reload')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={t('detail.deleteTitle', { ref: data.ref })}
        description={t('detail.deleteBody')}
        confirmLabel={tc('delete')}
        onConfirm={async () => {
          const res = await call(() => deleteTaskAction(org, data.task.id), { refresh: false });
          if (!res.ok) return false;
          toast.success(t('detail.deleted', { ref: data.ref }), {
            action: {
              label: tc('undo'),
              onClick: async () => {
                const r = await restoreTaskAction(org, data.task.id);
                if (r.ok) {
                  toast.success(t('detail.restored', { ref: data.ref }));
                  router.push(detailBase);
                }
              },
            },
          });
          router.push(`/${org}/projects/${data.project.key}/tasks`);
          return true;
        }}
      />
    </div>
  );
}

function Prop({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-[12px] font-medium text-ink-3">{label}</p>
      {children}
    </div>
  );
}

function TitleField({ title, canEdit, onSave }: { title: string; canEdit: boolean; onSave: (title: string) => Promise<boolean> }) {
  const t = useTranslations('tasks');
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(title);
  useEffect(() => setValue(title), [title]);
  if (!canEdit) return <h1 className="text-[20px] leading-snug font-semibold text-ink">{title}</h1>;
  if (!editing) {
    return (
      <h1 className="group flex items-start gap-2 text-[20px] leading-snug font-semibold text-ink">
        <button type="button" onClick={() => setEditing(true)} className="min-w-0 rounded text-left hover:bg-surface-2" aria-label={t('detail.editTitle')}>
          {title}
        </button>
      </h1>
    );
  }
  return (
    <form
      className="flex items-start gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (value.trim() && value !== title) {
          const ok = await onSave(value.trim());
          if (!ok) return;
        }
        setEditing(false);
      }}
    >
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        autoFocus
        maxLength={300}
        aria-label={t('detail.title')}
        className="text-[18px] font-semibold"
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setValue(title);
            setEditing(false);
          }
        }}
      />
      <Button type="submit" size="sm" variant="primary">
        <Check />
      </Button>
      <Button size="sm" variant="ghost" onClick={() => { setValue(title); setEditing(false); }} aria-label={t('detail.cancelEdit')}>
        <X />
      </Button>
    </form>
  );
}

function DescriptionField({ description, canEdit, people, onSave }: { description: unknown; canEdit: boolean; people: { id: string; name: string; color?: string | null }[]; onSave: (doc: unknown) => Promise<boolean> }) {
  const t = useTranslations('tasks');
  const tc = useTranslations('common');
  const [editing, setEditing] = useState(false);
  const [doc, setDoc] = useState<unknown>(description);
  const [saving, setSaving] = useState(false);
  useEffect(() => setDoc(description), [description]);
  const empty = isEmptyDoc(description);

  if (!canEdit) {
    return empty ? <p className="text-[13px] text-ink-3">{t('detail.noDescription')}</p> : <RichText doc={description} />;
  }
  if (!editing) {
    return (
      <div>
        {empty ? (
          <Button size="sm" variant="ghost" className="text-ink-3" onClick={() => setEditing(true)}>
            <Plus /> {t('detail.addDescription')}
          </Button>
        ) : (
          <button type="button" onClick={() => setEditing(true)} className="block w-full rounded-md text-left hover:bg-surface-2" aria-label={t('detail.editDescription')}>
            <RichText doc={description} />
          </button>
        )}
      </div>
    );
  }
  const save = async () => {
    setSaving(true);
    const ok = await onSave(doc);
    setSaving(false);
    if (ok) setEditing(false);
  };
  return (
    <div className="rounded-md border border-line-strong p-2">
      <RichTextEditor value={doc} onChange={setDoc} people={people} placeholder={t('detail.descriptionPlaceholder')} ariaLabel={t('detail.description')} contentClassName="min-h-24" onSubmit={save} autoFocus />
      <div className="mt-2 flex items-center gap-2">
        <Button size="sm" variant="primary" loading={saving} onClick={save}>
          {tc('save')}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => { setDoc(description); setEditing(false); }}>
          {tc('cancel')}
        </Button>
        <span className="text-[11px] text-ink-3">{t('detail.submitHint')}</span>
      </div>
    </div>
  );
}

function Checklist({ org, taskId, items, canEdit }: { org: string; taskId: string; items: { id: string; text: string; done: boolean }[]; canEdit: boolean }) {
  const t = useTranslations('tasks');
  const { call } = useAction();
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const done = items.filter((i) => i.done).length;
  if (!items.length && !canEdit) return null;
  return (
    <section aria-label={t('detail.checklist')}>
      <h2 className="flex items-center gap-2 text-[13px] font-semibold text-ink">
        <CheckSquare className="size-4 text-ink-3" aria-hidden /> {t('detail.checklist')}
        {items.length ? (
          <span className="font-normal text-ink-3 tabular-nums">
            {done}/{items.length}
          </span>
        ) : null}
      </h2>
      <ul className="mt-2 flex flex-col">
        {items.map((i) => (
          <li key={i.id} className="group flex items-center gap-2 py-1">
            <Checkbox checked={i.done} disabled={!canEdit} onCheckedChange={(v) => call(() => saveChecklistItemAction(org, { taskId, itemId: i.id, done: v }))} aria-label={i.text} />
            <span className={cn('min-w-0 flex-1 text-[13px]', i.done ? 'text-ink-3 line-through' : 'text-ink')}>{i.text}</span>
            {canEdit ? (
              <Button size="icon-sm" variant="ghost" aria-label={t('detail.removeChecklistItem', { text: i.text })} onClick={() => call(() => deleteChecklistItemAction(org, { taskId, itemId: i.id }))}>
                <X />
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
      {canEdit ? (
        <form
          className="mt-2 flex items-center gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!text.trim()) return;
            const res = await call(() => saveChecklistItemAction(org, { taskId, text }));
            if (res.ok) {
              setText('');
              inputRef.current?.focus();
            }
          }}
        >
          <Input ref={inputRef} value={text} onChange={(e) => setText(e.target.value)} placeholder={t('detail.checklistPlaceholder')} aria-label={t('detail.checklistPlaceholder')} maxLength={300} className="h-8 text-[13px]" />
          <Button type="submit" size="sm" disabled={!text.trim()}>
            {t('detail.addItem')}
          </Button>
        </form>
      ) : null}
    </section>
  );
}

function Subtasks({ org, data, canEdit }: { org: string; data: TaskDetailProps['data']; canEdit: boolean }) {
  const t = useTranslations('tasks');
  const { call } = useAction();
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const canAdd = canEdit && !data.parent;
  if (!data.subtasks.length && !canAdd) return null;
  return (
    <section aria-label={t('detail.subtasks')}>
      <h2 className="text-[13px] font-semibold text-ink">
        {t('detail.subtasks')} {data.subtasks.length ? <span className="font-normal text-ink-3 tabular-nums">{data.subtasks.filter((s) => s.statusCategory === 'completed').length}/{data.subtasks.length}</span> : null}
      </h2>
      <ul className="mt-2 divide-y divide-line rounded-md border border-line">
        {data.subtasks.map((s) => (
          <li key={s.id} className="flex items-center gap-2 px-2.5 py-1.5">
            <StatusIcon category={s.statusCategory} />
            <Link href={`/${org}/tasks/${data.project.key}-${s.number}`} className="min-w-0 flex-1 truncate text-[13px] text-ink hover:underline">
              {s.title}
            </Link>
            {s.dueDate ? <DueDate date={s.dueDate} done={s.statusCategory === 'completed'} short /> : null}
            {s.assigneeName ? <Avatar name={s.assigneeName} color={s.assigneeColor} size="sm" title={s.assigneeName} /> : null}
          </li>
        ))}
        {!data.subtasks.length ? <li className="px-2.5 py-2 text-[13px] text-ink-3">{t('detail.noSubtasks')}</li> : null}
      </ul>
      {canAdd ? (
        adding ? (
          <form
            className="mt-2 flex items-center gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!title.trim()) return;
              const res = await call(() => createTaskAction(org, { projectId: data.project.id, title, parentId: data.task.id }), { success: t('detail.subtaskAdded') });
              if (res.ok) setTitle('');
            }}
          >
            <Input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus maxLength={300} placeholder={t('detail.subtaskPlaceholder')} aria-label={t('detail.subtaskPlaceholder')} className="h-8 text-[13px]" />
            <Button type="submit" size="sm" variant="primary" disabled={!title.trim()}>
              {t('detail.addSubtask')}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
              {t('quickAdd.done')}
            </Button>
          </form>
        ) : (
          <Button size="sm" variant="ghost" className="mt-1 text-ink-3" onClick={() => setAdding(true)}>
            <Plus /> {t('detail.addSubtask')}
          </Button>
        )
      ) : null}
    </section>
  );
}

function Dependencies({ org, data, canEdit }: { org: string; data: TaskDetailProps['data']; canEdit: boolean }) {
  const t = useTranslations('tasks');
  const { call, fieldErrors } = useAction();
  const [ref, setRef] = useState('');
  const [adding, setAdding] = useState(false);
  if (!data.blockedBy.length && !data.blocking.length && !canEdit) return null;
  return (
    <section aria-label={t('detail.dependencies')}>
      <h2 className="flex items-center gap-2 text-[13px] font-semibold text-ink">
        <Ban className="size-4 text-ink-3" aria-hidden /> {t('detail.dependencies')}
      </h2>
      <div className="mt-2 flex flex-col gap-3">
        <div>
          <p className="text-[12px] text-ink-3">{t('detail.blockedBy')}</p>
          {data.blockedBy.length ? (
            <ul className="mt-1 flex flex-col gap-1">
              {data.blockedBy.map((b) => (
                <li key={b.id} className="flex items-center gap-2 text-[13px]">
                  <StatusIcon category={b.statusCategory} />
                  <Link href={`/${org}/tasks/${b.projectKey}-${b.number}`} className="min-w-0 flex-1 truncate text-ink hover:underline">
                    <Mono className="mr-1.5">{b.projectKey}-{b.number}</Mono>
                    {b.title}
                  </Link>
                  {canEdit ? (
                    <Button size="icon-sm" variant="ghost" aria-label={t('detail.removeDependency', { ref: `${b.projectKey}-${b.number}` })} onClick={() => call(() => removeDependencyAction(org, { blockerId: b.id, blockedId: data.task.id }))}>
                      <X />
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-[13px] text-ink-3">{t('detail.noBlockers')}</p>
          )}
          {canEdit ? (
            adding ? (
              <form
                className="mt-2 flex flex-col gap-1"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const res = await call(() => addDependencyAction(org, { blockerRef: ref.trim(), blockedId: data.task.id }), { inlineFieldErrors: true, success: t('detail.dependencyAdded') });
                  if (res.ok) {
                    setRef('');
                    setAdding(false);
                  }
                }}
              >
                <div className="flex items-center gap-2">
                  <Input value={ref} onChange={(e) => setRef(e.target.value.toUpperCase())} autoFocus placeholder={t('detail.blockerPlaceholder', { key: data.project.key })} aria-label={t('detail.blockerLabel')} className="h-8 font-mono text-[13px]" maxLength={20} />
                  <Button type="submit" size="sm" variant="primary" disabled={!ref.trim()}>
                    {t('detail.addBlocker')}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
                    {t('quickAdd.done')}
                  </Button>
                </div>
                {fieldErrors.blockerRef ? (
                  <p role="alert" className="text-[12px] text-danger">
                    {fieldErrors.blockerRef}
                  </p>
                ) : null}
              </form>
            ) : (
              <Button size="sm" variant="ghost" className="mt-1 text-ink-3" onClick={() => setAdding(true)}>
                <Plus /> {t('detail.addBlocker')}
              </Button>
            )
          ) : null}
        </div>
        {data.blocking.length ? (
          <div>
            <p className="text-[12px] text-ink-3">{t('detail.blocking')}</p>
            <ul className="mt-1 flex flex-col gap-1">
              {data.blocking.map((b) => (
                <li key={b.id} className="flex items-center gap-2 text-[13px]">
                  <StatusIcon category={b.statusCategory} />
                  <Link href={`/${org}/tasks/${b.projectKey}-${b.number}`} className="min-w-0 flex-1 truncate text-ink hover:underline">
                    <Mono className="mr-1.5">{b.projectKey}-{b.number}</Mono>
                    {b.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function Attachments({ org, data, attachments, canUpload }: { org: string; data: TaskDetailProps['data']; attachments: TaskDetailProps['attachments']; canUpload: boolean }) {
  const t = useTranslations('tasks');
  if (!attachments.length && !canUpload) return null;
  return (
    <section aria-label={t('detail.attachments')}>
      <h2 className="flex items-center gap-2 text-[13px] font-semibold text-ink">
        <Paperclip className="size-4 text-ink-3" aria-hidden /> {t('detail.attachments')}
        {attachments.length ? <span className="font-normal text-ink-3 tabular-nums">{attachments.length}</span> : null}
      </h2>
      {attachments.length ? (
        <ul className="mt-2 divide-y divide-line rounded-md border border-line">
          {attachments.map((f) => (
            <li key={f.id} className="flex items-center gap-2.5 px-2.5 py-2">
              <FileIcon mimeType={f.mimeType} />
              <Link href={`/${org}/files/${f.id}`} className="min-w-0 flex-1 truncate text-[13px] text-ink hover:underline">
                {f.name}
              </Link>
              <span className="text-[12px] text-ink-3">{formatBytes(f.sizeBytes)}</span>
              {f.currentVersion > 1 ? <span className="text-[12px] text-ink-3">v{f.currentVersion}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
      {canUpload ? <FileUploader endpoint={`/api/orgs/${org}/files`} meta={{ projectId: data.project.id, taskId: data.task.id }} compact className="mt-2" /> : null}
    </section>
  );
}

function HistoryList({ history }: { history: TaskDetailProps['data']['history'] }) {
  const t = useTranslations('tasks');
  const [open, setOpen] = useState(false);
  const shown = open ? history : history.slice(0, 5);
  const value = (v: unknown) => (v === null || v === undefined || v === '' ? t('history.empty') : Array.isArray(v) ? v.join(', ') : String(v));
  return (
    <section aria-label={t('history.title')}>
      <h2 className="flex items-center gap-2 text-[13px] font-semibold text-ink">
        <History className="size-4 text-ink-3" aria-hidden /> {t('history.title')}
      </h2>
      <ol className="mt-2 flex flex-col gap-1.5">
        {shown.map((h) => (
          <li key={h.id} className="flex flex-wrap items-center gap-1.5 text-[12px] text-ink-3">
            <Avatar name={h.actorName} color={h.actorColor} size="xs" title="" />
            <span className="text-ink-2">{h.actorName ?? t('history.system')}</span>
            {h.field === 'description' ? (
              <span>{t('history.changedDescription')}</span>
            ) : (
              <span>
                {t('history.changed', { field: h.field })} <span className="text-ink-2">{value(h.fromValue)}</span> → <span className="text-ink-2">{value(h.toValue)}</span>
              </span>
            )}
            <RelativeTime date={h.createdAt} />
          </li>
        ))}
      </ol>
      {history.length > 5 ? (
        <Button size="xs" variant="ghost" className="mt-1" onClick={() => setOpen(!open)}>
          {open ? t('history.less') : t('history.more', { count: history.length - 5 })}
        </Button>
      ) : null}
    </section>
  );
}
