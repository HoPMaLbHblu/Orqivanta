'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { Editor } from '@tiptap/react';
import { AlertTriangle, ChevronRight, CircleAlert, Clock, Eye, FolderInput, History, MoreHorizontal, RotateCcw, Stamp, Star, Trash2, Users, WifiOff } from 'lucide-react';
import { setDocumentDeletedAction, setDocumentFavoriteAction, setDocumentSharedAction } from '@/actions/documents';
import { CommentThread, type CommentView, type ThreadContext } from '@/components/comments/thread';
import { Avatar } from '@/components/domain/avatar';
import { ApprovalStatusBadge, Badge, type ApprovalStatus } from '@/components/domain/badges';
import { DueDate, RelativeTime } from '@/components/domain/dates';
import { toneInk } from '@/components/domain/tone';
import { RichTextEditor, type Mentionable } from '@/components/rich-text/editor';
import { isEmptyDoc, RichText } from '@/components/rich-text/render';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/checkbox';
import { ConfirmDialog } from '@/components/ui/confirm';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@/components/ui/menu';
import { Mono, Notice } from '@/components/ui/primitives';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/cn';
import { useAction } from '@/lib/use-action';
import type { BrowserCollection } from './browser';
import { MoveDocumentDialog } from './collection-dialogs';
import { ConflictDialog } from './conflict-dialog';
import { RequestApprovalDialog } from './request-approval-dialog';
import { useDocumentAutosave, type SaveStatus } from './use-autosave';

export interface WorkspaceDoc {
  id: string;
  title: string;
  kind: string;
  content: unknown;
  version: number;
  sharedWithClient: boolean;
  updatedAt: Date;
  createdAt: Date;
  deletedAt: Date | null;
  updatedByName: string | null;
  updatedByColor: string | null;
}

interface Props {
  org: string;
  currentUserId: string;
  isAdmin: boolean;
  doc: WorkspaceDoc;
  project: { id: string; key: string; name: string; portalEnabled: boolean; archived: boolean; color: string | null; hasClient: boolean } | null;
  collection: { id: string; name: string } | null;
  collections: BrowserCollection[];
  versionCount: number;
  access: { isClient: boolean; canEdit: boolean; canDelete: boolean; canShare: boolean; canRequestApproval: boolean };
  isFavorite: boolean;
  comments: { comments: CommentView[]; context: ThreadContext } | null;
  people: Mentionable[];
  approvals: { id: string; title: string; status: string; subjectName: string | null; dueDate: string | null; createdAt: Date; reviewerCount: number; decidedCount: number }[];
}

export function DocumentWorkspace({ org, currentUserId, isAdmin, doc, project, collection, collections, versionCount, access, isFavorite, comments, people, approvals }: Props) {
  const t = useTranslations('documents');
  const tk = useTranslations('enums.documentKind');
  const router = useRouter();
  const { call, pending } = useAction();
  const editable = access.canEdit;
  const save = useDocumentAutosave({ org, documentId: doc.id, initial: { version: doc.version, title: doc.title, content: doc.content }, enabled: editable });
  const [title, setTitle] = useState(doc.title);
  const [mountedContent, setMountedContent] = useState<unknown>(doc.content);
  const [editorKey, setEditorKey] = useState(0);
  const editorRef = useRef<Editor | null>(null);
  const [favorite, setFavorite] = useState(isFavorite);
  const [preview, setPreview] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [moving, setMoving] = useState(false);
  const [confirmTrash, setConfirmTrash] = useState(false);
  const [newerRemote, setNewerRemote] = useState<{ version: number; by: string | null } | null>(null);

  useEffect(() => setFavorite(isFavorite), [isFavorite]);

  const onEditor = useCallback((e: Editor | null) => {
    editorRef.current = e;
  }, []);

  const loadVersion = useCallback(
    (v: { version: number; title: string; content: unknown; updatedAt?: string | Date | null }) => {
      save.adopt(v);
      setTitle(v.title);
      setMountedContent(v.content);
      // A new key remounts Tiptap with the new content (it doesn't take controlled values).
      setEditorKey((k) => k + 1);
      setNewerRemote(null);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [save.adopt],
  );

  // Someone else saved (the page refreshed through realtime). Load it if there's nothing
  // unsaved here; otherwise say so, and the next save will open the conflict dialog.
  useEffect(() => {
    const cur = save.current();
    if (doc.version <= cur.baseVersion) return;
    if (save.isClean()) loadVersion({ version: doc.version, title: doc.title, content: doc.content, updatedAt: doc.updatedAt });
    else setNewerRemote({ version: doc.version, by: doc.updatedByName });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.version]);

  const flush = save.flush;
  // Cmd/Ctrl+S saves now.
  useEffect(() => {
    if (!editable) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void flush();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editable, flush]);

  async function copyMine() {
    const mine = save.conflict?.mine;
    if (!mine) return;
    const editor = editorRef.current;
    const text = `${mine.title}\n\n${editor?.getText({ blockSeparator: '\n\n' }) ?? ''}`;
    const html = `<h1>${escapeHtml(mine.title)}</h1>${editor?.getHTML() ?? ''}`;
    try {
      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard.write) {
        await navigator.clipboard.write([new ClipboardItem({ 'text/plain': new Blob([text], { type: 'text/plain' }), 'text/html': new Blob([html], { type: 'text/html' }) })]);
      } else {
        await navigator.clipboard.writeText(text);
      }
    } catch {
      toast.error(t('conflict.copyFailed'));
      return;
    }
    const theirs = save.conflict!.theirs;
    loadVersion(theirs);
    toast.success(t('conflict.copied'));
  }

  async function toggleShare(shared: boolean) {
    // Sharing bumps the document version; save pending edits first so they don't conflict.
    if (editable && !(await save.settle())) {
      toast.error(t('share.saveFirst'));
      return;
    }
    await call(() => setDocumentSharedAction(org, { documentId: doc.id, shared }), { success: shared ? t('share.sharedToast') : t('share.unsharedToast') });
  }

  async function toggleFavorite() {
    const next = !favorite;
    setFavorite(next);
    const res = await call(() => setDocumentFavoriteAction(org, doc.id, next), { success: next ? t('favorite.added') : t('favorite.removed') });
    if (!res.ok) setFavorite(!next);
  }

  async function trash() {
    if (editable) await save.settle();
    const res = await call(() => setDocumentDeletedAction(org, { documentId: doc.id, deleted: true }), { refresh: false });
    if (!res.ok) return false;
    toast(t('trashed', { name: title }), {
      action: { label: t('undo'), onClick: () => void setDocumentDeletedAction(org, { documentId: doc.id, deleted: false }).then((r) => r.ok && router.push(`/${org}/documents/${doc.id}`)) },
    });
    router.push(`/${org}/documents`);
    return true;
  }

  const deleted = Boolean(doc.deletedAt);
  const lastEditedBy = save.savedAt ? null : doc.updatedByName;
  const projectCollections = collections.filter((c) => c.canEdit && (c.projectId ?? null) === (project?.id ?? null));
  const canMove = editable && projectCollections.length > 0;

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6 lg:px-10">
      {/* Top bar: breadcrumb, save state and document actions */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <nav aria-label={t('breadcrumb')} className="flex min-w-0 flex-1 items-center gap-1 text-[13px] text-ink-3">
          <Link href={`/${org}/documents`} className="hover:text-ink">
            {t('title')}
          </Link>
          <ChevronRight className="size-3.5 shrink-0" aria-hidden />
          {project ? (
            <>
              <Link href={`/${org}/documents?project=${project.key}`} className="inline-flex shrink-0 items-center gap-1 hover:text-ink">
                <span className="size-2 rounded-[2px]" style={{ background: toneInk(project.color) }} aria-hidden />
                <Mono>{project.key}</Mono>
              </Link>
              <ChevronRight className="size-3.5 shrink-0" aria-hidden />
            </>
          ) : null}
          <span className="min-w-0 truncate text-ink-2" aria-current="page">
            {title || t('untitled')}
          </span>
        </nav>
        <div className="flex items-center gap-1">
          {editable ? <SaveIndicator status={save.status} error={save.error} savedAt={save.savedAt} onRetry={() => void save.flush()} /> : null}
          <Button size="icon" variant="ghost" aria-pressed={favorite} aria-label={favorite ? t('favorite.remove') : t('favorite.add')} title={favorite ? t('favorite.remove') : t('favorite.add')} onClick={toggleFavorite}>
            <Star className={cn(favorite && 'fill-current text-attention')} />
          </Button>
          {/* A plain link, not <Button asChild>: that Slot only accepts a single child and drops it. */}
          <Link href={`/${org}/documents/${doc.id}/history`} className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink">
            <History className="size-4" aria-hidden /> <span className="hidden sm:inline">{t('history')}</span>
          </Link>
          {canMove || access.canDelete ? (
            <Menu>
              <MenuTrigger asChild>
                <Button size="icon" variant="ghost" aria-label={t('moreActions')}>
                  <MoreHorizontal />
                </Button>
              </MenuTrigger>
              <MenuContent align="end">
                {canMove ? (
                  <MenuItem onSelect={() => setMoving(true)}>
                    <FolderInput /> {t('moveTo')}
                  </MenuItem>
                ) : null}
                {canMove && access.canDelete && !deleted ? <MenuSeparator /> : null}
                {access.canDelete && !deleted ? (
                  <MenuItem danger onSelect={() => setConfirmTrash(true)}>
                    <Trash2 /> {t('moveToTrash')}
                  </MenuItem>
                ) : null}
              </MenuContent>
            </Menu>
          ) : null}
        </div>
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          {deleted ? (
            <Notice
              tone="attention"
              icon={<Trash2 />}
              className="mb-5"
              action={
                access.canDelete ? (
                  <Button size="xs" variant="secondary" loading={pending} onClick={() => call(() => setDocumentDeletedAction(org, { documentId: doc.id, deleted: false }), { success: t('restored', { name: doc.title }) })}>
                    <RotateCcw /> {t('restore')}
                  </Button>
                ) : null
              }
            >
              {t('inTrash')}
            </Notice>
          ) : !editable ? (
            <Notice tone="neutral" icon={<Eye />} className="mb-5">
              {project?.archived ? t('readOnlyArchived') : t('readOnly')}
            </Notice>
          ) : null}
          {newerRemote ? (
            <Notice tone="attention" icon={<AlertTriangle />} className="mb-5">
              {t('newerRemote', { name: newerRemote.by ?? t('conflict.someone'), version: newerRemote.version })}
            </Notice>
          ) : null}

          <article className="rounded-lg border border-line bg-surface px-5 py-6 sm:px-10 sm:py-8">
            {editable ? (
              <label className="block">
                <span className="sr-only">{t('titleLabel')}</span>
                <input
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    save.change({ title: e.target.value });
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      editorRef.current?.commands.focus('start');
                    }
                  }}
                  maxLength={200}
                  placeholder={t('untitled')}
                  className="w-full bg-transparent font-serif text-[32px] leading-tight text-ink placeholder:text-ink-3 focus:outline-none sm:text-[36px]"
                />
              </label>
            ) : (
              <h1 className="font-serif text-[32px] leading-tight text-ink sm:text-[36px]">{title || t('untitled')}</h1>
            )}
            <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-ink-3">
              {doc.kind !== 'page' ? <span>{tk(doc.kind as 'page')}</span> : null}
              {doc.kind !== 'page' ? <span aria-hidden>·</span> : null}
              <span>{t('versionN', { version: save.savedVersion })}</span>
              {doc.sharedWithClient ? (
                <>
                  <span aria-hidden>·</span>
                  <span className="inline-flex items-center gap-1 text-accent">
                    <Users className="size-3.5" aria-hidden /> {t('shared')}
                  </span>
                </>
              ) : null}
            </p>
            <div className="mt-6">
              {editable ? (
                <RichTextEditor
                  key={editorKey}
                  value={mountedContent}
                  onChange={(c) => save.change({ content: c })}
                  people={people}
                  placeholder={t('editorPlaceholder')}
                  ariaLabel={t('editorLabel')}
                  onEditor={onEditor}
                  className="[&_[role=toolbar]]:sticky [&_[role=toolbar]]:top-0 [&_[role=toolbar]]:z-10 [&_[role=toolbar]]:-mx-2 [&_[role=toolbar]]:rounded-md [&_[role=toolbar]]:border [&_[role=toolbar]]:border-line [&_[role=toolbar]]:bg-surface [&_[role=toolbar]]:px-1 [&_[role=toolbar]]:py-1"
                  contentClassName="min-h-[40vh]"
                />
              ) : isEmptyDoc(doc.content) ? (
                <p className="text-[14px] text-ink-3">{t('emptyDoc')}</p>
              ) : (
                <RichText doc={doc.content} />
              )}
            </div>
          </article>

          {comments ? (
            <div className="mt-8">
              <CommentThread org={org} parent={{ type: 'document', id: doc.id }} comments={comments.comments} context={comments.context} people={people} currentUserId={currentUserId} isAdmin={isAdmin} />
            </div>
          ) : null}
        </div>

        <aside aria-label={t('details')} className="flex flex-col gap-5 lg:sticky lg:top-6 lg:self-start">
          <section className="rounded-lg border border-line bg-surface">
            <h2 className="border-b border-line px-4 py-2.5 text-[13px] font-semibold text-ink">{t('details')}</h2>
            <dl className="flex flex-col gap-3 px-4 py-3 text-[13px]">
              <DetailRow label={t('project')}>
                {project ? (
                  <Link href={`/${org}/projects/${project.key}`} className="inline-flex min-w-0 items-center gap-1.5 text-ink hover:underline">
                    <span className="size-2 shrink-0 rounded-[2px]" style={{ background: toneInk(project.color) }} aria-hidden />
                    <span className="truncate">{project.name}</span>
                  </Link>
                ) : (
                  <span className="text-ink-2">{t('workspace')}</span>
                )}
              </DetailRow>
              <DetailRow label={t('collectionLabel')}>
                <span className="flex min-w-0 items-center gap-2">
                  <span className={cn('truncate', collection ? 'text-ink' : 'text-ink-3')}>{collection?.name ?? t('noCollection')}</span>
                  {canMove ? (
                    <button type="button" onClick={() => setMoving(true)} className="shrink-0 text-[12px] font-medium text-accent hover:underline">
                      {t('change')}
                    </button>
                  ) : null}
                </span>
              </DetailRow>
              <DetailRow label={t('lastEdited')}>
                <span className="flex min-w-0 items-center gap-1.5 text-ink-2">
                  {save.savedAt ? (
                    <>
                      {t('byYou')} · <RelativeTime date={save.savedAt} />
                    </>
                  ) : (
                    <>
                      {lastEditedBy ? <Avatar name={lastEditedBy} color={doc.updatedByColor} size="xs" title="" /> : null}
                      <span className="truncate">{lastEditedBy ?? t('unknownPerson')}</span> · <RelativeTime date={doc.updatedAt} />
                    </>
                  )}
                </span>
              </DetailRow>
              <DetailRow label={t('versions')}>
                <Link href={`/${org}/documents/${doc.id}/history`} className="text-accent hover:underline">
                  {t('versionsLink', { count: versionCount })}
                </Link>
              </DetailRow>
            </dl>
          </section>

          {project ? (
            <section className="rounded-lg border border-line bg-surface">
              <h2 className="border-b border-line px-4 py-2.5 text-[13px] font-semibold text-ink">{t('share.title')}</h2>
              <div className="flex flex-col gap-3 px-4 py-3">
                {access.canShare ? (
                  <div className="flex items-start justify-between gap-3">
                    <label htmlFor="share-switch" className="text-[13px] text-ink">
                      {t('share.label')}
                      <span id="share-hint" className="mt-0.5 block text-[12px] text-ink-3">
                        {!project.hasClient ? t('share.noClient') : doc.sharedWithClient ? t('share.onHint') : t('share.offHint')}
                      </span>
                    </label>
                    <Switch id="share-switch" checked={doc.sharedWithClient} onCheckedChange={toggleShare} disabled={pending || deleted || (!project.hasClient && !doc.sharedWithClient)} aria-describedby="share-hint" />
                  </div>
                ) : (
                  <p className="flex items-center gap-2 text-[13px] text-ink-2">
                    {doc.sharedWithClient ? <Badge tone="accent" icon={Users}>{t('shared')}</Badge> : <Badge tone="muted">{t('internalOnly')}</Badge>}
                    <span className="text-[12px] text-ink-3">{t('share.managersOnly')}</span>
                  </p>
                )}
                {doc.sharedWithClient && !project.portalEnabled ? <p className="text-[12px] text-attention">{t('share.portalOff')}</p> : null}
                {project.hasClient ? (
                  <Button size="sm" variant="secondary" onClick={() => setPreview(true)} className="self-start">
                    <Eye /> {t('preview.button')}
                  </Button>
                ) : null}
              </div>
            </section>
          ) : null}

          {project ? (
            <section className="rounded-lg border border-line bg-surface">
              <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2.5">
                <h2 className="text-[13px] font-semibold text-ink">{t('approvals.title')}</h2>
                {access.canRequestApproval ? (
                  <Button size="xs" variant="ghost" onClick={() => setRequesting(true)}>
                    <Stamp /> {t('approvals.request')}
                  </Button>
                ) : null}
              </div>
              {approvals.length ? (
                <ul className="divide-y divide-line">
                  {approvals.map((a) => (
                    <li key={a.id}>
                      <Link href={`/${org}/approvals/${a.id}`} className="flex flex-col gap-1 px-4 py-2.5 hover:bg-surface-2">
                        <span className="truncate text-[13px] font-medium text-ink">{a.title}</span>
                        <span className="flex flex-wrap items-center gap-2">
                          <ApprovalStatusBadge status={a.status as ApprovalStatus} />
                          {a.subjectName ? <span className="text-[12px] text-ink-3">{a.subjectName.replace(/^.* v(\d+)$/, 'v$1')}</span> : null}
                          <span className="text-[12px] text-ink-3 tabular-nums">{t('approvals.decided', { done: a.decidedCount, total: a.reviewerCount })}</span>
                          {a.status === 'pending' ? <DueDate date={a.dueDate} short /> : null}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-4 py-3 text-[12px] text-ink-3">{access.canRequestApproval ? t('approvals.emptyCan') : t('approvals.empty')}</p>
              )}
            </section>
          ) : null}
        </aside>
      </div>

      <ConflictDialog
        conflict={save.conflict}
        onKeepTheirs={() => {
          const theirs = save.conflict!.theirs;
          loadVersion(theirs);
          toast.success(t('conflict.loadedTheirs'));
        }}
        onCopyMine={copyMine}
        onOverwrite={save.overwrite}
      />
      <ClientPreviewDialog open={preview} onOpenChange={setPreview} shared={doc.sharedWithClient} title={save.saved.title} content={save.saved.content} portalEnabled={project?.portalEnabled ?? false} />
      {project && access.canRequestApproval ? (
        <RequestApprovalDialog
          org={org}
          open={requesting}
          onOpenChange={setRequesting}
          target={{ type: 'document', projectId: project.id, documentId: doc.id, title: title || t('untitled') }}
          sharedWithClient={doc.sharedWithClient}
          currentUserId={currentUserId}
          beforeSubmit={async () => {
            if (!editable) return true;
            const ok = await save.settle();
            if (!ok) toast.error(t('approvals.saveFirst'));
            return ok;
          }}
        />
      ) : null}
      <MoveDocumentDialog org={org} open={moving} onOpenChange={setMoving} doc={{ id: doc.id, title, projectId: project?.id ?? null, collectionId: collection?.id ?? null }} collections={projectCollections} />
      <ConfirmDialog open={confirmTrash} onOpenChange={setConfirmTrash} title={t('trashConfirm.title', { name: title || t('untitled') })} description={t('trashConfirm.body')} confirmLabel={t('moveToTrash')} onConfirm={trash} />
    </div>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[96px_minmax(0,1fr)] items-baseline gap-2">
      <dt className="text-[12px] text-ink-3">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

function SaveIndicator({ status, error, savedAt, onRetry }: { status: SaveStatus; error: string | null; savedAt: Date | null; onRetry: () => void }) {
  const t = useTranslations('documents.saveState');
  return (
    <div role="status" aria-live="polite" className="mr-1 flex items-center gap-1.5 text-[12px]">
      {status === 'saving' ? (
        <span className="inline-flex items-center gap-1.5 text-ink-3">
          <Spinner className="size-3.5" /> {t('saving')}
        </span>
      ) : status === 'dirty' ? (
        <span className="inline-flex items-center gap-1.5 text-ink-3">
          <span className="size-1.5 rounded-full bg-attention" aria-hidden /> {t('unsaved')}
        </span>
      ) : status === 'offline' ? (
        <span className="inline-flex items-center gap-1.5 text-attention" title={t('offlineHint')}>
          <WifiOff className="size-3.5" aria-hidden /> {t('offline')}
        </span>
      ) : status === 'error' ? (
        <span className="inline-flex items-center gap-1.5 text-danger">
          <CircleAlert className="size-3.5" aria-hidden />
          <span title={error ?? undefined}>{t('failed')}</span>
          <button type="button" onClick={onRetry} className="font-medium underline-offset-2 hover:underline">
            {t('retry')}
          </button>
        </span>
      ) : status === 'conflict' ? (
        <span className="inline-flex items-center gap-1.5 text-attention">
          <AlertTriangle className="size-3.5" aria-hidden /> {t('conflict')}
        </span>
      ) : (
        <span className="inline-flex items-center gap-1.5 text-ink-3">
          <Clock className="size-3.5" aria-hidden />
          {savedAt ? t('savedAt', { time: savedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }) : t('saved')}
        </span>
      )}
    </div>
  );
}

function ClientPreviewDialog({ open, onOpenChange, shared, title, content, portalEnabled }: { open: boolean; onOpenChange: (o: boolean) => void; shared: boolean; title: string; content: unknown; portalEnabled: boolean }) {
  const t = useTranslations('documents.preview');
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={t('title')} description={t('description')} size="lg">
        {!shared ? (
          <Notice tone="neutral" icon={<Eye />}>
            {t('notShared')}
          </Notice>
        ) : (
          <>
            {!portalEnabled ? (
              <Notice tone="attention" icon={<AlertTriangle />} className="mb-3">
                {t('portalOff')}
              </Notice>
            ) : null}
            <div className="rounded-lg border border-dashed border-accent/50">
              <p className="flex items-center gap-1.5 border-b border-dashed border-accent/50 bg-accent-soft/50 px-4 py-1.5 text-[12px] font-medium text-accent">
                <Eye className="size-3.5" aria-hidden /> {t('banner')}
              </p>
              <div className="px-5 py-5">
                <h2 className="font-serif text-[28px] leading-tight text-ink">{title}</h2>
                <div className="mt-4">{isEmptyDoc(content) ? <p className="text-[13px] text-ink-3">{t('empty')}</p> : <RichText doc={content} />}</div>
              </div>
            </div>
            <p className="mt-3 text-[12px] text-ink-3">{t('footnote')}</p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
