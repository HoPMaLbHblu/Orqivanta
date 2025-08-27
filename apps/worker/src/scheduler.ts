import { approvalHref, notify, storage, taskHref } from '@orqivanta/core';
import { getPool, sql, withSystem, withTenant } from '@orqivanta/db';
import type { Logger } from 'pino';

/** Arbitrary constant for pg_try_advisory_xact_lock, so only one worker runs the schedule at a time. */
const SCHEDULE_LOCK = 72_311_904;

type Job = { name: string; everyMinutes: number; run: (log: Logger) => Promise<Record<string, number>> };

/**
 * Due-date reminders. A task assigned to you that is due today or tomorrow produces one
 * "due" notification per task per day; the dedupe key keeps reruns from stacking duplicates.
 */
async function dueReminders(): Promise<Record<string, number>> {
  const rows = await withSystem(async (tx) =>
    (
      await tx.execute<{ org_id: string; slug: string; task_id: string; assignee_id: string; title: string; key: string; number: number; due_date: string; is_today: boolean; overdue: boolean }>(sql`
        select t.org_id, o.slug, t.id as task_id, t.assignee_id, t.title, p.key, t.number, t.due_date::text as due_date,
               t.due_date = current_date as is_today, t.due_date < current_date as overdue
        from tasks t
        join projects p on p.id = t.project_id
        join project_statuses s on s.id = t.status_id
        join organizations o on o.id = t.org_id
        join memberships m on m.org_id = t.org_id and m.user_id = t.assignee_id and m.status = 'active'
        where t.assignee_id is not null and t.deleted_at is null and t.archived_at is null
          and p.deleted_at is null and p.archived_at is null and o.deleted_at is null
          and s.category not in ('completed','canceled')
          and t.due_date between current_date - 1 and current_date + 1`)
    ).rows,
  );
  let sent = 0;
  for (const r of rows) {
    await withTenant(r.org_id, (tx) =>
      notify(tx, { orgId: r.org_id, userId: '' }, {
        userIds: [r.assignee_id],
        category: 'due',
        title: r.overdue ? `${r.key}-${r.number} is overdue` : r.is_today ? `${r.key}-${r.number} is due today` : `${r.key}-${r.number} is due tomorrow`,
        body: r.title,
        href: taskHref(r.slug, r.key, r.number),
        entityId: r.task_id,
        dedupeKey: `due:${r.task_id}:${new Date().toISOString().slice(0, 10)}`,
      }),
    );
    sent++;
  }
  return { tasks: sent };
}

/**
 * Approval nudges. Pending rounds due within a day (or already late) remind reviewers who
 * haven't decided, at most once every 24 hours, whether the last nudge was manual or automatic.
 */
async function approvalReminders(): Promise<Record<string, number>> {
  const due = await withSystem(async (tx) =>
    (
      await tx.execute<{ id: string; org_id: string; slug: string; title: string; due_date: string; late: boolean }>(sql`
        select a.id, a.org_id, o.slug, a.title, a.due_date::text as due_date, a.due_date < current_date as late
        from approvals a join organizations o on o.id = a.org_id
        where a.status = 'pending' and a.due_date is not null and a.due_date <= current_date + 1
          and (a.last_reminder_at is null or a.last_reminder_at < now() - interval '24 hours')
          and o.deleted_at is null`)
    ).rows,
  );
  let reminded = 0;
  for (const a of due) {
    await withTenant(a.org_id, async (tx) => {
      const reviewers = (
        await tx.execute<{ user_id: string; role: string }>(sql`
          select r.user_id, m.role from approval_reviewers r
          join memberships m on m.org_id = r.org_id and m.user_id = r.user_id and m.status = 'active'
          where r.approval_id = ${a.id} and r.decision is null`)
      ).rows;
      const title = a.late ? `Review overdue: ${a.title}` : `Review due soon: ${a.title}`;
      const body = `Due ${a.due_date}`;
      const internal = reviewers.filter((r) => r.role !== 'client').map((r) => r.user_id);
      const client = reviewers.filter((r) => r.role === 'client').map((r) => r.user_id);
      const base = { orgId: a.org_id, userId: '' };
      await notify(tx, base, { userIds: internal, category: 'approval', title, body, href: approvalHref(a.slug, a.id), entityId: a.id, dedupeKey: `approval:${a.id}` });
      await notify(tx, base, { userIds: client, category: 'approval', title, body, href: approvalHref(a.slug, a.id, true), entityId: a.id, dedupeKey: `approval:${a.id}` });
      await tx.execute(sql`update approvals set last_reminder_at = now() where id = ${a.id}`);
    });
    reminded++;
  }
  return { approvals: reminded };
}

/**
 * Housekeeping. Trash is kept for 30 days, then purged together with the stored bytes.
 * Storage objects are deleted after their rows, so a crash in between leaves at worst an
 * unreferenced object, never a row that points at missing bytes.
 */
async function cleanup(log: Logger): Promise<Record<string, number>> {
  const result = await withSystem(async (tx) => {
    const keys = (
      await tx.execute<{ storage_key: string; preview_key: string | null }>(sql`
        select v.storage_key, v.preview_key from file_versions v
        join files f on f.id = v.file_id
        left join projects p on p.id = f.project_id
        where (f.deleted_at < now() - interval '30 days') or (p.deleted_at < now() - interval '30 days')`)
    ).rows;
    const exportKeys = (
      await tx.execute<{ storage_key: string }>(sql`
        delete from data_exports where created_at < now() - interval '8 days' returning storage_key`)
    ).rows;
    const files = await tx.execute(sql`delete from files where deleted_at < now() - interval '30 days'`);
    const docs = await tx.execute(sql`delete from documents where deleted_at < now() - interval '30 days'`);
    const projects = await tx.execute(sql`delete from projects where deleted_at < now() - interval '30 days'`);
    const tasks = await tx.execute(sql`delete from tasks where deleted_at < now() - interval '30 days'`);
    const realtime = await tx.execute(sql`delete from realtime_events where created_at < now() - interval '3 days'`);
    const sessions = await tx.execute(sql`delete from sessions where expires_at < now() or last_seen_at < now() - interval '14 days'`);
    const tokens = await tx.execute(sql`delete from email_tokens where expires_at < now() - interval '1 day'`);
    const limits = await tx.execute(sql`delete from rate_limits where window_started_at < now() - interval '2 days'`);
    const outboxRows = await tx.execute(sql`delete from outbox where processed_at < now() - interval '14 days'`);
    const notifications = await tx.execute(sql`delete from notifications where read_at < now() - interval '90 days'`);
    return {
      keys: [...keys.flatMap((k) => [k.storage_key, k.preview_key]), ...exportKeys.map((k) => k.storage_key)].filter((k): k is string => Boolean(k)),
      counts: {
        files: files.rowCount ?? 0,
        documents: docs.rowCount ?? 0,
        projects: projects.rowCount ?? 0,
        tasks: tasks.rowCount ?? 0,
        exports: exportKeys.length,
        realtimeEvents: realtime.rowCount ?? 0,
        sessions: sessions.rowCount ?? 0,
        emailTokens: tokens.rowCount ?? 0,
        rateLimits: limits.rowCount ?? 0,
        outbox: outboxRows.rowCount ?? 0,
        notifications: notifications.rowCount ?? 0,
      },
    };
  });
  let objects = 0;
  for (const key of result.keys) {
    try {
      await storage.delete(key);
      objects++;
    } catch (err) {
      log.warn({ key, err: err instanceof Error ? err.message : String(err) }, 'could not delete storage object');
    }
  }
  return { ...result.counts, storageObjects: objects };
}

export const JOBS: Job[] = [
  { name: 'due-reminders', everyMinutes: 60, run: dueReminders },
  { name: 'approval-reminders', everyMinutes: 30, run: approvalReminders },
  { name: 'cleanup', everyMinutes: 360, run: cleanup },
];

const lastRun = new Map<string, number>();

/** Runs every job whose interval has elapsed. Safe to call often and from several workers. */
export async function runSchedule(log: Logger) {
  const now = Date.now();
  for (const job of JOBS) {
    if (now - (lastRun.get(job.name) ?? 0) < job.everyMinutes * 60_000) continue;
    lastRun.set(job.name, now);
    // Session-level advisory lock on a dedicated connection, so the lock and unlock share it.
    const client = await getPool().connect();
    try {
      const { rows } = await client.query<{ ok: boolean }>('select pg_try_advisory_lock($1) as ok', [SCHEDULE_LOCK]);
      if (!rows[0]?.ok) continue;
      try {
        const started = Date.now();
        const stats = await job.run(log);
        log.info({ job: job.name, ms: Date.now() - started, ...stats }, 'scheduled job finished');
      } catch (err) {
        log.error({ job: job.name, err: err instanceof Error ? err.message : String(err) }, 'scheduled job failed');
      } finally {
        await client.query('select pg_advisory_unlock($1)', [SCHEDULE_LOCK]);
      }
    } finally {
      client.release();
    }
  }
}
