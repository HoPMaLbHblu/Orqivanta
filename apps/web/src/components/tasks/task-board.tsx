'use client';

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Ban, Globe, GripVertical, ListChecks, MessageSquare, MoveRight, Paperclip } from 'lucide-react';
import { moveTaskAction } from '@/actions/tasks';
import { Avatar } from '@/components/domain/avatar';
import { LabelChip, PriorityIcon, StatusIcon } from '@/components/domain/badges';
import { DueDate } from '@/components/domain/dates';
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from '@/components/ui/menu';
import { Mono } from '@/components/ui/primitives';
import { cn } from '@/lib/cn';
import { useAction } from '@/lib/use-action';
import { QuickAdd } from './quick-add';
import type { StatusOption, TaskRowData } from './types';

type Columns = Record<string, TaskRowData[]>;

function build(statuses: StatusOption[], tasks: TaskRowData[]): Columns {
  const cols: Columns = {};
  for (const s of statuses) cols[s.id] = [];
  for (const tk of tasks) (cols[tk.statusId] ??= []).push(tk);
  for (const id of Object.keys(cols)) cols[id]!.sort((a, b) => a.position - b.position);
  return cols;
}

/**
 * Status board. Cards can be dragged with a pointer, moved with the keyboard through
 * dnd-kit's keyboard sensor, or moved from the card's own menu — every path calls the
 * same moveTask service. A failed move puts the card back where it was.
 */
export function TaskBoard({ org, projectId, statuses, tasks, canEdit, canCreate, onOpen, activeRef }: { org: string; projectId: string; statuses: StatusOption[]; tasks: TaskRowData[]; canEdit: boolean; canCreate: boolean; onOpen?: (ref: string) => void; activeRef?: string | null }) {
  const t = useTranslations('tasks');
  const { call } = useAction();
  const [cols, setCols] = useState<Columns>(() => build(statuses, tasks));
  const [dragging, setDragging] = useState<TaskRowData | null>(null);
  const serverState = useRef(cols);

  useEffect(() => {
    const next = build(statuses, tasks);
    serverState.current = next;
    setCols(next);
  }, [statuses, tasks]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const findTask = (id: string) => Object.values(cols).flat().find((tk) => tk.id === id) ?? null;
  const columnOf = (id: string) => Object.keys(cols).find((sid) => cols[sid]!.some((tk) => tk.id === id));

  const commit = async (taskId: string, statusId: string, afterId: string | null, version: number, snapshot: Columns) => {
    const res = await call(() => moveTaskAction(org, { taskId, version, statusId, afterId }), { refresh: true });
    if (!res.ok) setCols(snapshot);
  };

  const move = (taskId: string, toStatus: string, toIndex: number) => {
    const snapshot = cols;
    const from = columnOf(taskId);
    const task = findTask(taskId);
    if (!from || !task) return;
    const next: Columns = Object.fromEntries(Object.entries(cols).map(([k, v]) => [k, [...v]]));
    next[from] = next[from]!.filter((tk) => tk.id !== taskId);
    const target = (next[toStatus] ??= []);
    const index = Math.max(0, Math.min(toIndex, target.length));
    target.splice(index, 0, { ...task, statusId: toStatus });
    setCols(next);
    const afterId = index > 0 ? target[index - 1]!.id : null;
    void commit(taskId, toStatus, afterId, task.version, snapshot);
  };

  const onDragStart = (e: DragStartEvent) => setDragging(findTask(String(e.active.id)));

  const onDragEnd = (e: DragEndEvent) => {
    setDragging(null);
    const { active, over } = e;
    if (!over) return;
    const taskId = String(active.id);
    const overId = String(over.id);
    const from = columnOf(taskId);
    if (!from) return;
    const toStatus = cols[overId] ? overId : columnOf(overId);
    if (!toStatus) return;
    const list = cols[toStatus]!;
    let index = cols[overId] ? list.length : list.findIndex((tk) => tk.id === overId);
    if (index < 0) index = list.length;
    if (from === toStatus) {
      const currentIndex = list.findIndex((tk) => tk.id === taskId);
      if (currentIndex === index) return;
      if (currentIndex < index) index -= 0;
    }
    move(taskId, toStatus, index);
  };

  const columns = useMemo(() => statuses.map((s) => ({ status: s, tasks: cols[s.id] ?? [] })), [statuses, cols]);
  const total = columns.reduce((n, c) => n + c.tasks.length, 0);

  return (
    <DndContext id="task-board" sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)} accessibility={{ announcements: { onDragStart: ({ active }) => t('board.a11y.pickedUp', { task: String(active.id) }), onDragEnd: () => t('board.a11y.dropped') } }}>
      <p className="sr-only">{t('board.keyboardHint')}</p>
      <div className="flex gap-3 overflow-x-auto pb-3">
        {columns.map((c) => (
          <Column key={c.status.id} id={c.status.id} status={c.status} count={c.tasks.length} total={total}>
            <SortableContext items={c.tasks.map((tk) => tk.id)} strategy={verticalListSortingStrategy}>
              <ul className="flex flex-col gap-2">
                {c.tasks.map((tk, i) => (
                  <li key={tk.id}>
                    <Card
                      org={org}
                      task={tk}
                      statuses={statuses}
                      canEdit={canEdit}
                      onOpen={onOpen}
                      active={activeRef === tk.ref}
                      index={i}
                      count={c.tasks.length}
                      onMoveTo={(statusId) => move(tk.id, statusId, 0)}
                      onReorder={(dir) => move(tk.id, c.status.id, dir === 'up' ? Math.max(0, i - 1) : Math.min(c.tasks.length - 1, i + 1))}
                    />
                  </li>
                ))}
              </ul>
            </SortableContext>
            {canCreate ? (
              <div className="mt-2">
                <QuickAdd org={org} projectId={projectId} statusId={c.status.id} compact label={t('quickAdd.openIn', { group: c.status.name })} />
              </div>
            ) : null}
          </Column>
        ))}
      </div>
      <DragOverlay>{dragging ? <div className="w-[272px] rotate-1 rounded-md border border-accent/40 bg-surface p-2.5 shadow-pop"><p className="text-[13px] font-medium text-ink">{dragging.title}</p></div> : null}</DragOverlay>
    </DndContext>
  );
}

function Column({ id, status, count, total, children }: { id: string; status: StatusOption; count: number; total: number; children: React.ReactNode }) {
  const t = useTranslations('tasks');
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <section aria-label={t('board.column', { name: status.name, count })} className="flex w-[288px] shrink-0 flex-col">
      <h3 className="flex items-center gap-2 px-1 pb-2 text-[12px] font-semibold text-ink-2">
        <StatusIcon category={status.category} />
        {status.name}
        <span className="font-normal text-ink-3 tabular-nums">{count}</span>
        {total > 0 && count === 0 ? <span className="sr-only">{t('board.emptyColumn')}</span> : null}
      </h3>
      <div ref={setNodeRef} className={cn('min-h-24 flex-1 rounded-lg border bg-surface-2/40 p-2 transition-colors', isOver ? 'border-accent/50 bg-accent-soft/40' : 'border-line')}>
        {children}
      </div>
    </section>
  );
}

function Card({ org, task, statuses, canEdit, onOpen, active, index, count, onMoveTo, onReorder }: { org: string; task: TaskRowData; statuses: StatusOption[]; canEdit: boolean; onOpen?: (ref: string) => void; active?: boolean; index: number; count: number; onMoveTo: (statusId: string) => void; onReorder: (dir: 'up' | 'down') => void }) {
  const t = useTranslations('tasks');
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id, disabled: !canEdit });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('rounded-md border bg-surface p-2.5', active ? 'border-accent' : 'border-line', isDragging && 'opacity-40')}
    >
      <div className="flex items-start gap-1.5">
        {canEdit ? (
          <button type="button" {...attributes} {...listeners} aria-label={t('board.drag', { ref: task.ref })} className="-ml-1 inline-flex size-6 shrink-0 cursor-grab items-center justify-center rounded text-ink-3 hover:bg-surface-2 hover:text-ink">
            <GripVertical className="size-4" aria-hidden />
          </button>
        ) : null}
        <div className="min-w-0 flex-1">
          {onOpen ? (
            <button type="button" onClick={() => onOpen(task.ref)} className="block w-full text-left text-[13px] leading-snug font-medium text-ink hover:underline">
              {task.title}
            </button>
          ) : (
            <a href={`/${org}/tasks/${task.ref}`} className="block text-[13px] leading-snug font-medium text-ink hover:underline">
              {task.title}
            </a>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Mono className="text-[11px]">{task.ref}</Mono>
            <PriorityIcon priority={task.priority} />
            {task.blocked ? <Ban className="size-3.5 text-attention" aria-label={t('row.blocked')} /> : null}
            {task.sharedWithClient ? <Globe className="size-3.5 text-accent" aria-label={t('row.shared')} /> : null}
            {task.subtaskTotal ? (
              <span className="inline-flex items-center gap-0.5 text-[11px] tabular-nums text-ink-3" title={t('row.subtasks')}>
                <ListChecks className="size-3.5" aria-hidden />
                {task.subtaskDone}/{task.subtaskTotal}
              </span>
            ) : null}
            {task.commentCount ? (
              <span className="inline-flex items-center gap-0.5 text-[11px] tabular-nums text-ink-3" title={t('row.comments')}>
                <MessageSquare className="size-3.5" aria-hidden />
                {task.commentCount}
              </span>
            ) : null}
            {task.attachmentCount ? (
              <span className="inline-flex items-center gap-0.5 text-[11px] tabular-nums text-ink-3" title={t('row.attachments')}>
                <Paperclip className="size-3.5" aria-hidden />
                {task.attachmentCount}
              </span>
            ) : null}
          </div>
          {task.labels.length ? (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {task.labels.map((l) => (
                <LabelChip key={l.id} name={l.name} color={l.color} />
              ))}
            </div>
          ) : null}
          <div className="mt-2 flex items-center gap-2">
            {task.dueDate ? <DueDate date={task.dueDate} done={task.statusCategory === 'completed'} short /> : null}
            <span className="ml-auto flex items-center gap-1">
              {task.assigneeName ? <Avatar name={task.assigneeName} color={task.assigneeColor} size="sm" title={task.assigneeName} /> : null}
              {canEdit ? (
                <Menu>
                  <MenuTrigger asChild>
                    <button type="button" aria-label={t('board.moveMenu', { ref: task.ref })} className="inline-flex size-6 items-center justify-center rounded text-ink-3 hover:bg-surface-2 hover:text-ink">
                      <MoveRight className="size-4" aria-hidden />
                    </button>
                  </MenuTrigger>
                  <MenuContent align="end">
                    <MenuLabel>{t('board.moveTo')}</MenuLabel>
                    {statuses.map((s) => (
                      <MenuItem key={s.id} disabled={s.id === task.statusId} onSelect={() => onMoveTo(s.id)}>
                        <StatusIcon category={s.category} /> {s.name}
                      </MenuItem>
                    ))}
                    <MenuSeparator />
                    <MenuItem disabled={index === 0} onSelect={() => onReorder('up')}>
                      <ArrowUp /> {t('board.moveUp')}
                    </MenuItem>
                    <MenuItem disabled={index >= count - 1} onSelect={() => onReorder('down')}>
                      <ArrowDown /> {t('board.moveDown')}
                    </MenuItem>
                  </MenuContent>
                </Menu>
              ) : null}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
