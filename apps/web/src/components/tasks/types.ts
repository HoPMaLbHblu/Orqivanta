import type { StatusCategory } from '@/components/domain/badges';

export interface StatusOption {
  id: string;
  name: string;
  category: StatusCategory;
  position: number;
}

/** The task fields the list, board and My Work rows need (a subset of core's listTasks row). */
export interface TaskRowData {
  id: string;
  projectId: string;
  projectKey: string;
  projectName: string;
  number: number;
  ref: string;
  title: string;
  statusId: string;
  statusName: string;
  statusCategory: StatusCategory;
  priority: 'none' | 'low' | 'medium' | 'high' | 'urgent';
  assigneeId: string | null;
  assigneeName: string | null;
  assigneeColor: string | null;
  dueDate: string | null;
  position: number;
  parentId: string | null;
  milestoneId: string | null;
  sharedWithClient: boolean;
  version: number;
  archivedAt: Date | null;
  labels: { id: string; name: string; color: string }[];
  subtaskTotal: number;
  subtaskDone: number;
  commentCount: number;
  attachmentCount: number;
  blocked: boolean;
}

export interface PersonOption {
  id: string;
  name: string;
  avatarColor: string | null;
}
