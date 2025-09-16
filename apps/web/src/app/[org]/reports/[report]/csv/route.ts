import { canOrg, getReports, resolveActor, toCsv } from '@orqivanta/core';
import { reportTable } from '@/components/reports/data';
import { parseRange, REPORTS, type ReportSlug } from '@/components/reports/range';
import { getSession } from '@/lib/session';

export const runtime = 'nodejs';

/** CSV of the rows behind a report, for the same range and filters as the page. */
export async function GET(req: Request, { params }: { params: Promise<{ org: string; report: string }> }) {
  const { org, report } = await params;
  const session = await getSession();
  if (!session || !REPORTS.includes(report as ReportSlug)) return new Response('Not found', { status: 404 });
  const actor = await resolveActor(session.user.id, org);
  if (!actor || !canOrg(actor.role, 'reports.view')) return new Response('Not found', { status: 404 });
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const range = parseRange(sp, session.user.timeZone);
  const data = await getReports(actor, range);
  const table = reportTable(report as ReportSlug, data);
  const name = `${actor.orgSlug}-${report}-${range.from}-to-${range.to}.csv`;
  return new Response('﻿' + toCsv(table.rows, table.columns), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${name}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
