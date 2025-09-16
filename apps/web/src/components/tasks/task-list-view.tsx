'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import { CheckSquare, SearchX } from 'lucide-react';
import { Avatar } from '@/components/domain/avatar';
import { StatusIcon } from '@/components/domain/badges';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { EmptyState } from '@/components/ui/primitives';
import { BulkBar } from './bulk-bar';
import type { GroupBy } from './filters';
import { QuickAdd } from './quick-add';
import { TaskRow } from './task-row';
import type { PersonOption, StatusOption, TaskRowData } from './types';

interface Group {
  key: string;
  label: string;
  icon?: React.ReactNode;
  tasks: TaskRowData[];
  statusId?: string;
  milestoneId?: string;
}

export function TaskListView({
  org,
  tasks,
  statuses,
  statusesByProject,
  people,
  labels,
  milestones,
  groupBy = 'status',
  canEdit,
  canCreate,
  projectId,
  showProject,
  onOpen,
  activeRef,
  filtered,
  onClearFilters,
}: {
  org: string;
  tasks: TaskRowData[];
  statuses: StatusOption[];
  statusesByProject?: Record<string, StatusOption[]>;
  people: PersonOption[];
  labels: { id: string; name: string; color: string }[];
  milestones: { id: string; name: string }[];
  groupBy?: GroupBy;
  canEdit: boolean;
  canCreate: boolean;
  projectId: string | null;
  showProject?: boolean;
  onOpen?: (ref: string) => void;
  activeRef?: string | null;
  filtered?: boolean;
  onClearFilters?: () => void;
}) {
  const t = useTranslations('tasks');
  const tc = useTranslations('common');
  const te = useTranslations('enums');
  const [selected, setSelected] = useState<string[]>([]);
  useEffect(() => setSelected((s) => s.filter((id) => tasks.some((x) => x.id === id))), [tasks]);

  const groups = useMemo<Group[]>(() => {
    if (groupBy === 'none') return [{ key: 'all', label: t('groups.all'), tasks }];
    if (groupBy === 'assignee') {
      const byId = new Map<string, TaskRowData[]>();
      for (const tk of tasks) byId.set(tk.assigneeId ?? '', [...(byId.get(tk.assigneeId ?? '') ?? []), tk]);
      return [...byId.entries()]
        .sort((a, b) => (a[0] === '' ? 1 : b[0] === '' ? -1 : (a[1][0]?.assigneeName ?? '').localeCompare(b[1][0]?.assigneeName ?? '')))
        .map(([id, list]) => ({ key: id || 'none', label: id ? (list[0]?.assigneeName ?? '') : tc('unassigned'), icon: id ? <Avatar name={list[0]?.assigneeName ?? ''} color={list[0]?.assigneeColor} size="xs" title="" /> : undefined, tasks: list }));
    }
    if (groupBy === 'priority') {
      const order = ['urgent', 'high', 'medium', 'low', 'none'] as const;
      return order.map((p) => ({ key: p, label: te(`priority.${p}`), tasks: tasks.filter((tk) => tk.priority === p) })).filter((g) => g.tasks.length);
    }
    if (groupBy === 'milestone') {
      const list = milestones.map((m) => ({ key: m.id, label: m.name, milestoneId: m.id, tasks: tasks.filter((tk) => tk.milestoneId === m.id) }));
      const none = tasks.filter((tk) => !tk.milestoneId);
      return [...list, ...(none.length ? [{ key: 'none', label: t('groups.noMilestone'), tasks: none }] : [])].filter((g) => g.tasks.length || g.milestoneId);
    }
    const byStatus = statuses.length ? statuses : dedupeStatuses(tasks);
    return byStatus
      .map((s) => ({ key: s.id, label: s.name, statusId: s.id, icon: <StatusIcon category={s.category} />, tasks: tasks.filter((tk) => tk.statusId === s.id) }))
      .filter((g) => g.tasks.length || (statuses.length > 0 && canCreate));
  }, [groupBy, tasks, statuses, milestones, t, tc, te, canCreate]);

  if (!tasks.length) {
    return (
      <div className="rounded-lg border border-line bg-surface">
        {filtered ? (
          <EmptyState icon={<SearchX />} title={t('empty.filtered')} description={t('empty.filteredBody')} action={onClearFilters ? <Button size="sm" onClick={onClearFilters}>{tc('clearFilters')}</Button> : null} />
        ) : (
          <EmptyState icon={<CheckSquare />} title={t('empty.title')} description={canCreate ? t('empty.body') : t('empty.bodyReader')} />
        )}
        {!filtered && canCreate && projectId ? (
          <div className="border-t border-line px-3 py-2">
            <QuickAdd org={org} projectId={projectId} />
          </div>
        ) : null}
      </div>
    );
  }

  const allSelectable = tasks.map((tk) => tk.id);

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-hidden rounded-lg border border-line bg-surface">
        {canEdit ? (
          <div className="flex items-center gap-2 border-b border-line px-3 py-1.5">
            <Checkbox
              checked={selected.length === 0 ? false : selected.length === allSelectable.length ? true : 'indeterminate'}
              onCheckedChange={(v) => setSelected(v ? allSelectable : [])}
              aria-label={t('selectAll')}
            />
            <span className="text-[12px] text-ink-3">{selected.length ? t('bulk.selected', { count: selected.length }) : t('selectAll')}</span>
          </div>
        ) : null}
        {groups.map((g) => (
          <section key={g.key} aria-label={g.label}>
            <h3 className="flex items-center gap-2 border-b border-line bg-surface-2/60 px-3 py-1.5 text-[12px] font-semibold text-ink-2">
              {g.icon}
              {g.label}
              <span className="font-normal text-ink-3 tabular-nums">{g.tasks.length}</span>
            </h3>
            <ul className="divide-y divide-line">
              {g.tasks.map((tk) => (
                <li key={tk.id}>
                  <TaskRow
                    org={org}
                    task={tk}
                    statuses={statusesByProject?.[tk.projectId] ?? statuses}
                    canEdit={canEdit && !tk.archivedAt}
                    showProject={showProject}
                    selected={selected.includes(tk.id)}
                    onSelect={canEdit ? (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id])) : undefined}
                    onOpen={onOpen}
                    active={activeRef === tk.ref}
                  />
                </li>
              ))}
            </ul>
            {canCreate && projectId ? (
              <div className="border-b border-line px-2 py-1">
                <QuickAdd org={org} projectId={projectId} statusId={g.statusId} milestoneId={g.milestoneId} compact label={t('quickAdd.openIn', { group: g.label })} />
              </div>
            ) : null}
          </section>
        ))}
      </div>
      {selected.length ? <BulkBar org={org} ids={selected} statuses={statuses.length ? statuses : dedupeStatuses(tasks)} people={people} labels={labels} onDone={() => setSelected([])} /> : null}
    </div>
  );
}

/** My Work spans projects: build a status list from the tasks themselves, by category. */
function dedupeStatuses(tasks: TaskRowData[]): StatusOption[] {
  const order = ['backlog', 'unstarted', 'started', 'review', 'completed', 'canceled'];
  const seen = new Map<string, StatusOption>();
  for (const tk of tasks) if (!seen.has(tk.statusId)) seen.set(tk.statusId, { id: tk.statusId, name: tk.statusName, category: tk.statusCategory, position: order.indexOf(tk.statusCategory) });
  return [...seen.values()].sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
}
