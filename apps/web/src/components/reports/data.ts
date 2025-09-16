import type { Reports } from '@orqivanta/core';
import type { ReportSlug } from './range';

export type Cell = string | number | null;
export interface ReportTable {
  columns: string[];
  rows: Record<string, Cell>[];
}

const round = (n: number | null, digits = 1) => (n === null ? null : Math.round(n * 10 ** digits) / 10 ** digits);

/** The rows behind each report: shown as the table alternative and exported as CSV. */
export function reportTable(slug: ReportSlug, r: Reports): ReportTable {
  switch (slug) {
    case 'progress':
      return {
        columns: ['project', 'key', 'client', 'health', 'progress_pct', 'open', 'overdue', 'blocked', 'due_date'],
        rows: r.projects.map((p) => ({ project: p.name, key: p.key, client: p.clientName, health: p.health, progress_pct: p.progress === null ? null : Math.round(p.progress * 100), open: p.open, overdue: p.overdue, blocked: p.blocked, due_date: p.dueDate })),
      };
    case 'overdue':
      return {
        columns: ['project', 'key', 'overdue', 'open', 'overdue_share_pct'],
        rows: r.overdueByProject.map((p) => ({ project: p.name, key: p.key, overdue: p.overdue, open: p.open, overdue_share_pct: p.open ? Math.round((p.overdue / p.open) * 100) : null })),
      };
    case 'throughput':
      return { columns: ['week_starting', 'completed'], rows: r.throughput.map((w) => ({ week_starting: w.week, completed: w.completed })) };
    case 'cycle-time':
      return {
        columns: ['measure', 'days'],
        rows: [
          { measure: 'median', days: round(r.cycleTime.medianDays) },
          { measure: 'p85', days: round(r.cycleTime.p85Days) },
          { measure: 'tasks_completed', days: r.cycleTime.sample },
        ],
      };
    case 'request-response':
      return {
        columns: ['category', 'submitted', 'in_review', 'needs_info', 'accepted', 'in_progress', 'total_open'],
        rows: r.requests.backlog.map((b) => ({ ...b, total_open: b.submitted + b.in_review + b.needs_info + b.accepted + b.in_progress })),
      };
    case 'approval-turnaround':
      return {
        columns: ['outcome', 'reviews'],
        rows: [
          { outcome: 'approved', reviews: r.approvals.approved },
          { outcome: 'changes_requested', reviews: r.approvals.changesRequested },
          { outcome: 'rejected', reviews: r.approvals.rejected },
        ],
      };
  }
}

/** Metric definitions shown next to each report (keys of METRIC_DEFINITIONS). */
export const REPORT_METRICS: Record<ReportSlug, string[]> = {
  progress: ['progress', 'health', 'blocked'],
  overdue: ['overdue', 'blocked'],
  throughput: ['throughput'],
  'cycle-time': ['cycleTime'],
  'request-response': ['requestResponse', 'requestResolution'],
  'approval-turnaround': ['approvalTurnaround', 'revisionRounds'],
};

/** Snapshot reports describe today; the others use the selected date range. */
export const SNAPSHOT: Record<ReportSlug, boolean> = {
  progress: true,
  overdue: true,
  throughput: false,
  'cycle-time': false,
  'request-response': false,
  'approval-turnaround': false,
};
