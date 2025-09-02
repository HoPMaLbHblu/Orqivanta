import { describe, expect, it } from 'vitest';
import { eq, projects, sql, tasks, withTenant } from '@orqivanta/db';
import {
  addProjectMembers,
  convertRequestToTask,
  createApproval,
  createComment,
  createProject,
  createTask,
  decideApproval,
  getApproval,
  getProjectByKey,
  getTask,
  listComments,
  listProjects,
  listRequests,
  listTasks,
  setPortalEnabled,
  submitRequest,
  updateTask,
  uploadFile,
  uploadFileVersion,
  updateFile,
  plainToRichText,
} from '../src';
import { simplePdf } from '../src/demo/assets';
import { expectCode, makeOrg } from './helpers';

const pdf = (title: string) => ({ buffer: simplePdf(title, ['test']), originalName: `${title}.pdf` });

describe('tenant isolation', () => {
  it('keeps one organization’s data invisible to another, at the service and database level', async () => {
    const a = await makeOrg('Alpha');
    const b = await makeOrg('Beta');
    const project = await createProject(a.owner, { name: 'Secret launch', key: 'SEC' });

    expect(await listProjects(b.owner, {})).toEqual([]);
    await expectCode(getProjectByKey(b.owner, 'SEC'), 'NOT_FOUND');

    // Row-level security: even a raw query scoped to org B cannot read org A’s rows.
    const leaked = await withTenant(b.org.id, (tx) => tx.select().from(projects).where(eq(projects.id, project.id)));
    expect(leaked).toEqual([]);

    // …or write into org A.
    await expect(
      withTenant(b.org.id, (tx) =>
        tx.insert(tasks).values({ orgId: a.org.id, projectId: project.id, number: 99, title: 'x', statusId: project.id, position: 1 }),
      ),
    ).rejects.toThrow();
  });

  it('numbers requests per organization', async () => {
    const a = await makeOrg();
    const b = await makeOrg();
    const formOf = async (orgId: string) => (await withTenant(orgId, (tx) => tx.execute<{ id: string }>(sql`select id from request_forms limit 1`))).rows[0]!.id;
    const r1 = await submitRequest(a.owner, { formId: await formOf(a.org.id), title: 'First in A', answers: { type: 'Question' } });
    const r2 = await submitRequest(b.owner, { formId: await formOf(b.org.id), title: 'First in B', answers: { type: 'Question' } });
    const r3 = await submitRequest(a.owner, { formId: await formOf(a.org.id), title: 'Second in A', answers: { type: 'Question' } });
    expect([r1.number, r2.number, r3.number]).toEqual([1, 1, 2]);
  });
});

describe('member and client access', () => {
  it('hides private projects from members who are not on them', async () => {
    const t = await makeOrg();
    const member = await t.add('member');
    await createProject(t.owner, { name: 'Hiring', key: 'HIR', visibility: 'private' });
    const open = await createProject(t.owner, { name: 'Open', key: 'OPN', visibility: 'org' });
    expect((await listProjects(member, {})).map((p) => p.key)).toEqual(['OPN']);
    // Visible but read-only until added.
    await expectCode(createTask(member, { projectId: open.id, title: 'Try' }), 'FORBIDDEN');
    await addProjectMembers(t.owner, { projectId: open.id, userIds: [member.userId], role: 'contributor' });
    expect((await createTask(member, { projectId: open.id, title: 'Now I can' })).title).toBe('Now I can');
  });

  it('shows clients only shared items in their own portal projects', async () => {
    const t = await makeOrg();
    const { account, contact } = await t.client('Harbor');
    const other = await t.client('Lumen');
    const project = await createProject(t.owner, { name: 'Website', key: 'WEB', clientAccountId: account.id });

    // Portal off: the project does not exist for the client.
    expect(await listProjects(contact, {})).toEqual([]);
    await setPortalEnabled(t.owner, { projectId: project.id, enabled: true });
    expect((await listProjects(contact, {})).map((p) => p.key)).toEqual(['WEB']);
    expect(await listProjects(other.contact, {})).toEqual([]);

    const hidden = await createTask(t.owner, { projectId: project.id, title: 'Internal estimate' });
    const shared = await createTask(t.owner, { projectId: project.id, title: 'Homepage review', sharedWithClient: true });
    expect((await listTasks(contact, { projectId: project.id })).tasks.map((x) => x.title)).toEqual(['Homepage review']);
    await expectCode(getTask(contact, `WEB-${hidden.number}`), 'NOT_FOUND');

    await createComment(t.owner, { parent: { type: 'task', id: shared.id }, visibility: 'internal', body: plainToRichText('Budget is tight') });
    await createComment(t.owner, { parent: { type: 'task', id: shared.id }, visibility: 'client', body: plainToRichText('Ready for you') });
    const seen = await listComments(contact, { type: 'task', id: shared.id });
    expect(seen.comments.map((c) => JSON.stringify(c.body))).toEqual([expect.stringContaining('Ready for you')]);

    // Clients cannot post internal comments, even by asking for it.
    const c = await createComment(contact, { parent: { type: 'task', id: shared.id }, visibility: 'internal', body: plainToRichText('Hi') });
    expect(c.visibility).toBe('client');
  });
});

describe('tasks', () => {
  it('rejects a save based on a stale version and returns the current task', async () => {
    const t = await makeOrg();
    const project = await createProject(t.owner, { name: 'P', key: 'PRJ' });
    const task = await createTask(t.owner, { projectId: project.id, title: 'Original' });
    await updateTask(t.owner, { taskId: task.id, version: task.version, title: 'First edit' });
    const err = (await expectCode(updateTask(t.owner, { taskId: task.id, version: task.version, title: 'Stale edit' }), 'CONFLICT')) as { details?: { current?: { version?: number } } };
    expect(err.details?.current?.version).toBe(task.version + 1);
    expect((await getTask(t.owner, `PRJ-${task.number}`)).task.title).toBe('First edit');
  });
});

describe('approvals and requests', () => {
  it('runs review rounds on exact file versions', async () => {
    const t = await makeOrg();
    const { account, contact } = await t.client();
    const second = await t.add('client', account.id);
    const project = await createProject(t.owner, { name: 'Brand', key: 'BRD', clientAccountId: account.id });
    await setPortalEnabled(t.owner, { projectId: project.id, enabled: true });
    const { file } = await uploadFile(t.owner, { projectId: project.id, kind: 'deliverable', name: 'Logo' }, pdf('logo-v1'));

    await expectCode(createApproval(t.owner, { projectId: project.id, title: 'Logo', fileId: file.id, reviewerIds: [contact.userId] }), 'VALIDATION');
    await updateFile(t.owner, { fileId: file.id, sharedWithClient: true });
    const round1 = await createApproval(t.owner, { projectId: project.id, title: 'Logo', fileId: file.id, reviewerIds: [contact.userId, second.userId], rule: 'all' });

    await decideApproval(contact, { approvalId: round1.id, decision: 'approved' });
    expect((await getApproval(t.owner, round1.id)).approval.status).toBe('pending');
    await expectCode(decideApproval(t.owner, { approvalId: round1.id, decision: 'approved' }), 'FORBIDDEN');
    await expectCode(decideApproval(second, { approvalId: round1.id, decision: 'changes_requested' }), 'VALIDATION');
    await decideApproval(second, { approvalId: round1.id, decision: 'changes_requested', comment: 'Bigger, please' });
    expect((await getApproval(t.owner, round1.id)).approval.status).toBe('changes_requested');

    const { reopenedApprovals } = await uploadFileVersion(t.owner, { fileId: file.id }, pdf('logo-v2'));
    expect(reopenedApprovals).toBe(1);
    const newer = (await getApproval(t.owner, round1.id)).newerRound!;
    const round2 = (await getApproval(t.owner, newer.id)).approval;
    expect(round2.round).toBe(2);
    expect(round2.status).toBe('pending');
    expect((await getApproval(t.owner, round1.id)).approval.status).toBe('superseded');
  });

  it('completes a converted request when its task is done', async () => {
    const t = await makeOrg();
    const { account, contact } = await t.client();
    const project = await createProject(t.owner, { name: 'Site', key: 'SIT', clientAccountId: account.id });
    await setPortalEnabled(t.owner, { projectId: project.id, enabled: true });
    const formId = (await withTenant(t.org.id, (tx) => tx.execute<{ id: string }>(sql`select id from request_forms limit 1`))).rows[0]!.id;
    const request = await submitRequest(contact, { formId, title: 'Fix the footer', answers: { type: 'Problem or bug' }, projectId: project.id });
    const { task } = await convertRequestToTask(t.owner, { requestId: request.id, projectId: project.id });
    const done = (await withTenant(t.org.id, (tx) => tx.execute<{ id: string }>(sql`select id from project_statuses where project_id = ${project.id} and category = 'completed'`))).rows[0]!.id;
    await updateTask(t.owner, { taskId: task.id, version: task.version, statusId: done });
    const mine = await listRequests(contact, { view: 'all' });
    expect(mine.map((r: { status: string }) => r.status)).toEqual(['completed']);
  });
});
