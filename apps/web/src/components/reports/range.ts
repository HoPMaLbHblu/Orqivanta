/** Report slugs, in the order they appear on the reports page. */
export const REPORTS = ['progress', 'overdue', 'throughput', 'cycle-time', 'request-response', 'approval-turnaround'] as const;
export type ReportSlug = (typeof REPORTS)[number];

export const PRESETS = [30, 90, 180, 365] as const;

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function todayIn(timeZone: string, offsetDays = 0) {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(Date.now() + offsetDays * 86_400_000));
}

function shift(iso: string, days: number) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export interface ParsedRange {
  from: string;
  to: string;
  preset: number | null;
  projectId?: string;
  timeZone: string;
}

/**
 * Reads the date range from the URL. Defaults to the last 90 days, ending today in the
 * viewer's time zone; ranges are capped at two years and swapped if given backwards.
 */
export function parseRange(sp: { from?: string; to?: string; days?: string; project?: string }, timeZone: string): ParsedRange {
  const today = todayIn(timeZone);
  const projectId = sp.project && UUID.test(sp.project) ? sp.project : undefined;
  const preset = PRESETS.find((p) => String(p) === sp.days);
  if (sp.from && sp.to && ISO.test(sp.from) && ISO.test(sp.to) && !preset) {
    let [from, to] = sp.from <= sp.to ? [sp.from, sp.to] : [sp.to, sp.from];
    if (to > today) to = today;
    if (from > to) from = to;
    if (shift(from, 731) < to) from = shift(to, -730);
    return { from, to, preset: null, projectId, timeZone };
  }
  const days = preset ?? 90;
  return { from: shift(today, -(days - 1)), to: today, preset: days, projectId, timeZone };
}

export function rangeQuery(r: ParsedRange) {
  const q = new URLSearchParams();
  if (r.preset) q.set('days', String(r.preset));
  else {
    q.set('from', r.from);
    q.set('to', r.to);
  }
  if (r.projectId) q.set('project', r.projectId);
  return q.toString();
}
