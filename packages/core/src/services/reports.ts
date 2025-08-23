import { z } from 'zod';
import { and, eq, projects, sql, withTenant } from '@orqivanta/db';
import { parse } from '../lib/validate';
import type { Actor } from '../permissions';
import { isValidTimeZone } from '../auth/accounts';
import { assertOrg } from './context';
import { visibleProjectsSql } from './access';
import { listProjects } from './projects';

const rangeSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timeZone: z.string().max(64).refine(isValidTimeZone).default('UTC'),
  projectId: z.uuid().optional(),
  clientAccountId: z.uuid().optional(),
});
export type ReportRange = z.input<typeof rangeSchema>;

/**
 * All report queries share these rules: they only count projects the actor can open
 * (the same visibleProjectsSql used everywhere), exclude deleted items, and bucket dates
 * in the viewer's time zone.
 */
export async function getReports(actor: Actor, input: unknown) {
  assertOrg(actor, 'reports.view');
  const r = parse(rangeSchema, input);
  const tz = r.timeZone;
  const fromTs = sql`(${r.from}::date)::timestamp at time zone ${tz}`;
  const toTs = sql`((${r.to}::date + 1)::timestamp at time zone ${tz})`;

  return withTenant(actor.orgId, async (tx) => {
    const visibleIds = (
      await tx
        .select({ id: projects.id })
        .from(projects)
        .where(
          and(
            eq(projects.orgId, actor.orgId),
            visibleProjectsSql(actor),
            r.projectId ? eq(projects.id, r.projectId) : undefined,
            r.clientAccountId ? eq(projects.clientAccountId, r.clientAccountId) : undefined,
          ),
        )
    ).map((p) => p.id);
    const ids = visibleIds.length ? visibleIds : ['00000000-0000-0000-0000-000000000000'];
    const inProjects = (col: string) => sql`${sql.raw(col)} in ${ids}`;

    const throughput = await tx.execute<{ week: string; completed: number }>(sql`
      with weeks as (
        select generate_series(date_trunc('week', ${fromTs} at time zone ${tz}), date_trunc('week', ${toTs} at time zone ${tz} - interval '1 second'), interval '1 week') as week
      )
      select to_char(w.week, 'YYYY-MM-DD') as week,
        (select count(*)::int from tasks t join project_statuses s on s.id = t.status_id
          where ${inProjects('t.project_id')} and t.deleted_at is null and s.category = 'completed'
          and date_trunc('week', t.completed_at at time zone ${tz}) = w.week) as completed
      from weeks w order by w.week`);

    const [cycle] = (
      await tx.execute<{ median_days: number | null; p85_days: number | null; n: number }>(sql`
      select percentile_cont(0.5) within group (order by extract(epoch from (t.completed_at - coalesce(t.started_at, t.created_at))) / 86400)::float as median_days,
             percentile_cont(0.85) within group (order by extract(epoch from (t.completed_at - coalesce(t.started_at, t.created_at))) / 86400)::float as p85_days,
             count(*)::int as n
      from tasks t join project_statuses s on s.id = t.status_id
      where ${inProjects('t.project_id')} and t.deleted_at is null and s.category = 'completed'
        and t.completed_at >= ${fromTs} and t.completed_at < ${toTs}`)
    ).rows;

    const overdueByProject = await tx.execute<{ project_id: string; key: string; name: string; overdue: number; open: number }>(sql`
      select p.id as project_id, p.key, p.name,
        count(*) filter (where s.category not in ('completed','canceled') and t.due_date < (now() at time zone ${tz})::date)::int as overdue,
        count(*) filter (where s.category not in ('completed','canceled'))::int as open
      from projects p
      left join tasks t on t.project_id = p.id and t.deleted_at is null and t.archived_at is null
      left join project_statuses s on s.id = t.status_id
      where ${inProjects('p.id')} and p.archived_at is null
      group by p.id order by overdue desc, p.name limit 15`);

    // Requests are org-level; internal members who can view reports see all of them.
    const requestFilter = r.clientAccountId ? sql`and r.client_account_id = ${r.clientAccountId}` : sql``;
    const [requestStats] = (
      await tx.execute<{ submitted: number; median_response_hours: number | null; median_resolution_days: number | null; resolved: number }>(sql`
      select
        (select count(*)::int from requests r where r.created_at >= ${fromTs} and r.created_at < ${toTs} ${requestFilter}) as submitted,
        (select percentile_cont(0.5) within group (order by extract(epoch from (r.first_response_at - r.created_at)) / 3600)::float
           from requests r where r.first_response_at is not null and r.created_at >= ${fromTs} and r.created_at < ${toTs} ${requestFilter}) as median_response_hours,
        (select percentile_cont(0.5) within group (order by extract(epoch from (r.resolved_at - r.created_at)) / 86400)::float
           from requests r where r.resolved_at >= ${fromTs} and r.resolved_at < ${toTs} ${requestFilter}) as median_resolution_days,
        (select count(*)::int from requests r where r.resolved_at >= ${fromTs} and r.resolved_at < ${toTs} ${requestFilter}) as resolved`)
    ).rows;

    const backlog = await tx.execute<{ category: string; submitted: number; in_review: number; needs_info: number; accepted: number; in_progress: number }>(sql`
      select coalesce(r.answers->>'type', 'Uncategorized') as category,
        count(*) filter (where status = 'submitted')::int as submitted,
        count(*) filter (where status = 'in_review')::int as in_review,
        count(*) filter (where status = 'needs_info')::int as needs_info,
        count(*) filter (where status = 'accepted')::int as accepted,
        count(*) filter (where status = 'in_progress')::int as in_progress
      from requests r where r.status in ('submitted','in_review','needs_info','accepted','in_progress') ${requestFilter}
      group by 1 order by 1`);

    const [approvalStats] = (
      await tx.execute<{ decided: number; median_hours: number | null; approved: number; changes: number; rejected: number; avg_rounds: number | null; pending: number }>(sql`
      select
        count(*) filter (where a.status in ('approved','changes_requested','rejected') and a.decided_at >= ${fromTs} and a.decided_at < ${toTs})::int as decided,
        percentile_cont(0.5) within group (order by extract(epoch from (a.decided_at - a.created_at)) / 3600)
          filter (where a.status in ('approved','changes_requested','rejected') and a.decided_at >= ${fromTs} and a.decided_at < ${toTs})::float as median_hours,
        count(*) filter (where a.status = 'approved' and a.decided_at >= ${fromTs} and a.decided_at < ${toTs})::int as approved,
        count(*) filter (where a.status = 'changes_requested' and a.decided_at >= ${fromTs} and a.decided_at < ${toTs})::int as changes,
        count(*) filter (where a.status = 'rejected' and a.decided_at >= ${fromTs} and a.decided_at < ${toTs})::int as rejected,
        (select avg(max_round)::float from (select max(a2.round) as max_round from approvals a2 where a2.file_id is not null and a2.status = 'approved' and ${inProjects('a2.project_id')} group by a2.file_id) x) as avg_rounds,
        count(*) filter (where a.status = 'pending')::int as pending
      from approvals a where ${inProjects('a.project_id')}`)
    ).rows;

    const projectRows = (await listProjects(actor, { status: 'active', clientAccountId: r.clientAccountId })).filter((p) => !r.projectId || p.id === r.projectId);

    return {
      range: r,
      throughput: throughput.rows,
      cycleTime: { medianDays: cycle?.median_days ?? null, p85Days: cycle?.p85_days ?? null, sample: cycle?.n ?? 0 },
      overdueByProject: overdueByProject.rows,
      requests: {
        submitted: requestStats?.submitted ?? 0,
        resolved: requestStats?.resolved ?? 0,
        medianResponseHours: requestStats?.median_response_hours ?? null,
        medianResolutionDays: requestStats?.median_resolution_days ?? null,
        backlog: backlog.rows,
      },
      approvals: {
        decided: approvalStats?.decided ?? 0,
        medianHours: approvalStats?.median_hours ?? null,
        approved: approvalStats?.approved ?? 0,
        changesRequested: approvalStats?.changes ?? 0,
        rejected: approvalStats?.rejected ?? 0,
        avgRounds: approvalStats?.avg_rounds ?? null,
        pending: approvalStats?.pending ?? 0,
      },
      projects: projectRows.map((p) => ({ id: p.id, key: p.key, name: p.name, clientName: p.clientName, health: p.health, healthSource: p.healthSource, progress: p.stats.progress, open: p.stats.open, overdue: p.stats.overdue, blocked: p.stats.blocked, dueDate: p.dueDate })),
    };
  });
}

export type Reports = Awaited<ReturnType<typeof getReports>>;

export function toCsv(rows: Record<string, unknown>[], columns?: string[]): string {
  if (!rows.length) return (columns ?? []).join(',') + '\n';
  const cols = columns ?? Object.keys(rows[0]!);
  const esc = (v: unknown) => {
    if (v === null || v === undefined) return '';
    let s = v instanceof Date ? v.toISOString() : String(v);
    // Neutralize spreadsheet formula injection.
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n') + '\n';
}

