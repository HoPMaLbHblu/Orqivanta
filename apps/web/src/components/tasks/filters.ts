import type { TaskFilter } from '@orqivanta/core';

export type TaskLayout = 'list' | 'board';
export type GroupBy = 'status' | 'assignee' | 'priority' | 'milestone' | 'none';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CATEGORIES = ['backlog', 'unstarted', 'started', 'review', 'completed', 'canceled'] as const;
const PRIORITIES = ['none', 'low', 'medium', 'high', 'urgent'] as const;
const DUES = ['overdue', 'today', 'week', 'none', 'any'] as const;
const SORTS = ['manual', 'priority', 'due', 'created', 'updated', 'title'] as const;

export interface TaskQuery {
  assignee?: 'me' | 'none' | string;
  categories?: (typeof CATEGORIES)[number][];
  priorities?: (typeof PRIORITIES)[number][];
  labelIds?: string[];
  milestoneId?: string;
  due?: (typeof DUES)[number];
  q?: string;
  watching?: boolean;
  includeArchived?: boolean;
  sort?: (typeof SORTS)[number];
  groupBy?: GroupBy;
}

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const many = (v: string | string[] | undefined) => (v === undefined ? [] : (Array.isArray(v) ? v : v.split(',')).filter(Boolean));

/** Reads task filters out of the URL, ignoring anything malformed. */
export function parseTaskQuery(sp: Params): TaskQuery {
  const assignee = one(sp.assignee);
  const milestone = one(sp.milestone);
  const due = one(sp.due);
  const sort = one(sp.sort);
  const group = one(sp.group);
  const q = one(sp.q)?.slice(0, 100);
  return {
    assignee: assignee === 'me' || assignee === 'none' || (assignee && UUID.test(assignee)) ? assignee : undefined,
    categories: many(sp.category).filter((c): c is (typeof CATEGORIES)[number] => (CATEGORIES as readonly string[]).includes(c)),
    priorities: many(sp.priority).filter((p): p is (typeof PRIORITIES)[number] => (PRIORITIES as readonly string[]).includes(p)),
    labelIds: many(sp.label).filter((l) => UUID.test(l)),
    milestoneId: milestone && UUID.test(milestone) ? milestone : undefined,
    due: (DUES as readonly string[]).includes(due ?? '') ? (due as (typeof DUES)[number]) : undefined,
    q: q || undefined,
    watching: one(sp.watching) === '1' || undefined,
    includeArchived: one(sp.archived) === '1' || undefined,
    sort: (SORTS as readonly string[]).includes(sort ?? '') ? (sort as (typeof SORTS)[number]) : undefined,
    groupBy: (['status', 'assignee', 'priority', 'milestone', 'none'] as readonly string[]).includes(group ?? '') ? (group as GroupBy) : undefined,
  };
}

/** The same filters as search params, so a view can be restored or linked to. */
export function queryToParams(q: TaskQuery): Record<string, string | null> {
  return {
    assignee: q.assignee ?? null,
    category: q.categories?.length ? q.categories.join(',') : null,
    priority: q.priorities?.length ? q.priorities.join(',') : null,
    label: q.labelIds?.length ? q.labelIds.join(',') : null,
    milestone: q.milestoneId ?? null,
    due: q.due ?? null,
    q: q.q ?? null,
    watching: q.watching ? '1' : null,
    archived: q.includeArchived ? '1' : null,
    sort: q.sort && q.sort !== 'manual' ? q.sort : null,
    group: q.groupBy ?? null,
  };
}

export function toCoreFilter(q: TaskQuery, projectId?: string): TaskFilter {
  return {
    projectId,
    assignee: q.assignee,
    categories: q.categories?.length ? q.categories : undefined,
    priorities: q.priorities?.length ? q.priorities : undefined,
    labelIds: q.labelIds?.length ? q.labelIds : undefined,
    milestoneId: q.milestoneId,
    due: q.due,
    q: q.q,
    watching: q.watching,
    includeArchived: q.includeArchived,
    sort: q.sort ?? 'manual',
  };
}

export function isFiltered(q: TaskQuery) {
  return Boolean(q.assignee || q.categories?.length || q.priorities?.length || q.labelIds?.length || q.milestoneId || q.due || q.q || q.watching || q.includeArchived);
}

export const TASK_LAYOUTS: TaskLayout[] = ['list', 'board'];
export const CATEGORY_VALUES = CATEGORIES;
export const PRIORITY_VALUES = PRIORITIES;
export const DUE_VALUES = DUES;
export const SORT_VALUES = SORTS;
