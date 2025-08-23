import { z } from 'zod';
import { and, clientAccounts, documents, eq, files, isNull, projectStatuses, projects, requests, sql, tasks, withTenant } from '@orqivanta/db';
import { parse } from '../lib/validate';
import { canOrg, type Actor } from '../permissions';
import { visibleProjectsSql } from './access';

export type SearchType = 'project' | 'task' | 'document' | 'request' | 'client' | 'file';

export interface SearchResult {
  type: SearchType;
  id: string;
  title: string;
  /** Plain-text excerpt; matched terms are wrapped in «» for the UI to highlight safely. */
  excerpt: string | null;
  href: string;
  meta: string | null;
  rank: number;
}

/** Builds a prefix-matching tsquery from free text, e.g. "brand gui" → 'brand:* & gui:*'. */
export function toPrefixQuery(q: string): string | null {
  const words = q
    .toLowerCase()
    .normalize('NFKC')
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length > 0)
    .slice(0, 8);
  if (!words.length) return null;
  return words.map((w) => `${w}:*`).join(' & ');
}

const schema = z.object({
  q: z.string().trim().min(1).max(100),
  types: z.array(z.enum(['project', 'task', 'document', 'request', 'client', 'file'])).optional(),
  limit: z.number().int().min(1).max(50).default(8),
});

/**
 * Permission-aware search. Every branch applies the same visibility rules as the list
 * screens (visibleProjectsSql, client sharing flags), so results, excerpts and counts never
 * reveal items the actor can't open. Index updates are immediate (generated columns).
 */
export async function search(actor: Actor, input: unknown): Promise<{ results: SearchResult[]; counts: Record<SearchType, number> }> {
  const { q, types, limit } = parse(schema, input);
  const tsq = toPrefixQuery(q);
  const want = (t: SearchType) => !types || types.includes(t);
  const isClient = actor.role === 'client';
  const like = `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
  const hl = (col: unknown) =>
    sql<string>`ts_headline('simple', coalesce(${col}, ''), to_tsquery('simple', ${tsq ?? 'x'}), 'StartSel=«,StopSel=»,MaxWords=18,MinWords=6,MaxFragments=1')`;
  const prefix = isClient ? `/portal/${actor.orgSlug}` : `/${actor.orgSlug}`;

  return withTenant(actor.orgId, async (tx) => {
    const out: SearchResult[] = [];
    const counts: Record<SearchType, number> = { project: 0, task: 0, document: 0, request: 0, client: 0, file: 0 };
    const match = (vec: unknown, title: unknown) =>
      tsq ? sql`(${vec} @@ to_tsquery('simple', ${tsq}) or ${title} ilike ${like})` : sql`${title} ilike ${like}`;
    const rank = (vec: unknown, title: unknown) =>
      tsq ? sql<number>`(ts_rank(${vec}, to_tsquery('simple', ${tsq})) + case when ${title} ilike ${like} then 1 else 0 end)` : sql<number>`1`;

    if (want('project')) {
      const where = and(eq(projects.orgId, actor.orgId), visibleProjectsSql(actor), match(projects.search, projects.name));
      const rows = await tx
        .select({ id: projects.id, key: projects.key, name: projects.name, excerpt: hl(projects.description), archived: projects.archivedAt, rank: rank(projects.search, projects.name), total: sql<number>`count(*) over ()::int` })
        .from(projects)
        .where(where)
        .orderBy(sql`${rank(projects.search, projects.name)} desc`)
        .limit(limit);
      counts.project = rows[0]?.total ?? 0;
      rows.forEach((r) => out.push({ type: 'project', id: r.id, title: r.name, excerpt: r.excerpt || null, href: `${prefix}/projects/${r.key}`, meta: `${r.key}${r.archived ? ' · archived' : ''}`, rank: Number(r.rank) + 0.5 }));
    }

    if (want('task')) {
      const rows = await tx
        .select({ id: tasks.id, number: tasks.number, title: tasks.title, key: projects.key, projectName: projects.name, status: projectStatuses.name, excerpt: hl(tasks.descriptionText), rank: rank(tasks.search, tasks.title), total: sql<number>`count(*) over ()::int` })
        .from(tasks)
        .innerJoin(projects, eq(projects.id, tasks.projectId))
        .innerJoin(projectStatuses, eq(projectStatuses.id, tasks.statusId))
        .where(
          and(
            eq(tasks.orgId, actor.orgId),
            isNull(tasks.deletedAt),
            visibleProjectsSql(actor),
            isClient ? eq(tasks.sharedWithClient, true) : undefined,
            sql`(${match(tasks.search, tasks.title)} or (${projects.key} || '-' || ${tasks.number}) ilike ${q})`,
          ),
        )
        .orderBy(sql`${rank(tasks.search, tasks.title)} desc`)
        .limit(limit);
      counts.task = rows[0]?.total ?? 0;
      rows.forEach((r) =>
        out.push({
          type: 'task',
          id: r.id,
          title: r.title,
          excerpt: r.excerpt || null,
          href: isClient ? `${prefix}/projects/${r.key}?task=${r.number}` : `${prefix}/tasks/${r.key}-${r.number}`,
          meta: `${r.key}-${r.number} · ${r.status} · ${r.projectName}`,
          rank: Number(r.rank),
        }),
      );
    }

    if (want('document')) {
      const rows = await tx
        .select({ id: documents.id, title: documents.title, projectName: projects.name, excerpt: hl(documents.contentText), rank: rank(documents.search, documents.title), total: sql<number>`count(*) over ()::int` })
        .from(documents)
        .leftJoin(projects, eq(projects.id, documents.projectId))
        .where(
          and(
            eq(documents.orgId, actor.orgId),
            isNull(documents.deletedAt),
            sql`((${documents.projectId} is null and ${!isClient}) or (${projects.id} is not null and ${visibleProjectsSql(actor)}))`,
            isClient ? eq(documents.sharedWithClient, true) : undefined,
            match(documents.search, documents.title),
          ),
        )
        .orderBy(sql`${rank(documents.search, documents.title)} desc`)
        .limit(limit);
      counts.document = rows[0]?.total ?? 0;
      rows.forEach((r) => out.push({ type: 'document', id: r.id, title: r.title, excerpt: r.excerpt || null, href: `${prefix}/documents/${r.id}`, meta: r.projectName ?? 'Workspace document', rank: Number(r.rank) }));
    }

    if (want('request') && (isClient ? Boolean(actor.clientAccountId) : canOrg(actor.role, 'requests.triage'))) {
      const rows = await tx
        .select({ id: requests.id, number: requests.number, title: requests.title, status: requests.status, excerpt: hl(requests.details), rank: rank(requests.search, requests.title), total: sql<number>`count(*) over ()::int` })
        .from(requests)
        .where(
          and(
            eq(requests.orgId, actor.orgId),
            isClient ? eq(requests.clientAccountId, actor.clientAccountId!) : undefined,
            sql`(${match(requests.search, requests.title)} or ${requests.number}::text = ${q.replace(/^#/, '')})`,
          ),
        )
        .orderBy(sql`${rank(requests.search, requests.title)} desc`)
        .limit(limit);
      counts.request = rows[0]?.total ?? 0;
      rows.forEach((r) => out.push({ type: 'request', id: r.id, title: r.title, excerpt: r.excerpt || null, href: `${prefix}/requests/${r.number}`, meta: `#${r.number} · ${r.status.replace('_', ' ')}`, rank: Number(r.rank) }));
    }

    if (want('client') && canOrg(actor.role, 'clients.view')) {
      const rows = await tx
        .select({ id: clientAccounts.id, name: clientAccounts.name, total: sql<number>`count(*) over ()::int` })
        .from(clientAccounts)
        .where(and(eq(clientAccounts.orgId, actor.orgId), sql`${clientAccounts.name} ilike ${like}`))
        .limit(limit);
      counts.client = rows[0]?.total ?? 0;
      rows.forEach((r) => out.push({ type: 'client', id: r.id, title: r.name, excerpt: null, href: `${prefix}/clients/${r.id}`, meta: 'Client', rank: 1.2 }));
    }

    if (want('file')) {
      const rows = await tx
        .select({ id: files.id, name: files.name, key: projects.key, projectName: projects.name, rank: rank(files.search, files.name), total: sql<number>`count(*) over ()::int` })
        .from(files)
        .innerJoin(projects, eq(projects.id, files.projectId))
        .where(and(eq(files.orgId, actor.orgId), isNull(files.deletedAt), isNull(files.requestId), visibleProjectsSql(actor), isClient ? eq(files.sharedWithClient, true) : undefined, match(files.search, files.name)))
        .orderBy(sql`${rank(files.search, files.name)} desc`)
        .limit(limit);
      counts.file = rows[0]?.total ?? 0;
      rows.forEach((r) => out.push({ type: 'file', id: r.id, title: r.name, excerpt: null, href: isClient ? `${prefix}/files/${r.id}` : `${prefix}/files/${r.id}`, meta: r.projectName, rank: Number(r.rank) }));
    }

    out.sort((a, b) => b.rank - a.rank);
    return { results: out, counts };
  });
}
