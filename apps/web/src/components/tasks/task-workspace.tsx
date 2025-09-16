'use client';

import type { ReactNode } from 'react';
import { TaskBoard } from './task-board';
import { TaskListView } from './task-list-view';
import { TaskSheet, useOpenTaskPanel } from './task-sheet';
import { TaskToolbar, type SavedViewData, type ToolbarContext } from './toolbar';
import { isFiltered, type TaskLayout, type TaskQuery } from './filters';
import { useTaskParams } from './use-task-params';
import type { StatusOption, TaskRowData } from './types';

/** The project Tasks tab: toolbar, the chosen layout, and the linkable task panel. */
export function TaskWorkspace({
  org,
  projectId,
  layout,
  query,
  tasks,
  statuses,
  context,
  savedViews,
  canEdit,
  canCreate,
  canSaveViews,
  truncated,
  activeRef,
  children,
}: {
  org: string;
  projectId: string;
  layout: TaskLayout;
  query: TaskQuery;
  tasks: TaskRowData[];
  statuses: StatusOption[];
  context: ToolbarContext;
  savedViews: SavedViewData[];
  canEdit: boolean;
  canCreate: boolean;
  canSaveViews: boolean;
  truncated: boolean;
  activeRef: string | null;
  children: ReactNode;
}) {
  const openPanel = useOpenTaskPanel();
  const { setParams } = useTaskParams();
  const clearFilters = () => setParams({ assignee: null, category: null, priority: null, label: null, milestone: null, due: null, q: null, watching: null, archived: null });

  return (
    <div className="flex flex-col gap-4">
      <TaskToolbar org={org} projectId={projectId} layout={layout} query={query} context={context} savedViews={savedViews} canSaveViews={canSaveViews} count={tasks.length} truncated={truncated} />
      {layout === 'board' ? (
        <TaskBoard org={org} projectId={projectId} statuses={statuses} tasks={tasks} canEdit={canEdit} canCreate={canCreate} onOpen={openPanel} activeRef={activeRef} />
      ) : (
        <TaskListView
          org={org}
          tasks={tasks}
          statuses={statuses}
          people={context.people}
          labels={context.labels}
          milestones={context.milestones}
          groupBy={query.groupBy ?? 'status'}
          canEdit={canEdit}
          canCreate={canCreate}
          projectId={projectId}
          onOpen={openPanel}
          activeRef={activeRef}
          filtered={isFiltered(query)}
          onClearFilters={clearFilters}
        />
      )}
      <TaskSheet taskRef={activeRef}>{children}</TaskSheet>
    </div>
  );
}
