'use client';

import { CheckCircle2, CornerDownRight, Lock, MoreHorizontal, Pencil, Smile, Trash2, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { createCommentAction, deleteCommentAction, editCommentAction, resolveCommentAction, toggleReactionAction } from '@/actions/comments';
import { Avatar } from '@/components/domain/avatar';
import { RelativeTime } from '@/components/domain/dates';
import { RichTextEditor, type Mentionable } from '@/components/rich-text/editor';
import { isEmptyDoc, RichText } from '@/components/rich-text/render';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/cn';
import { useAction } from '@/lib/use-action';

const EMOJI = ['👍', '🎉', '❤️', '👀', '✅', '😄'];

export interface CommentView {
  id: string;
  parentId: string | null;
  authorId: string | null;
  authorName: string | null;
  authorColor: string | null;
  authorIsClient: boolean;
  body: unknown;
  visibility: 'internal' | 'client';
  resolvedAt: Date | null;
  editedAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
  reactions: { emoji: string; count: number; mine: boolean }[];
}

export interface ThreadContext {
  isClient: boolean;
  clientThread: boolean;
  canInternal: boolean;
  canClient: boolean;
}

type Parent = { type: 'task' | 'document' | 'request' | 'approval'; id: string };

/**
 * Comments with two audiences. On items shared with a client, the team picks "Internal"
 * or "Visible to client" for each comment, and the difference is always labelled.
 * Clients only ever see client-visible comments.
 */
export function CommentThread({ org, parent, comments, context, people, currentUserId, isAdmin, title }: { org: string; parent: Parent; comments: CommentView[]; context: ThreadContext; people: Mentionable[]; currentUserId: string; isAdmin?: boolean; title?: string }) {
  const t = useTranslations('comments');
  const roots = useMemo(() => comments.filter((c) => !c.parentId), [comments]);
  const replies = useMemo(() => {
    const m = new Map<string, CommentView[]>();
    for (const c of comments) if (c.parentId) m.set(c.parentId, [...(m.get(c.parentId) ?? []), c]);
    return m;
  }, [comments]);
  const canPost = context.canInternal || context.canClient;
  return (
    <section aria-label={title ?? t('title')} className="flex flex-col gap-4">
      {title !== '' ? (
        <h2 className="text-[13px] font-semibold text-ink">
          {title ?? t('title')} <span className="font-normal text-ink-3">{comments.filter((c) => !c.deletedAt).length || ''}</span>
        </h2>
      ) : null}
      {roots.length === 0 ? <p className="text-[13px] text-ink-3">{canPost ? t('emptyCanPost') : t('empty')}</p> : null}
      <ol className="flex flex-col gap-4">
        {roots.map((c) => (
          <li key={c.id}>
            <CommentItem org={org} comment={c} context={context} people={people} currentUserId={currentUserId} isAdmin={isAdmin} parent={parent} canReply={canPost} />
            {replies.get(c.id)?.length ? (
              <ol className="mt-3 ml-9 flex flex-col gap-3 border-l border-line pl-4">
                {replies.get(c.id)!.map((r) => (
                  <li key={r.id}>
                    <CommentItem org={org} comment={r} context={context} people={people} currentUserId={currentUserId} isAdmin={isAdmin} parent={parent} />
                  </li>
                ))}
              </ol>
            ) : null}
          </li>
        ))}
      </ol>
      {canPost ? <Composer org={org} parent={parent} context={context} people={people} /> : null}
    </section>
  );
}

function VisibilityTag({ visibility, clientThread }: { visibility: 'internal' | 'client'; clientThread: boolean }) {
  const t = useTranslations('comments');
  if (!clientThread) return null;
  return visibility === 'client' ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-1.5 text-[11px] font-medium text-accent">
      <Users className="size-3" aria-hidden /> {t('visibleToClient')}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-1.5 text-[11px] font-medium text-ink-3">
      <Lock className="size-3" aria-hidden /> {t('internal')}
    </span>
  );
}

function CommentItem({ org, comment: c, context, people, currentUserId, isAdmin, parent, canReply }: { org: string; comment: CommentView; context: ThreadContext; people: Mentionable[]; currentUserId: string; isAdmin?: boolean; parent: Parent; canReply?: boolean }) {
  const t = useTranslations('comments');
  const { call, pending } = useAction();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<unknown>(c.body);
  const [confirm, setConfirm] = useState(false);
  const [replying, setReplying] = useState(false);
  const mine = c.authorId === currentUserId;

  if (c.deletedAt) {
    return <p className="flex items-center gap-2 py-1 text-[13px] text-ink-3 italic">{t('deleted')}</p>;
  }
  return (
    <article className={cn('group flex gap-3', c.resolvedAt && 'opacity-70')}>
      <Avatar name={c.authorName} color={c.authorColor} size="md" title="" />
      <div className="min-w-0 flex-1">
        <header className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
          <span className="font-medium text-ink">{c.authorName ?? t('formerMember')}</span>
          {c.authorIsClient && !context.isClient ? <span className="rounded-full border border-line px-1.5 text-[11px] text-ink-3">{t('client')}</span> : null}
          <RelativeTime date={c.createdAt} className="text-[12px] text-ink-3" />
          {c.editedAt ? <span className="text-[12px] text-ink-3">· {t('edited')}</span> : null}
          {!context.isClient ? <VisibilityTag visibility={c.visibility} clientThread={context.clientThread} /> : null}
          {c.resolvedAt ? (
            <span className="inline-flex items-center gap-1 text-[12px] text-success">
              <CheckCircle2 className="size-3.5" aria-hidden /> {t('resolved')}
            </span>
          ) : null}
          <div className="ml-auto flex items-center opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
            <Popover>
              <PopoverTrigger asChild>
                <Button size="icon-sm" variant="ghost" aria-label={t('react')}>
                  <Smile />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="flex gap-1 p-1.5" align="end">
                {EMOJI.map((e) => (
                  <button key={e} type="button" className="flex size-8 items-center justify-center rounded-md text-[16px] hover:bg-surface-2" onClick={() => call(() => toggleReactionAction(org, c.id, e))} aria-label={t('reactWith', { emoji: e })}>
                    {e}
                  </button>
                ))}
              </PopoverContent>
            </Popover>
            {mine || isAdmin || !context.isClient ? (
              <Menu>
                <MenuTrigger asChild>
                  <Button size="icon-sm" variant="ghost" aria-label={t('actions')}>
                    <MoreHorizontal />
                  </Button>
                </MenuTrigger>
                <MenuContent align="end">
                  {mine ? (
                    <MenuItem onSelect={() => setEditing(true)}>
                      <Pencil /> {t('edit')}
                    </MenuItem>
                  ) : null}
                  {!c.parentId && (!context.isClient || mine) ? (
                    <MenuItem onSelect={() => call(() => resolveCommentAction(org, c.id, !c.resolvedAt))}>
                      <CheckCircle2 /> {c.resolvedAt ? t('reopen') : t('resolve')}
                    </MenuItem>
                  ) : null}
                  {mine || isAdmin ? (
                    <MenuItem danger onSelect={() => setConfirm(true)}>
                      <Trash2 /> {t('delete')}
                    </MenuItem>
                  ) : null}
                </MenuContent>
              </Menu>
            ) : null}
          </div>
        </header>
        {editing ? (
          <div className="mt-2 rounded-lg border border-line-strong bg-surface p-2 focus-within:border-accent">
            <RichTextEditor value={c.body} onChange={setDraft} people={people} autoFocus toolbar="none" contentClassName="compact min-h-10 px-1" onSubmit={async () => { const r = await call(() => editCommentAction(org, { commentId: c.id, body: draft })); if (r.ok) setEditing(false); }} />
            <div className="mt-2 flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                {t('cancel')}
              </Button>
              <Button size="sm" variant="primary" loading={pending} onClick={async () => { const r = await call(() => editCommentAction(org, { commentId: c.id, body: draft })); if (r.ok) setEditing(false); }}>
                {t('save')}
              </Button>
            </div>
          </div>
        ) : (
          <RichText doc={c.body} compact className="mt-1" />
        )}
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {c.reactions.map((r) => (
            <button key={r.emoji} type="button" onClick={() => call(() => toggleReactionAction(org, c.id, r.emoji))} aria-pressed={r.mine} aria-label={t('reactionCount', { emoji: r.emoji, count: r.count })} className={cn('inline-flex h-6 items-center gap-1 rounded-full border px-2 text-[12px]', r.mine ? 'border-accent/40 bg-accent-soft text-accent' : 'border-line bg-surface text-ink-2 hover:bg-surface-2')}>
              <span>{r.emoji}</span>
              <span className="tabular-nums">{r.count}</span>
            </button>
          ))}
          {canReply && !c.parentId ? (
            <button type="button" onClick={() => setReplying((v) => !v)} className="inline-flex items-center gap-1 text-[12px] text-ink-3 hover:text-ink">
              <CornerDownRight className="size-3.5" aria-hidden /> {t('reply')}
            </button>
          ) : null}
        </div>
        {replying ? (
          <div className="mt-2">
            <Composer org={org} parent={parent} context={context} people={people} replyToId={c.id} defaultVisibility={c.visibility} onDone={() => setReplying(false)} compact />
          </div>
        ) : null}
      </div>
      <ConfirmDialog open={confirm} onOpenChange={setConfirm} title={t('deleteTitle')} description={t('deleteBody')} confirmLabel={t('delete')} onConfirm={async () => (await call(() => deleteCommentAction(org, c.id))).ok} />
    </article>
  );
}

function Composer({ org, parent, context, people, replyToId, defaultVisibility, onDone, compact }: { org: string; parent: Parent; context: ThreadContext; people: Mentionable[]; replyToId?: string; defaultVisibility?: 'internal' | 'client'; onDone?: () => void; compact?: boolean }) {
  const t = useTranslations('comments');
  const { call, pending } = useAction();
  const [body, setBody] = useState<unknown>(null);
  const [nonce, setNonce] = useState(0);
  const initialVisibility: 'internal' | 'client' = defaultVisibility ?? (context.canInternal ? 'internal' : 'client');
  const [visibility, setVisibility] = useState<'internal' | 'client'>(context.isClient ? 'client' : initialVisibility);
  const choose = context.clientThread && context.canInternal && context.canClient;

  const submit = async () => {
    if (!body || isEmptyDoc(body)) return;
    const res = await call(() => createCommentAction(org, { parent, body, visibility: context.clientThread ? visibility : context.isClient ? 'client' : 'internal', replyToId: replyToId ?? null }));
    if (res.ok) {
      setBody(null);
      setNonce((n) => n + 1);
      onDone?.();
    }
  };

  return (
    <div className={cn('rounded-lg border bg-surface transition-colors focus-within:border-accent', visibility === 'client' && context.clientThread && !context.isClient ? 'border-accent/40' : 'border-line-strong')}>
      <RichTextEditor key={nonce} value={null} onChange={setBody} people={context.isClient ? [] : people} placeholder={replyToId ? t('replyPlaceholder') : context.isClient ? t('clientPlaceholder') : t('placeholder')} toolbar="none" contentClassName={cn('compact px-3 pt-2.5', compact ? 'min-h-10' : 'min-h-16')} onSubmit={submit} ariaLabel={t('composerLabel')} />
      <div className="flex flex-wrap items-center justify-between gap-2 px-2 pt-1 pb-2">
        {choose ? (
          <div role="radiogroup" aria-label={t('audience')} className="flex rounded-md border border-line p-0.5 text-[12px]">
            {(['internal', 'client'] as const).map((v) => (
              <button key={v} type="button" role="radio" aria-checked={visibility === v} onClick={() => setVisibility(v)} className={cn('inline-flex h-6 items-center gap-1 rounded px-2', visibility === v ? (v === 'client' ? 'bg-accent-soft font-medium text-accent' : 'bg-surface-3 font-medium text-ink') : 'text-ink-3 hover:text-ink')}>
                {v === 'client' ? <Users className="size-3" aria-hidden /> : <Lock className="size-3" aria-hidden />}
                {v === 'client' ? t('visibleToClient') : t('internal')}
              </button>
            ))}
          </div>
        ) : (
          <span className="px-1 text-[12px] text-ink-3">{context.isClient ? t('clientSees') : context.clientThread ? t('clientOnlyNote') : t('internalNote')}</span>
        )}
        <div className="flex items-center gap-2">
          <span className="hidden text-[11px] text-ink-3 sm:inline">{t('submitHint')}</span>
          {onDone ? (
            <Button size="sm" variant="ghost" onClick={onDone}>
              {t('cancel')}
            </Button>
          ) : null}
          <Button size="sm" variant="primary" loading={pending} onClick={submit}>
            {replyToId ? t('reply') : t('post')}
          </Button>
        </div>
      </div>
    </div>
  );
}
