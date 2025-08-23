/**
 * Written definitions for every number Orqivanta shows. The reports page renders these next
 * to each chart, so what a metric means is never left to interpretation.
 */
export const METRIC_DEFINITIONS = {
  progress: {
    label: 'Progress',
    definition:
      'Completed tasks divided by all tasks that weren’t canceled, including subtasks. Archived and deleted tasks are excluded. A project with no tasks shows no progress rather than 0%.',
  },
  overdue: {
    label: 'Overdue',
    definition:
      'Open tasks (not completed or canceled) whose due date is before today. “Today” uses UTC on the server and your time zone in reports.',
  },
  blocked: {
    label: 'Blocked',
    definition: 'Open tasks with at least one blocking task that is still open.',
  },
  health: {
    label: 'Health',
    definition:
      'The latest status update a manager posted. Without one, it’s computed: off track if the project is past its due date with open work; at risk if 20% or more of open tasks are overdue or blocked; otherwise on track.',
  },
  throughput: {
    label: 'Throughput',
    definition:
      'Tasks moved to a completed status, per week (Monday to Sunday in your time zone). A task completed, reopened and completed again counts once, in the week of its latest completion.',
  },
  cycleTime: {
    label: 'Cycle time',
    definition:
      'Median days from when work started (first move to an in-progress status, or creation if it skipped that) to completion, for tasks completed in the period.',
  },
  requestResponse: {
    label: 'First response',
    definition:
      'Median hours from a request being submitted to the team’s first response: a status change, a client-visible reply, or conversion into work.',
  },
  requestResolution: {
    label: 'Time to resolution',
    definition: 'Median days from submission to being completed, declined or marked duplicate, for requests closed in the period.',
  },
  approvalTurnaround: {
    label: 'Approval turnaround',
    definition: 'Median hours from a review being requested to its final outcome, for reviews decided in the period. Canceled and superseded rounds are excluded.',
  },
  revisionRounds: {
    label: 'Revision rounds',
    definition: 'Average number of review rounds per deliverable before approval. A new round starts when a new file version reopens review.',
  },
} as const;

export type MetricKey = keyof typeof METRIC_DEFINITIONS;

/** Shown on the reports page: activity counts are not a productivity measure. */
export const REPORTING_NOTE =
  'These reports describe the flow of work, not individual performance. Counts of tasks or comments don’t measure anyone’s productivity.';
