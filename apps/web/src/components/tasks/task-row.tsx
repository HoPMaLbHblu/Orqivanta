'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Archive, Ban, Globe, ListChecks, MessageSquare, Paperclip } from 'lucide-react';
import { updateTaskAction } from '@/actions/tasks';
import { Avatar } from '@/components/domain/avatar';
import { LabelChip, PriorityIcon, StatusIcon } from '@/components/domain/badges';
import { DueDate } from '@/components/domain/dates';
import { Checkbox } from '@/components/ui/checkbox';
import { Menu, MenuContent, MenuItem, MenuLabel, MenuTrigger } from '@/components/ui/menu';
import { Mono } from '@/components/ui/primitives';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/cn';
import { useAction } from '@/lib/use-action';
import type { StatusOption, TaskRowData } from './types';

/**
 * One task in a list. The status icon is a menu for a quick change; the title is a link,
 * so the row works with the keyboard and middle-click even when a panel is available.
 */
export function TaskRow({ org, task, statuses, canEdit, showProject, selected, onSelect, onOpen, active }: { org: string; task: TaskRowData; statuses: StatusOption[]; canEdit: boolean; showProject?: boolean; selected?: boolean; onSelect?: (id: string, shift: boolean) => void; onOpen?: (ref: string) => void; active?: boolean }) {
  const t = useTranslations('tasks');
  const { call, pending } = useAction();
  const href = `/${org}/tasks/${task.ref}`;

  const changeStatus = async (statusId: string) => {
    await call(() => updateTaskAction(org, { taskId: task.id, version: task.version, statusId }), { success: t('row.statusChanged') });
  };

  return (
    <div className={cn('group flex items-center gap-2 px-2 py-1.5 sm:px-3', active ? 'bg-accent-soft/50' : 'hover:bg-surface-2', selected && 'bg-accent-soft/40')}>
      {onSelect ? (
        <span className="flex size-6 shrink-0 items-center justify-center">
          <Checkbox checked={Boolean(selected)} onCheckedChange={() => onSelect(task.id, false)} aria-label={t('row.select', { ref: task.ref })} />
        </span>
      ) : null}

      {canEdit && statuses.length ? (
        <Menu>
          <MenuTrigger asChild>
            <button type="button" aria-label={t('row.changeStatus', { ref: task.ref, status: task.statusName })} disabled={pending} className="inline-flex size-6 shrink-0 items-center justify-center rounded-md hover:bg-surface-3">
              <StatusIcon category={task.statusCategory} />
            </button>
          </MenuTrigger>
          <MenuContent>
            <MenuLabel>{t('row.status')}</MenuLabel>
            {statuses.map((s) => (
              <MenuItem key={s.id} onSelect={() => changeStatus(s.id)} disabled={s.id === task.statusId}>
                <StatusIcon category={s.category} /> {s.name}
              </MenuItem>
            ))}
          </MenuContent>
        </Menu>
      ) : (
        <span className="inline-flex size-6 shrink-0 items-center justify-center" title={task.statusName}>
          <StatusIcon category={task.statusCategory} />
        </span>
      )}

      <Mono className="hidden w-[76px] shrink-0 sm:inline">{task.ref}</Mono>

      {onOpen ? (
        <button type="button" onClick={() => onOpen(task.ref)} className="min-w-0 flex-1 truncate text-left text-[13px] text-ink hover:underline">
          {task.parentId ? <span className="mr-1 text-ink-3" aria-label={t('row.subtask')}>↳</span> : null}
          {task.title}
        </button>
      ) : (
        <Link href={href} className="min-w-0 flex-1 truncate text-[13px] text-ink hover:underline">
          {task.parentId ? <span className="mr-1 text-ink-3" aria-label={t('row.subtask')}>↳</span> : null}
          {task.title}
        </Link>
      )}

      <span className="hidden items-center gap-1.5 md:flex">
        {task.labels.slice(0, 2).map((l) => (
          <LabelChip key={l.id} name={l.name} color={l.color} />
        ))}
        {task.labels.length > 2 ? <span className="text-[11px] text-ink-3">+{task.labels.length - 2}</span> : null}
      </span>

      <span className="hidden items-center gap-2 text-[12px] text-ink-3 sm:flex">
        {task.blocked ? (
          <Tooltip content={t('row.blocked')}>
            <span className="inline-flex items-center text-attention">
              <Ban className="size-3.5" aria-label={t('row.blocked')} />
            </span>
          </Tooltip>
        ) : null}
        {task.sharedWithClient ? <Globe className="size-3.5 text-accent" aria-label={t('row.shared')} /> : null}
        {task.archivedAt ? <Archive className="size-3.5" aria-label={t('row.archived')} /> : null}
        {task.subtaskTotal ? (
          <span className="inline-flex items-center gap-0.5 tabular-nums" title={t('row.subtasks')}>
            <ListChecks className="size-3.5" aria-hidden />
            {task.subtaskDone}/{task.subtaskTotal}
          </span>
        ) : null}
        {task.commentCount ? (
          <span className="inline-flex items-center gap-0.5 tabular-nums" title={t('row.comments')}>
            <MessageSquare className="size-3.5" aria-hidden />
            {task.commentCount}
          </span>
        ) : null}
        {task.attachmentCount ? (
          <span className="inline-flex items-center gap-0.5 tabular-nums" title={t('row.attachments')}>
            <Paperclip className="size-3.5" aria-hidden />
            {task.attachmentCount}
          </span>
        ) : null}
      </span>

      {showProject ? (
        <Link href={`/${org}/projects/${task.projectKey}`} className="hidden w-28 shrink-0 truncate text-[12px] text-ink-3 hover:text-ink hover:underline lg:block">
          {task.projectName}
        </Link>
      ) : null}

      <PriorityIcon priority={task.priority} className="shrink-0" />
      <span className="hidden w-[90px] shrink-0 justify-end sm:flex">{task.dueDate ? <DueDate date={task.dueDate} done={task.statusCategory === 'completed'} short /> : null}</span>
      <span className="w-7 shrink-0 text-right">
        {task.assigneeName ? <Avatar name={task.assigneeName} color={task.assigneeColor} size="sm" title={task.assigneeName} /> : <span className="inline-block size-6 rounded-full border border-dashed border-line-strong" aria-label={t('row.unassigned')} />}
      </span>
    </div>
  );
}
