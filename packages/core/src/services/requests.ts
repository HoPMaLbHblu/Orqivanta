import { z } from 'zod';
import {
  and,
  asc,
  clientAccounts,
  comments,
  desc,
  eq,
  files,
  inArray,
  isNull,
  memberships,
  projects,
  requestForms,
  requests,
  sql,
  tasks,
  users,
  withTenant,
  type FormField,
  type Tx,
} from '@orqivanta/db';
import { notFound, precondition, validation } from '../errors';
import { audit, notify, publish, recordActivity } from '../lib/events';
import { plainToRichText, truncate } from '../lib/richtext';
import { rateLimit } from '../lib/rate-limit';
import { parse, zName } from '../lib/validate';
import { canOrg, type Actor } from '../permissions';
import { assertOrg } from './context';
import { getProjectAccess, visibleProjectsSql } from './access';
import { clientContactIds, createProject } from './projects';
import { createTaskInTx, taskHref, taskRef } from './tasks';

export type RequestStatus = 'submitted' | 'in_review' | 'needs_info' | 'accepted' | 'in_progress' | 'completed' | 'declined' | 'duplicate';
export const OPEN_REQUEST_STATUSES: RequestStatus[] = ['submitted', 'in_review', 'needs_info', 'accepted', 'in_progress'];
export const CLOSED_REQUEST_STATUSES: RequestStatus[] = ['completed', 'declined', 'duplicate'];

type RequestRow = typeof requests.$inferSelect;

export interface RequestAccess {
  request: RequestRow;
  isClient: boolean;
  canTriage: boolean;
}

/**
 * Internal members who may triage see every request. Client contacts see only requests of
 * their own client account.
 */
export async function getRequestAccess(tx: Tx, actor: Actor, requestId: string): Promise<RequestAccess> {
  const [request] = await tx.select().from(requests).where(eq(requests.id, requestId));
  if (!request || request.orgId !== actor.orgId) throw notFound('That request');
  if (actor.role === 'client') {
    if (!actor.clientAccountId || request.clientAccountId !== actor.clientAccountId) throw notFound('That request');
    return { request, isClient: true, canTriage: false };
  }
  if (!canOrg(actor.role, 'requests.triage')) throw notFound('That request');
  return { request, isClient: false, canTriage: true };
}

export const requestHref = (orgSlug: string, number: number, client = false) =>
  client ? `/portal/${orgSlug}/requests/${number}` : `/${orgSlug}/requests/${number}`;

// ---------------------------------------------------------------------------
// Forms
// ---------------------------------------------------------------------------

const fieldSchema = z.object({
  key: z.string().regex(/^[a-z][a-z0-9_]{0,30}$/, 'Field keys use lowercase letters, numbers and underscores.'),
  label: z.string().trim().min(1, 'Every field needs a label.').max(120),
  type: z.enum(['short_text', 'long_text', 'select', 'date', 'url', 'number']),
  required: z.boolean(),
  options: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
  help: z.string().trim().max(200).optional(),
});

const formSchema = z.object({
  formId: z.uuid().optional(),
  name: zName('Form name', 80),
  description: z.string().trim().max(300).optional().nullable(),
  audience: z.enum(['internal', 'client', 'both']),
  fields: z.array(fieldSchema).max(15).superRefine((fields, ctx) => {
    const keys = new Set<string>();
    fields.forEach((f, i) => {
      if (keys.has(f.key)) ctx.addIssue({ code: 'custom', path: [i, 'key'], message: 'Field keys must be unique.' });
      keys.add(f.key);
      if (f.type === 'select' && (!f.options || f.options.length < 2)) ctx.addIssue({ code: 'custom', path: [i, 'options'], message: 'Give a choice field at least two options.' });
    });
  }),
  defaultOwnerId: z.uuid().nullable().optional(),
  active: z.boolean().default(true),
});

export async function listForms(actor: Actor, opts: { includeInactive?: boolean } = {}) {
  return withTenant(actor.orgId, (tx) =>
    tx
      .select()
      .from(requestForms)
      .where(
        and(
          eq(requestForms.orgId, actor.orgId),
          opts.includeInactive && actor.role !== 'client' ? undefined : eq(requestForms.active, true),
          actor.role === 'client' ? sql`${requestForms.audience} in ('client','both')` : undefined,
        ),
      )
      .orderBy(asc(requestForms.name)),
  );
}

export async function saveForm(actor: Actor, input: unknown) {
  assertOrg(actor, 'forms.manage');
  const data = parse(formSchema, input);
  return withTenant(actor.orgId, async (tx) => {
    if (data.defaultOwnerId) {
      const [m] = await tx.select().from(memberships).where(and(eq(memberships.userId, data.defaultOwnerId), eq(memberships.orgId, actor.orgId)));
      if (!m || m.role === 'client') throw validation({ defaultOwnerId: 'The owner must be an internal member.' });
    }
    const values = { name: data.name, description: data.description ?? null, audience: data.audience, fields: data.fields as FormField[], defaultOwnerId: data.defaultOwnerId ?? null, active: data.active, updatedAt: new Date() };
    let form;
    if (data.formId) {
      [form] = await tx.update(requestForms).set(values).where(eq(requestForms.id, data.formId)).returning();
      if (!form) throw notFound('That form');
    } else {
      [form] = await tx.insert(requestForms).values({ ...values, orgId: actor.orgId }).returning();
    }
    await audit(tx, actor, data.formId ? 'form.updated' : 'form.created', { type: 'request_form', id: form!.id, metadata: { name: data.name } });
    return form!;
  });
}

/** Validates answers against a form definition. Unknown keys are dropped. */
export function validateAnswers(fields: FormField[], answers: Record<string, unknown>) {
  const out: Record<string, string | number> = {};
  const errors: Record<string, string> = {};
  for (const f of fields) {
    const raw = answers[f.key];
    const v = typeof raw === 'string' ? raw.trim() : raw;
    if (v === undefined || v === null || v === '') {
      if (f.required) errors[`answers.${f.key}`] = `${f.label} is required.`;
      continue;
    }
    switch (f.type) {
      case 'short_text':
        if (typeof v !== 'string' || v.length > 200) errors[`answers.${f.key}`] = 'Keep this under 200 characters.';
        else out[f.key] = v;
        break;
      case 'long_text':
        if (typeof v !== 'string' || v.length > 5000) errors[`answers.${f.key}`] = 'Keep this under 5,000 characters.';
        else out[f.key] = v;
        break;
      case 'select':
        if (typeof v !== 'string' || !f.options?.includes(v)) errors[`answers.${f.key}`] = 'Choose one of the options.';
        else out[f.key] = v;
        break;
      case 'date':
        if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v))) errors[`answers.${f.key}`] = 'Use a valid date.';
        else out[f.key] = v;
        break;
      case 'url':
        try {
          const u = new URL(String(v));
          if (!['http:', 'https:'].includes(u.protocol)) throw new Error();
          out[f.key] = u.toString();
        } catch {
          errors[`answers.${f.key}`] = 'Use a full link starting with https://';
        }
        break;
      case 'number': {
        const n = Number(v);
        if (!Number.isFinite(n)) errors[`answers.${f.key}`] = 'Use a number.';
        else out[f.key] = n;
        break;
      }
    }
  }
  if (Object.keys(errors).length) throw validation(errors);
  return out;
}

// ---------------------------------------------------------------------------
// Submit
// ---------------------------------------------------------------------------

const submitSchema = z.object({
  formId: z.uuid(),
  title: z.string().trim().min(3, 'Give your request a short title.').max(200),
  details: z.string().trim().max(10000).default(''),
  answers: z.record(z.string(), z.unknown()).default({}),
  projectId: z.uuid().nullable().optional(),
  clientAccountId: z.uuid().nullable().optional(),
  priority: z.enum(['none', 'low', 'medium', 'high', 'urgent']).optional(),
});

export async function submitRequest(actor: Actor, input: unknown) {
  const data = parse(submitSchema, input);
  if (actor.role === 'client') await rateLimit(`request-submit:${actor.userId}`, 20, 3600);
  return withTenant(actor.orgId, async (tx) => {
    const [form] = await tx.select().from(requestForms).where(and(eq(requestForms.id, data.formId), eq(requestForms.active, true)));
    if (!form) throw validation({ formId: 'That form is no longer available.' });
    if (actor.role === 'client' && form.audience === 'internal') throw validation({ formId: 'That form is no longer available.' });
    const answers = validateAnswers(form.fields, data.answers);

    let clientAccountId: string | null;
    if (actor.role === 'client') {
      clientAccountId = actor.clientAccountId;
    } else {
      clientAccountId = data.clientAccountId ?? null;
      if (clientAccountId) {
        const [c] = await tx.select().from(clientAccounts).where(eq(clientAccounts.id, clientAccountId));
        if (!c) throw validation({ clientAccountId: 'That client no longer exists.' });
      }
    }
    let projectId = data.projectId ?? null;
    if (projectId) {
      const access = await getProjectAccess(tx, actor, projectId).catch(() => null);
      if (!access) throw validation({ projectId: 'You can’t file requests against that project.' });
      if (clientAccountId && access.project.clientAccountId && access.project.clientAccountId !== clientAccountId) {
        throw validation({ projectId: 'That project belongs to a different client.' });
      }
      clientAccountId ??= access.project.clientAccountId;
    }

    // Per-org request numbers, serialized with a transaction-scoped advisory lock.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${actor.orgId} || ':requests'))`);
    const [{ next }] = (await tx.select({ next: sql<number>`coalesce(max(${requests.number}), 0)::int + 1` }).from(requests).where(eq(requests.orgId, actor.orgId))) as [{ next: number }];
    const [request] = await tx
      .insert(requests)
      .values({
        orgId: actor.orgId,
        number: next,
        clientAccountId,
        projectId,
        formId: form.id,
        title: data.title,
        details: data.details,
        answers,
        priority: actor.role === 'client' ? 'none' : (data.priority ?? 'none'),
        ownerId: form.defaultOwnerId,
        submittedBy: actor.userId,
        dueDate: typeof answers.deadline === 'string' ? answers.deadline : null,
      })
      .returning();
    const r = request!;
    await recordActivity(tx, actor, { projectId, verb: 'submitted', entityType: 'request', entityId: r.id, summary: `submitted request #${r.number} ${truncate(r.title, 80)}`, clientVisible: Boolean(clientAccountId) });
    const owners = form.defaultOwnerId
      ? [form.defaultOwnerId]
      : (await tx.select({ id: memberships.userId }).from(memberships).where(and(eq(memberships.orgId, actor.orgId), inArray(memberships.role, ['owner', 'admin'])))).map((m) => m.id);
    await notify(tx, actor, {
      userIds: owners,
      category: 'request',
      title: `New request #${r.number}: ${truncate(r.title, 80)}`,
      body: truncate(r.details, 200) || null,
      href: requestHref(actor.orgSlug, r.number),
      entityId: r.id,
    });
    await publish(tx, actor.orgId, 'org', 'request.created', r.id, { clientAccountId });
    return r;
  });
}

// ---------------------------------------------------------------------------
// List and detail
// ---------------------------------------------------------------------------

const listSchema = z.object({
  view: z.enum(['open', 'mine', 'unassigned', 'closed', 'all']).default('open'),
  status: z.array(z.enum(['submitted', 'in_review', 'needs_info', 'accepted', 'in_progress', 'completed', 'declined', 'duplicate'])).optional(),
  clientAccountId: z.uuid().optional(),
  projectId: z.uuid().optional(),
  q: z.string().trim().max(100).optional(),
});

export async function listRequests(actor: Actor, input: unknown = {}) {
  const f = parse(listSchema, input);
  if (actor.role !== 'client') assertOrg(actor, 'requests.triage');
  return withTenant(actor.orgId, async (tx) => {
    const isClient = actor.role === 'client';
    const rows = await tx
      .select({
        id: requests.id,
        number: requests.number,
        title: requests.title,
        status: requests.status,
        priority: requests.priority,
        createdAt: requests.createdAt,
        updatedAt: requests.updatedAt,
        dueDate: requests.dueDate,
        firstResponseAt: requests.firstResponseAt,
        resolvedAt: requests.resolvedAt,
        clientAccountId: requests.clientAccountId,
        clientName: clientAccounts.name,
        projectId: requests.projectId,
        projectKey: projects.key,
        projectName: projects.name,
        ownerId: requests.ownerId,
        ownerName: sql<string | null>`(select name from ${users} where ${users.id} = ${requests.ownerId})`,
        submittedByName: users.name,
        formName: requestForms.name,
        category: sql<string | null>`${requests.answers}->>'type'`,
        commentCount: isClient
          ? sql<number>`(select count(*)::int from ${comments} c where c.request_id = ${requests.id} and c.deleted_at is null and c.visibility = 'client')`
          : sql<number>`(select count(*)::int from ${comments} c where c.request_id = ${requests.id} and c.deleted_at is null)`,
      })
      .from(requests)
      .leftJoin(clientAccounts, eq(clientAccounts.id, requests.clientAccountId))
      .leftJoin(projects, eq(projects.id, requests.projectId))
      .leftJoin(users, eq(users.id, requests.submittedBy))
      .leftJoin(requestForms, eq(requestForms.id, requests.formId))
      .where(
        and(
          eq(requests.orgId, actor.orgId),
          isClient ? (actor.clientAccountId ? eq(requests.clientAccountId, actor.clientAccountId) : sql`false`) : undefined,
          f.view === 'open' ? inArray(requests.status, OPEN_REQUEST_STATUSES) : undefined,
          f.view === 'mine' ? and(eq(requests.ownerId, actor.userId), inArray(requests.status, OPEN_REQUEST_STATUSES)) : undefined,
          f.view === 'unassigned' ? and(isNull(requests.ownerId), inArray(requests.status, OPEN_REQUEST_STATUSES)) : undefined,
          f.view === 'closed' ? inArray(requests.status, CLOSED_REQUEST_STATUSES) : undefined,
          f.status?.length ? inArray(requests.status, f.status) : undefined,
          f.clientAccountId ? eq(requests.clientAccountId, f.clientAccountId) : undefined,
          f.projectId ? eq(requests.projectId, f.projectId) : undefined,
          f.q ? sql`(${requests.title} ilike ${'%' + f.q + '%'} or ${requests.search} @@ plainto_tsquery('simple', ${f.q}) or ${requests.number}::text = ${f.q.replace(/^#/, '')})` : undefined,
        ),
      )
      .orderBy(desc(requests.createdAt))
      .limit(300);
    return isClient ? rows.map((r) => ({ ...r, priority: 'none' as const, ownerId: null })) : rows;
  });
}

export async function getRequestByNumber(actor: Actor, number: number) {
  return withTenant(actor.orgId, async (tx) => {
    const [row] = await tx.select({ id: requests.id }).from(requests).where(and(eq(requests.orgId, actor.orgId), eq(requests.number, number)));
    if (!row) throw notFound('That request');
    const a = await getRequestAccess(tx, actor, row.id);
    const r = a.request;
    const [form] = r.formId ? await tx.select().from(requestForms).where(eq(requestForms.id, r.formId)) : [];
    const [client] = r.clientAccountId ? await tx.select({ id: clientAccounts.id, name: clientAccounts.name }).from(clientAccounts).where(eq(clientAccounts.id, r.clientAccountId)) : [];
    const [project] = r.projectId ? await tx.select({ id: projects.id, key: projects.key, name: projects.name, portalEnabled: projects.portalEnabled }).from(projects).where(eq(projects.id, r.projectId)) : [];
    const people = await tx
      .select({ id: users.id, name: users.name, avatarColor: users.avatarColor, email: users.email })
      .from(users)
      .where(inArray(users.id, [r.submittedBy, r.ownerId].filter((x): x is string => Boolean(x)).concat(['00000000-0000-0000-0000-000000000000'])));
    const [task] = r.convertedTaskId
      ? await tx.select({ id: tasks.id, number: tasks.number, title: tasks.title, projectKey: projects.key, shared: tasks.sharedWithClient }).from(tasks).innerJoin(projects, eq(projects.id, tasks.projectId)).where(eq(tasks.id, r.convertedTaskId))
      : [];
    const [convertedProject] = r.convertedProjectId ? await tx.select({ id: projects.id, key: projects.key, name: projects.name }).from(projects).where(eq(projects.id, r.convertedProjectId)) : [];
    const [duplicateOf] = r.duplicateOfId ? await tx.select({ id: requests.id, number: requests.number, title: requests.title }).from(requests).where(eq(requests.id, r.duplicateOfId)) : [];
    const attachments = await tx.select({ id: files.id, name: files.name, currentVersion: files.currentVersion }).from(files).where(and(eq(files.requestId, r.id), isNull(files.deletedAt)));
    const similar = a.canTriage
      ? await tx
          .select({ id: requests.id, number: requests.number, title: requests.title, status: requests.status, score: sql<number>`similarity(${requests.title}, ${r.title})` })
          .from(requests)
          .where(and(eq(requests.orgId, actor.orgId), sql`${requests.id} <> ${r.id}`, sql`similarity(${requests.title}, ${r.title}) > 0.3`))
          .orderBy(sql`similarity(${requests.title}, ${r.title}) desc`)
          .limit(5)
      : [];
    return {
      request: a.isClient ? { ...r, priority: 'none' as const } : r,
      access: { isClient: a.isClient, canTriage: a.canTriage },
      form: form ?? null,
      client: client ?? null,
      project: project ?? null,
      submittedBy: people.find((p) => p.id === r.submittedBy) ?? null,
      owner: a.isClient ? null : (people.find((p) => p.id === r.ownerId) ?? null),
      convertedTask: task && (!a.isClient || (task.shared && project?.portalEnabled)) ? task : null,
      convertedProject: a.isClient ? null : (convertedProject ?? null),
      duplicateOf: duplicateOf ?? null,
      attachments,
      similar,
    };
  });
}

// ---------------------------------------------------------------------------
// Triage
// ---------------------------------------------------------------------------

const STATUS_LABEL: Record<RequestStatus, string> = {
  submitted: 'Submitted',
  in_review: 'In review',
  needs_info: 'Waiting on you',
  accepted: 'Accepted',
  in_progress: 'In progress',
  completed: 'Completed',
  declined: 'Declined',
  duplicate: 'Duplicate',
};
export const requestStatusLabel = (s: RequestStatus, client = false) => (client || s !== 'needs_info' ? STATUS_LABEL[s] : 'Needs info');

const triageSchema = z.object({
  requestId: z.uuid(),
  version: z.number().int().positive(),
  status: z.enum(['submitted', 'in_review', 'needs_info', 'accepted', 'in_progress', 'completed', 'declined']).optional(),
  priority: z.enum(['none', 'low', 'medium', 'high', 'urgent']).optional(),
  ownerId: z.uuid().nullable().optional(),
  projectId: z.uuid().nullable().optional(),
  dueDate: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal(''), z.null()]).optional().transform((v) => (v === undefined ? undefined : v || null)),
  closureReason: z.string().trim().max(500).optional().nullable(),
});

export async function triageRequest(actor: Actor, input: unknown) {
  const data = parse(triageSchema, input);
  return withTenant(actor.orgId, async (tx) => {
    const a = await getRequestAccess(tx, actor, data.requestId);
    if (!a.canTriage) throw notFound('That request');
    const r = a.request;
    if (r.version !== data.version) throw validation({ _form: 'This request changed since you opened it. Refresh to see the latest.' }, 'This request changed.');
    const patch: Partial<typeof requests.$inferInsert> = {};
    if (data.priority !== undefined) patch.priority = data.priority;
    if (data.dueDate !== undefined) patch.dueDate = data.dueDate;
    if (data.ownerId !== undefined && data.ownerId !== r.ownerId) {
      if (data.ownerId) {
        const [m] = await tx.select().from(memberships).where(and(eq(memberships.userId, data.ownerId), eq(memberships.orgId, actor.orgId), eq(memberships.status, 'active')));
        if (!m || m.role === 'client') throw validation({ ownerId: 'The owner must be an active internal member.' });
      }
      patch.ownerId = data.ownerId;
    }
    if (data.projectId !== undefined && data.projectId !== r.projectId) {
      if (data.projectId) {
        const access = await getProjectAccess(tx, actor, data.projectId);
        if (r.clientAccountId && access.project.clientAccountId && access.project.clientAccountId !== r.clientAccountId) {
          throw validation({ projectId: 'That project belongs to a different client.' });
        }
      }
      patch.projectId = data.projectId;
      await tx.update(files).set({ projectId: data.projectId }).where(eq(files.requestId, r.id));
    }
    if (data.status && data.status !== r.status) {
      if (CLOSED_REQUEST_STATUSES.includes(data.status) && !data.closureReason && data.status === 'declined') {
        throw validation({ closureReason: 'Tell the requester why this was declined.' });
      }
      patch.status = data.status;
      if (CLOSED_REQUEST_STATUSES.includes(data.status)) {
        patch.resolvedAt = new Date();
        patch.closureReason = data.closureReason ?? null;
      } else {
        patch.resolvedAt = null;
      }
      if (!r.firstResponseAt && data.status !== 'submitted') patch.firstResponseAt = new Date();
    }
    if (Object.keys(patch).length === 0) return r;
    const [updated] = await tx.update(requests).set({ ...patch, version: r.version + 1, updatedAt: new Date() }).where(eq(requests.id, r.id)).returning();
    if (patch.status) {
      await recordActivity(tx, actor, {
        projectId: updated!.projectId,
        verb: 'status',
        entityType: 'request',
        entityId: r.id,
        summary: `moved request #${r.number} to ${STATUS_LABEL[patch.status as RequestStatus]}`,
        clientVisible: Boolean(r.clientAccountId),
      });
      const clientIds = r.clientAccountId ? await clientContactIds(tx, r.clientAccountId) : [];
      await notify(tx, actor, {
        userIds: [r.submittedBy].filter((id) => id && clientIds.includes(id)),
        category: 'request',
        title: `Request #${r.number} is now ${STATUS_LABEL[patch.status as RequestStatus].toLowerCase()}`,
        body: patch.closureReason ?? truncate(r.title, 120),
        href: requestHref(actor.orgSlug, r.number, true),
        entityId: r.id,
        dedupeKey: `request-status:${r.id}`,
      });
      await notify(tx, actor, {
        userIds: [r.submittedBy].filter((id) => id && !clientIds.includes(id)),
        category: 'request',
        title: `Request #${r.number} is now ${STATUS_LABEL[patch.status as RequestStatus].toLowerCase()}`,
        href: requestHref(actor.orgSlug, r.number),
        entityId: r.id,
        dedupeKey: `request-status:${r.id}`,
      });
    }
    if (patch.ownerId) {
      await notify(tx, actor, {
        userIds: [patch.ownerId],
        category: 'request',
        title: `You now own request #${r.number}: ${truncate(r.title, 80)}`,
        href: requestHref(actor.orgSlug, r.number),
        entityId: r.id,
      });
    }
    await publish(tx, actor.orgId, 'org', 'request.updated', r.id, { clientAccountId: r.clientAccountId });
    return updated!;
  });
}

/** Called when a client or internal user posts a client-visible comment on a request. */
export async function onRequestComment(tx: Tx, actor: Actor, requestId: string, visibility: 'internal' | 'client') {
  const [r] = await tx.select().from(requests).where(eq(requests.id, requestId));
  if (!r) return;
  const patch: Partial<typeof requests.$inferInsert> = {};
  if (actor.role === 'client' && r.status === 'needs_info') patch.status = 'in_review';
  if (actor.role !== 'client' && visibility === 'client' && !r.firstResponseAt) patch.firstResponseAt = new Date();
  if (Object.keys(patch).length) {
    await tx.update(requests).set({ ...patch, version: r.version + 1, updatedAt: new Date() }).where(eq(requests.id, r.id));
    await publish(tx, actor.orgId, 'org', 'request.updated', r.id, { clientAccountId: r.clientAccountId });
  }
}

export async function markDuplicate(actor: Actor, input: unknown) {
  const data = parse(z.object({ requestId: z.uuid(), duplicateOfNumber: z.number().int().positive() }), input);
  return withTenant(actor.orgId, async (tx) => {
    const a = await getRequestAccess(tx, actor, data.requestId);
    if (!a.canTriage) throw notFound('That request');
    const [orig] = await tx.select().from(requests).where(and(eq(requests.orgId, actor.orgId), eq(requests.number, data.duplicateOfNumber)));
    if (!orig || orig.id === a.request.id) throw validation({ duplicateOfNumber: 'Choose a different, existing request.' });
    if (orig.duplicateOfId === a.request.id) throw validation({ duplicateOfNumber: 'That request is already marked as a duplicate of this one.' });
    await tx
      .update(requests)
      .set({ status: 'duplicate', duplicateOfId: orig.id, closureReason: `Duplicate of #${orig.number}`, resolvedAt: new Date(), firstResponseAt: a.request.firstResponseAt ?? new Date(), version: a.request.version + 1, updatedAt: new Date() })
      .where(eq(requests.id, a.request.id));
    await recordActivity(tx, actor, { verb: 'duplicate', entityType: 'request', entityId: a.request.id, summary: `marked request #${a.request.number} as a duplicate of #${orig.number}`, clientVisible: true });
    await publish(tx, actor.orgId, 'org', 'request.updated', a.request.id, { clientAccountId: a.request.clientAccountId });
  });
}

const convertTaskSchema = z.object({
  requestId: z.uuid(),
  projectId: z.uuid(),
  title: z.string().trim().min(1).max(300).optional(),
  assigneeId: z.uuid().nullable().optional(),
  dueDate: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal(''), z.null()]).optional().transform((v) => v || null),
  shareWithClient: z.boolean().default(true),
});

/**
 * Turns an accepted request into a task, keeping the request's text, answers and a link
 * back. The request moves to "in progress" and completes when the task completes.
 */
export async function convertRequestToTask(actor: Actor, input: unknown) {
  const data = parse(convertTaskSchema, input);
  return withTenant(actor.orgId, async (tx) => {
    const a = await getRequestAccess(tx, actor, data.requestId);
    if (!a.canTriage) throw notFound('That request');
    const r = a.request;
    if (r.convertedTaskId) throw precondition('This request was already converted to a task.');
    const access = await getProjectAccess(tx, actor, data.projectId);
    if (!access.can('task.create')) throw validation({ projectId: 'You can’t create tasks in that project.' });
    if (r.clientAccountId && access.project.clientAccountId && access.project.clientAccountId !== r.clientAccountId) {
      throw validation({ projectId: 'That project belongs to a different client.' });
    }
    const [form] = r.formId ? await tx.select().from(requestForms).where(eq(requestForms.id, r.formId)) : [];
    const answerLines = (form?.fields ?? [])
      .filter((f) => r.answers[f.key] !== undefined)
      .map((f) => `${f.label}: ${String(r.answers[f.key])}`);
    const description = plainToRichText([`From request #${r.number}.`, r.details, answerLines.join('\n')].filter(Boolean).join('\n\n'));
    const canShare = access.can('project.shareWithClient') && access.project.clientAccountId === r.clientAccountId && Boolean(r.clientAccountId);
    const task = await createTaskInTx(tx, actor, access, {
      projectId: data.projectId,
      title: data.title || r.title,
      description,
      priority: r.priority,
      assigneeId: data.assigneeId ?? null,
      dueDate: data.dueDate ?? r.dueDate,
      startDate: null,
      labelIds: [],
      sharedWithClient: data.shareWithClient && canShare,
      sourceRequestId: r.id,
    });
    await tx
      .update(requests)
      .set({ convertedTaskId: task.id, projectId: data.projectId, status: 'in_progress', firstResponseAt: r.firstResponseAt ?? new Date(), version: r.version + 1, updatedAt: new Date() })
      .where(eq(requests.id, r.id));
    await tx.update(files).set({ projectId: data.projectId }).where(eq(files.requestId, r.id));
    await recordActivity(tx, actor, { projectId: data.projectId, verb: 'converted', entityType: 'request', entityId: r.id, summary: `turned request #${r.number} into ${task.ref}`, clientVisible: true });
    const clientIds = r.clientAccountId ? await clientContactIds(tx, r.clientAccountId) : [];
    await notify(tx, actor, {
      userIds: [r.submittedBy].filter((id) => id && clientIds.includes(id)),
      category: 'request',
      title: `Request #${r.number} is in progress`,
      body: truncate(r.title, 120),
      href: requestHref(actor.orgSlug, r.number, true),
      entityId: r.id,
    });
    await publish(tx, actor.orgId, 'org', 'request.updated', r.id, { clientAccountId: r.clientAccountId });
    return { task, href: taskHref(actor.orgSlug, access.project.key, task.number) };
  });
}

export async function convertRequestToProject(actor: Actor, input: unknown) {
  const data = parse(z.object({ requestId: z.uuid(), name: z.string(), key: z.string(), templateId: z.string().default('blank') }), input);
  const r = await withTenant(actor.orgId, async (tx) => {
    const a = await getRequestAccess(tx, actor, data.requestId);
    if (!a.canTriage) throw notFound('That request');
    if (a.request.convertedProjectId || a.request.convertedTaskId) throw precondition('This request was already converted.');
    return a.request;
  });
  const project = await createProject(actor, {
    name: data.name,
    key: data.key,
    templateId: data.templateId,
    clientAccountId: r.clientAccountId,
    description: `Started from request #${r.number}: ${r.title}\n\n${r.details}`.slice(0, 2000),
  });
  await withTenant(actor.orgId, async (tx) => {
    await tx
      .update(requests)
      .set({ convertedProjectId: project.id, projectId: project.id, status: 'accepted', firstResponseAt: r.firstResponseAt ?? new Date(), version: sql`${requests.version} + 1`, updatedAt: new Date() })
      .where(eq(requests.id, r.id));
    await tx.update(files).set({ projectId: project.id }).where(eq(files.requestId, r.id));
    await recordActivity(tx, actor, { projectId: project.id, verb: 'converted', entityType: 'request', entityId: r.id, summary: `started project ${project.name} from request #${r.number}` });
    await publish(tx, actor.orgId, 'org', 'request.updated', r.id, { clientAccountId: r.clientAccountId });
  });
  return project;
}

/** When a task created from a request completes, the request completes too. */
export async function completeRequestsForTask(tx: Tx, actor: Actor, taskId: string, projectKey: string, taskNumber: number) {
  const linked = await tx.select().from(requests).where(and(eq(requests.convertedTaskId, taskId), inArray(requests.status, OPEN_REQUEST_STATUSES)));
  for (const r of linked) {
    await tx.update(requests).set({ status: 'completed', resolvedAt: new Date(), closureReason: `Completed in ${taskRef(projectKey, taskNumber)}`, version: r.version + 1, updatedAt: new Date() }).where(eq(requests.id, r.id));
    await recordActivity(tx, actor, { projectId: r.projectId, verb: 'completed', entityType: 'request', entityId: r.id, summary: `completed request #${r.number}`, clientVisible: true });
    const clientIds = r.clientAccountId ? await clientContactIds(tx, r.clientAccountId) : [];
    await notify(tx, actor, {
      userIds: [r.submittedBy].filter((id) => id && clientIds.includes(id)),
      category: 'request',
      title: `Request #${r.number} is complete`,
      body: truncate(r.title, 120),
      href: requestHref(actor.orgSlug, r.number, true),
      entityId: r.id,
      dedupeKey: `request-status:${r.id}`,
    });
    await publish(tx, actor.orgId, 'org', 'request.updated', r.id, { clientAccountId: r.clientAccountId });
  }
}

/** Requests visible in a project's Requests tab (internal) — reuses project visibility. */
export async function listProjectRequests(actor: Actor, projectId: string) {
  return withTenant(actor.orgId, async (tx) => {
    const access = await getProjectAccess(tx, actor, projectId);
    return tx
      .select({ id: requests.id, number: requests.number, title: requests.title, status: requests.status, createdAt: requests.createdAt })
      .from(requests)
      .where(and(eq(requests.projectId, projectId), access.isClient ? eq(requests.clientAccountId, actor.clientAccountId ?? '00000000-0000-0000-0000-000000000000') : undefined, sql`exists (select 1 from ${projects} where ${projects.id} = ${requests.projectId} and ${visibleProjectsSql(actor)})`))
      .orderBy(desc(requests.createdAt));
  });
}
