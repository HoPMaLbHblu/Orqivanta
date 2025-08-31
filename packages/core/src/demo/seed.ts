import {
  and,
  clientAccounts,
  dataExports,
  eq,
  fileVersions,
  inArray,
  memberships,
  notifications,
  organizations,
  outbox,
  projectStatuses,
  requests,
  sql,
  tasks,
  users,
  withSystem,
  withTenant,
} from '@orqivanta/db';
import { hashPassword } from '../auth/password';
import type { RichDoc } from '../lib/richtext';
import { plainToRichText } from '../lib/richtext';
import type { Actor } from '../permissions';
import { storage } from '../storage';
import { decideApproval, createApproval } from '../services/approvals';
import { saveClient } from '../services/clients';
import { createComment, toggleReaction } from '../services/comments';
import { resolveActorById } from '../services/context';
import { createDocument, saveDocument, setDocumentShared } from '../services/documents';
import { updateFile, uploadFile, uploadFileVersion } from '../services/files';
import { saveView } from '../services/tasks';
import { setFavorite } from '../services/inbox';
import { createOrganization } from '../services/orgs';
import { addProjectMembers, createProject, postProjectUpdate, saveMilestone, setPortalEnabled } from '../services/projects';
import { convertRequestToTask, markDuplicate, submitRequest, triageRequest } from '../services/requests';
import { createTask, saveChecklistItem, updateTask } from '../services/tasks';
import { createTeam } from '../services/teams';
import { conceptImage, logoSheet, simplePdf } from './assets';

/**
 * The sample workspace behind the demo. Every person, client and project in it is fictional
 * and the organization is flagged is_demo, which the UI labels as sample data.
 *
 * Everything is created through the same services the app uses, so the data obeys the same
 * rules (permissions, numbering, activity, notifications). Events run in story order with a
 * virtual clock; afterwards every timestamp the seed wrote is moved onto that timeline, so
 * reports and activity feeds read like six weeks of real work.
 */

export const DEMO_PASSWORD = 'orqivanta-demo';
export const DEMO_ORG_SLUG = 'northwind';

export const DEMO_PERSONAS = [
  { key: 'maya', name: 'Maya Okafor', email: 'maya@northwind.example', title: 'Studio director', role: 'owner' as const, color: 'verdigris' },
  { key: 'priya', name: 'Priya Shah', email: 'priya@northwind.example', title: 'Producer', role: 'admin' as const, color: 'amber' },
  { key: 'leo', name: 'Leo Martins', email: 'leo@northwind.example', title: 'Designer', role: 'member' as const, color: 'plum' },
  { key: 'sam', name: 'Sam Ito', email: 'sam@northwind.example', title: 'Developer', role: 'member' as const, color: 'ocean' },
  { key: 'nadia', name: 'Nadia Petrova', email: 'nadia@northwind.example', title: 'Content strategist', role: 'member' as const, color: 'moss' },
  { key: 'tomas', name: 'Tomás Rivera', email: 'tomas@northwind.example', title: 'Developer', role: 'member' as const, color: 'rose' },
  { key: 'hannah', name: 'Hannah Cole', email: 'hannah@harborpine.example', title: 'Owner, Harbor & Pine', role: 'client' as const, color: 'amber', client: 'harbor' },
  { key: 'marcus', name: 'Marcus Lee', email: 'marcus@harborpine.example', title: 'Operations, Harbor & Pine', role: 'client' as const, color: 'ocean', client: 'harbor' },
  { key: 'ruth', name: 'Ruth Alvarez', email: 'ruth@lumenhealth.example', title: 'Marketing lead, Lumen Health', role: 'client' as const, color: 'moss', client: 'lumen' },
] as const;

/** Who the demo switcher offers, and what each one shows off. */
export const DEMO_SWITCHER = [
  { key: 'priya', label: 'Producer', description: 'Admin who runs projects, triages requests and reads reports.' },
  { key: 'leo', label: 'Designer', description: 'Team member with assigned tasks and a pending review.' },
  { key: 'hannah', label: 'Client', description: 'Client contact using the portal to review work and send requests.' },
] as const;

type PersonaKey = (typeof DEMO_PERSONAS)[number]['key'];

const DAY = 86_400_000;

function isoDay(offsetDays: number) {
  return new Date(Date.now() + offsetDays * DAY).toISOString().slice(0, 10);
}

// ——— Rich text helpers ———
const text = (t: string) => ({ type: 'text', text: t });
const p = (t: string) => ({ type: 'paragraph', content: [text(t)] });
const h = (level: number, t: string) => ({ type: 'heading', attrs: { level }, content: [text(t)] });
const ul = (items: string[]) => ({ type: 'bulletList', content: items.map((i) => ({ type: 'listItem', content: [p(i)] })) });
const todo = (items: [string, boolean][]) => ({ type: 'taskList', content: items.map(([t, checked]) => ({ type: 'taskItem', attrs: { checked }, content: [p(t)] })) });
const doc = (...content: unknown[]) => ({ type: 'doc', content }) as RichDoc;
const mention = (id: string, label: string) => ({ type: 'mention', attrs: { id, label } });
const withMention = (before: string, id: string, label: string, after: string) => doc({ type: 'paragraph', content: [text(before), mention(id, label), text(after)] });

/**
 * Story clock. `at(daysAgo, hour)` queues an action; `run()` executes them in time order and
 * records (real time → story time) checkpoints for the timestamp rewrite.
 */
class StoryClock {
  private events: { at: number; seq: number; fn: () => Promise<void> }[] = [];
  private seq = 0;
  checkpoints: { real: Date; virt: Date }[] = [];
  readonly now = Date.now();

  at(daysAgo: number, hour: number, fn: () => Promise<void>) {
    const day = new Date(this.now - daysAgo * DAY);
    day.setUTCHours(hour, (this.seq * 7) % 60, 0, 0);
    const at = Math.min(day.getTime(), this.now - 60_000);
    this.events.push({ at, seq: this.seq++, fn });
  }

  async run() {
    const ordered = [...this.events].sort((a, b) => a.at - b.at || a.seq - b.seq);
    for (const e of ordered) {
      await new Promise((r) => setTimeout(r, 3));
      this.checkpoints.push({ real: new Date(), virt: new Date(e.at) });
      await e.fn();
    }
    await new Promise((r) => setTimeout(r, 3));
    this.checkpoints.push({ real: new Date(), virt: new Date(this.now) });
  }
}

export async function resetDemo(log: (msg: string) => void = () => {}) {
  await removeDemo(log);
  return seedDemo(log);
}

/** Deletes the demo organization, its stored files and the demo accounts. */
export async function removeDemo(log: (msg: string) => void = () => {}) {
  const keys = await withSystem(async (tx) => {
    const orgs = await tx.select({ id: organizations.id }).from(organizations).where(eq(organizations.isDemo, true));
    const ids = orgs.map((o) => o.id);
    if (!ids.length) return [];
    const versions = await tx.select({ k: fileVersions.storageKey, p: fileVersions.previewKey }).from(fileVersions).where(inArray(fileVersions.orgId, ids));
    const exportsRows = await tx.select({ k: dataExports.storageKey }).from(dataExports).where(inArray(dataExports.orgId, ids));
    await tx.delete(organizations).where(inArray(organizations.id, ids));
    return [...versions.flatMap((v) => [v.k, v.p]), ...exportsRows.map((e) => e.k)].filter((k): k is string => Boolean(k));
  });
  await withSystem((tx) => tx.delete(users).where(eq(users.isDemo, true)));
  for (const k of keys) await storage.delete(k).catch(() => {});
  log(`removed demo workspace (${keys.length} stored objects)`);
}

export async function seedDemo(log: (msg: string) => void = () => {}) {
  const clock = new StoryClock();
  const passwordHash = await hashPassword(DEMO_PASSWORD);

  // People exist before the story starts.
  const ids = {} as Record<PersonaKey, string>;
  await withSystem(async (tx) => {
    for (const person of DEMO_PERSONAS) {
      const [u] = await tx
        .insert(users)
        .values({ email: person.email, name: person.name, passwordHash, emailVerifiedAt: new Date(), avatarColor: person.color, isDemo: true, timeZone: 'Europe/London' })
        .returning({ id: users.id });
      ids[person.key] = u!.id;
    }
  });

  const actors = {} as Record<PersonaKey, Actor>;
  const as = (k: PersonaKey) => actors[k]!;
  const refresh = async () => {
    for (const person of DEMO_PERSONAS) {
      const a = await resolveActorById(ids[person.key], org.id);
      if (a) actors[person.key] = a;
    }
  };

  let org!: { id: string; slug: string };
  const clients = {} as Record<'harbor' | 'lumen' | 'atlas', string>;
  const projects = {} as Record<'HPC' | 'LUM' | 'ATL' | 'OPS', string>;
  const statusIds = {} as Record<string, Record<string, string>>;
  const taskIds: Record<string, string> = {};
  const docs: Record<string, string> = {};
  const fileIds: Record<string, string> = {};
  const approvalIds: Record<string, string> = {};
  const requestIds: Record<number, string> = {};

  const taskVersion = async (taskId: string) => {
    const [t] = await withTenant(org.id, (tx) => tx.select({ version: tasks.version }).from(tasks).where(eq(tasks.id, taskId)));
    return t!.version;
  };
  const requestVersion = async (requestId: string) => {
    const [r] = await withTenant(org.id, (tx) => tx.select({ version: requests.version }).from(requests).where(eq(requests.id, requestId)));
    return r!.version;
  };
  const loadStatuses = async (key: keyof typeof projects) => {
    const rows = await withTenant(org.id, (tx) => tx.select().from(projectStatuses).where(eq(projectStatuses.projectId, projects[key])));
    statusIds[key] = Object.fromEntries(rows.map((s) => [s.category, s.id]));
  };
  const templateTaskId = async (key: keyof typeof projects, number: number) => {
    const [t] = await withTenant(org.id, (tx) => tx.select({ id: tasks.id }).from(tasks).where(and(eq(tasks.projectId, projects[key]), eq(tasks.number, number))));
    return t!.id;
  };
  const move = (actor: PersonaKey, project: keyof typeof projects, ref: string, category: string) => async () => {
    const id = taskIds[ref]!;
    await updateTask(as(actor), { taskId: id, version: await taskVersion(id), statusId: statusIds[project]![category] });
  };

  // ——— Week -9: the studio sets up ———
  clock.at(63, 9, async () => {
    org = await createOrganization(ids.maya, { name: 'Northwind Studio', slug: DEMO_ORG_SLUG, purpose: 'agency' });
    await withSystem(async (tx) => {
      await tx.update(organizations).set({ isDemo: true, onboarding: ['profile', 'invite', 'project', 'client'] }).where(eq(organizations.id, org.id));
      for (const person of DEMO_PERSONAS) {
        if (person.role === 'owner' || person.role === 'client') continue;
        await tx.insert(memberships).values({ orgId: org.id, userId: ids[person.key], role: person.role, title: person.title });
      }
      await tx.update(memberships).set({ title: 'Studio director' }).where(and(eq(memberships.orgId, org.id), eq(memberships.userId, ids.maya)));
      await tx.update(users).set({ lastActiveOrgId: org.id }).where(eq(users.isDemo, true));
    });
    await refresh();
  });

  clock.at(63, 11, async () => {
    clients.harbor = (await saveClient(as('maya'), { name: 'Harbor & Pine Coffee', website: 'harborpine.example', internalNotes: 'Three cafés, fourth opening in spring. Hannah decides; Marcus handles day-to-day.', accentColor: 'amber' })).id;
    clients.lumen = (await saveClient(as('maya'), { name: 'Lumen Health', website: 'lumenhealth.example', internalNotes: 'Brand refresh ahead of their clinic expansion. Legal reviews all public copy.', accentColor: 'moss' })).id;
    clients.atlas = (await saveClient(as('maya'), { name: 'Atlas Bikes', website: 'atlasbikes.example', internalNotes: 'Monthly retainer: 20 hours. Prefers email over the portal.', accentColor: 'ocean' })).id;
    await withSystem(async (tx) => {
      for (const person of DEMO_PERSONAS) {
        if (person.role !== 'client') continue;
        await tx.insert(memberships).values({ orgId: org.id, userId: ids[person.key], role: 'client', clientAccountId: clients[person.client], title: person.title });
      }
    });
    await refresh();
  });

  clock.at(62, 10, async () => {
    await createTeam(as('maya'), { name: 'Design', color: 'plum', memberIds: [ids.maya, ids.leo] });
    await createTeam(as('maya'), { name: 'Engineering', color: 'ocean', memberIds: [ids.sam, ids.tomas] });
    await createTeam(as('maya'), { name: 'Content', color: 'moss', memberIds: [ids.nadia] });
    const handbook = await createDocument(as('maya'), { title: 'Studio handbook', template: 'blank' });
    docs.handbook = handbook.id;
    await saveDocument(as('maya'), {
      documentId: handbook.id,
      baseVersion: handbook.version,
      content: doc(
        h(2, 'How we work'),
        p('Every client project has a producer, a weekly update and one place for decisions. If it was agreed in a call, it gets written down here or in the project.'),
        h(2, 'Client communication'),
        ul(['Share work through the portal so feedback lands next to the file.', 'Ask for approval on an exact version, never on “the latest”.', 'Reply to new requests within one working day, even if only to say when we will look.']),
        h(2, 'Definition of done'),
        todo([['Reviewed by someone who did not make it', true], ['Checked on a phone', true], ['Client approval recorded if it is a deliverable', true]]),
      ),
    });
  });

  // ——— Atlas Bikes retainer, running since week -9 ———
  clock.at(60, 10, async () => {
    const proj = await createProject(as('priya'), { name: 'Atlas Bikes retainer', key: 'ATL', templateId: 'retainer', clientAccountId: clients.atlas, startDate: isoDay(-60), memberIds: [ids.sam, ids.tomas], description: 'Monthly site care and small campaigns for Atlas Bikes. 20 hours a month.' });
    projects.ATL = proj.id;
    await loadStatuses('ATL');
    const scope = await createDocument(as('priya'), { title: 'Retainer scope and response times', projectId: proj.id, template: 'blank' });
    docs.atlScope = scope.id;
    await saveDocument(as('priya'), {
      documentId: scope.id,
      baseVersion: scope.version,
      content: doc(
        h(2, 'What the retainer covers'),
        ul(['Content and product updates on the existing site', 'Small campaign pages and banners', 'Dependency and security updates']),
        h(2, 'Response times'),
        p('We acknowledge new requests within one working day and agree a date on the same thread.'),
      ),
    });
  });

  const retainerWork: { title: string; who: PersonaKey; created: number; done: number | null; priority?: string; label?: string }[] = [
    { title: 'Update spring price list', who: 'sam', created: 58, done: 55 },
    { title: 'Fix broken links in the size guide', who: 'tomas', created: 56, done: 54, label: 'Bug' },
    { title: 'Add new e-bike range to the catalogue', who: 'sam', created: 52, done: 45, priority: 'high' },
    { title: 'Update framework and dependencies', who: 'tomas', created: 49, done: 47 },
    { title: 'Store locator: add Bristol shop', who: 'sam', created: 44, done: 43 },
    { title: 'Summer sale banner', who: 'tomas', created: 38, done: 34, label: 'Design' },
    { title: 'Image compression on product pages', who: 'sam', created: 35, done: 29 },
    { title: 'Warranty page copy refresh', who: 'tomas', created: 30, done: 26, label: 'Content' },
    { title: 'Checkout error on old Safari versions', who: 'sam', created: 27, done: 25, priority: 'urgent', label: 'Bug' },
    { title: 'Monthly analytics check-in notes', who: 'tomas', created: 22, done: 19 },
    { title: 'Accessibility fixes from audit', who: 'sam', created: 18, done: 11, priority: 'high' },
    { title: 'Update delivery times banner', who: 'tomas', created: 12, done: 9 },
    { title: 'Add rental bikes landing page', who: 'sam', created: 8, done: null, priority: 'medium' },
    { title: 'Renew SSL monitoring alerts', who: 'tomas', created: 5, done: null, priority: 'low' },
  ];
  retainerWork.forEach((w, i) => {
    const ref = `ATL-w${i}`;
    clock.at(w.created, 10, async () => {
      const labelIds = w.label ? await labelId(w.label) : [];
      const t = await createTask(as('priya'), { projectId: projects.ATL, title: w.title, assigneeId: ids[w.who], priority: w.priority ?? 'none', labelIds, statusId: statusIds.ATL!.unstarted, dueDate: isoDay(-(w.done ?? -6) + 1) });
      taskIds[ref] = t.id;
    });
    const startDay = w.done !== null ? Math.max(w.done, w.created - Math.max(1, Math.round((w.created - w.done) / 3))) : w.created - 1;
    if (startDay < w.created) clock.at(startDay, 9, move(w.who, 'ATL', ref, 'started'));
    if (w.done !== null) clock.at(w.done, 16, move(w.who, 'ATL', ref, 'completed'));
  });

  const labelId = async (name: string) => {
    const rows = await withTenant(org.id, (tx) => tx.execute<{ id: string }>(sql`select id from labels where org_id = ${org.id} and name = ${name}`));
    return rows.rows.map((r) => r.id);
  };

  // ——— Studio operations (private to the leads) ———
  clock.at(55, 14, async () => {
    const proj = await createProject(as('maya'), { name: 'Studio operations', key: 'OPS', templateId: 'blank', visibility: 'private', memberIds: [ids.priya], description: 'Hiring, tools and studio admin. Private to the studio leads.' });
    projects.OPS = proj.id;
    await loadStatuses('OPS');
    for (const [title, who, cat] of [
      ['Hire a mid-level developer', 'maya', 'started'],
      ['Renew design tool licences', 'priya', 'completed'],
      ['Plan autumn team offsite', 'priya', 'unstarted'],
    ] as const) {
      const t = await createTask(as('maya'), { projectId: proj.id, title, assigneeId: ids[who], statusId: statusIds.OPS![cat] });
      taskIds[`OPS-${title}`] = t.id;
    }
  });

  // ——— Harbor & Pine website ———
  clock.at(40, 10, async () => {
    const proj = await createProject(as('priya'), {
      name: 'Harbor & Pine website',
      key: 'HPC',
      templateId: 'client-website',
      clientAccountId: clients.harbor,
      startDate: isoDay(-40),
      dueDate: isoDay(30),
      memberIds: [ids.leo, ids.sam, ids.nadia, ids.tomas],
      description: 'A new site for Harbor & Pine Coffee: menus, locations and online orders for pickup, ready for the fourth café opening.',
    });
    projects.HPC = proj.id;
    await loadStatuses('HPC');
    await setPortalEnabled(as('priya'), { projectId: proj.id, enabled: true });
    for (let n = 1; n <= 8; n++) taskIds[`HPC-${n}`] = await templateTaskId('HPC', n);
    const assign: Record<number, [PersonaKey, string | null, boolean]> = {
      1: ['priya', isoDay(-36), true],
      2: ['nadia', isoDay(-30), true],
      3: ['nadia', isoDay(-24), false],
      4: ['leo', isoDay(-8), true],
      5: ['leo', isoDay(4), false],
      6: ['sam', isoDay(18), false],
      7: ['tomas', isoDay(24), false],
      8: ['sam', isoDay(29), true],
    };
    for (const [n, [who, due, shared]] of Object.entries(assign)) {
      const id = taskIds[`HPC-${n}`]!;
      await updateTask(as('priya'), { taskId: id, version: await taskVersion(id), assigneeId: ids[who], dueDate: due, sharedWithClient: shared, statusId: statusIds.HPC!.unstarted });
    }
    await addProjectMembers(as('priya'), { projectId: proj.id, userIds: [ids.maya], role: 'viewer' });
    await setFavorite(as('leo'), { entityType: 'project', entityId: proj.id, favorite: true });
    await setFavorite(as('priya'), { entityType: 'project', entityId: proj.id, favorite: true });
  });

  clock.at(39, 15, async () => {
    const brief = await createDocument(as('priya'), { title: 'Project brief', projectId: projects.HPC, template: 'brief' });
    docs.brief = brief.id;
    await saveDocument(as('priya'), {
      documentId: brief.id,
      baseVersion: brief.version,
      content: doc(
        h(2, 'Background'),
        p('Harbor & Pine runs three cafés and opens a fourth in the spring. The current site is a single page with an out-of-date menu, and most questions arrive by phone.'),
        h(2, 'Goals'),
        ul(['Make menus and opening hours easy to keep current without us', 'Let customers order ahead for pickup', 'Give each café its own page with directions']),
        h(2, 'Out of scope'),
        ul(['Delivery and payments beyond the existing ordering provider', 'Loyalty programme (phase two)']),
        h(2, 'Success measures'),
        p('Fewer phone calls about hours and menus, measured by the café team for four weeks after launch.'),
      ),
    });
    await setDocumentShared(as('priya'), { documentId: brief.id, shared: true });
  });

  clock.at(37, 11, move('priya', 'HPC', 'HPC-1', 'started'));
  clock.at(36, 17, async () => {
    await move('priya', 'HPC', 'HPC-1', 'completed')();
    const notes = await createDocument(as('nadia'), { title: 'Kickoff call notes', projectId: projects.HPC, template: 'meeting_notes' });
    docs.kickoff = notes.id;
    await saveDocument(as('nadia'), {
      documentId: notes.id,
      baseVersion: notes.version,
      content: doc(
        h(2, 'Attendees'),
        p('Hannah Cole, Marcus Lee, Priya Shah, Leo Martins, Nadia Petrova'),
        h(2, 'Decisions'),
        ul(['Online ordering stays with their current provider; we link to it.', 'Each café gets its own page.', 'Marcus is the day-to-day contact for content.']),
        h(2, 'Action items'),
        todo([['Send brand assets and photography (Marcus)', true], ['Share content inventory template (Nadia)', true], ['Book design review for week 4 (Priya)', false]]),
      ),
    });
    await setDocumentShared(as('priya'), { documentId: notes.id, shared: true });
  });
  clock.at(34, 10, move('nadia', 'HPC', 'HPC-2', 'started'));
  clock.at(29, 15, move('nadia', 'HPC', 'HPC-2', 'completed'));
  clock.at(28, 10, move('nadia', 'HPC', 'HPC-3', 'started'));
  clock.at(26, 12, async () => {
    const dec = await createDocument(as('sam'), { title: 'Decision: content management approach', projectId: projects.HPC, template: 'decision' });
    docs.cms = dec.id;
    await saveDocument(as('sam'), {
      documentId: dec.id,
      baseVersion: dec.version,
      content: doc(
        h(2, 'Context'),
        p('The café team needs to change menus and hours weekly without calling us.'),
        h(2, 'Options considered'),
        ul(['Hosted site builder: fastest to edit, limited control over performance.', 'Headless CMS with a static front end: more setup, fast pages, structured menus.']),
        h(2, 'Decision'),
        p('Headless CMS with structured menu and location types. Editing is limited to the fields the café team needs.'),
        h(2, 'Consequences'),
        p('We own hosting and updates under a care plan after launch.'),
      ),
    });
  });
  clock.at(23, 16, move('nadia', 'HPC', 'HPC-3', 'review'));
  clock.at(22, 11, move('nadia', 'HPC', 'HPC-3', 'completed'));
  clock.at(22, 12, async () => {
    const hpcMilestones = await withTenant(org.id, (tx) => tx.execute<{ id: string; name: string; due_date: string | null }>(sql`select id, name, due_date::text from milestones where project_id = ${projects.HPC} order by due_date`));
    const [discovery, design] = hpcMilestones.rows;
    if (discovery) await saveMilestone(as('priya'), { projectId: projects.HPC, milestoneId: discovery.id, name: discovery.name, dueDate: isoDay(-24), status: 'done', sharedWithClient: true });
    if (design) await saveMilestone(as('priya'), { projectId: projects.HPC, milestoneId: design.id, name: design.name, dueDate: isoDay(3), status: 'in_progress', sharedWithClient: true });
  });

  // Request 1: opening hours, converted to a task and completed.
  clock.at(20, 9, async () => {
    const formId = await defaultFormId();
    const r = await submitRequest(as('hannah'), { formId, title: 'Update opening hours on the contact page', details: 'The Quay Street café now opens at 7:00 on weekdays, not 7:30. Could you update the current site before the new one launches?', answers: { type: 'Change to existing work' }, projectId: projects.HPC });
    requestIds[1] = r.id;
  });
  clock.at(19, 11, async () => {
    await triageRequest(as('priya'), { requestId: requestIds[1]!, version: await requestVersion(requestIds[1]!), status: 'accepted', priority: 'medium', ownerId: ids.priya });
    const { task } = await convertRequestToTask(as('priya'), { requestId: requestIds[1]!, projectId: projects.HPC, assigneeId: ids.sam, dueDate: isoDay(-17) });
    taskIds.hours = task.id;
    await createComment(as('priya'), { parent: { type: 'request', id: requestIds[1]! }, visibility: 'client', body: plainToRichText('Thanks Hannah, Sam will update the current site this week. We will reply here when it is live.') });
  });
  clock.at(17, 10, move('sam', 'HPC', 'hours', 'started'));
  clock.at(16, 14, move('sam', 'HPC', 'hours', 'completed'));
  clock.at(16, 15, async () => {
    await createComment(as('sam'), { parent: { type: 'request', id: requestIds[1]! }, visibility: 'client', body: plainToRichText('Done: Quay Street now shows 7:00 on weekdays.') });
  });
  clock.at(16, 18, async () => {
    const c = await createComment(as('hannah'), { parent: { type: 'request', id: requestIds[1]! }, visibility: 'client', body: plainToRichText('Perfect, thank you!') });
    await toggleReaction(as('sam'), { commentId: c.id, emoji: '❤️' });
  });

  // Design concepts, round one.
  clock.at(21, 10, move('leo', 'HPC', 'HPC-4', 'started'));
  clock.at(18, 15, async () => {
    await createComment(as('sam'), {
      parent: { type: 'task', id: taskIds['HPC-4']! },
      visibility: 'internal',
      body: withMention('', ids.leo, 'Leo Martins', ' can we keep the hero image area flexible? The café photos come in very different crops.'),
    });
  });
  clock.at(18, 17, async () => {
    await createComment(as('leo'), { parent: { type: 'task', id: taskIds['HPC-4']! }, visibility: 'internal', body: plainToRichText('Yes, I am designing it around a 3:2 focal crop with a fallback colour block.') });
  });
  clock.at(14, 16, async () => {
    const img = await conceptImage({ title: 'Harbor & Pine', subtitle: 'Coffee roasted by the water. Three cafés, one harbour.', bg: '#F4EDE4', ink: '#2B2118', accent: '#3E6B5A', variant: 1 });
    const { file } = await uploadFile(as('leo'), { projectId: projects.HPC, taskId: taskIds['HPC-4'], kind: 'deliverable', name: 'Homepage concept', description: 'Homepage direction for review: navigation, hero, café cards.', sharedWithClient: true }, { buffer: img, originalName: 'homepage-concept-v1.png' });
    fileIds.homepage = file.id;
    await updateFile(as('priya'), { fileId: file.id, sharedWithClient: true });
    await move('leo', 'HPC', 'HPC-4', 'review')();
  });
  clock.at(13, 10, async () => {
    const a = await createApproval(as('priya'), { projectId: projects.HPC, title: 'Homepage concept', instructions: 'Please review the overall direction: layout, tone and photography. Detailed copy comes next.', fileId: fileIds.homepage, reviewerIds: [ids.hannah, ids.marcus], rule: 'all', dueDate: isoDay(-10) });
    approvalIds.homepage1 = a.id;
  });
  clock.at(12, 9, async () => {
    await decideApproval(as('marcus'), { approvalId: approvalIds.homepage1!, decision: 'approved', comment: 'Love the café cards, very easy to scan.' });
  });
  clock.at(11, 14, async () => {
    await decideApproval(as('hannah'), { approvalId: approvalIds.homepage1!, decision: 'changes_requested', comment: 'The green feels cold for us. Could we try something warmer, and make the hero photo larger?' });
    await createComment(as('hannah'), { parent: { type: 'approval', id: approvalIds.homepage1! }, visibility: 'client', body: plainToRichText('Happy with the structure though, the café cards are exactly what we wanted.') });
  });
  clock.at(11, 16, move('leo', 'HPC', 'HPC-4', 'started'));
  clock.at(10, 10, move('leo', 'HPC', 'HPC-5', 'started'));
  clock.at(5, 15, async () => {
    const img = await conceptImage({ title: 'Harbor & Pine', subtitle: 'Coffee roasted by the water. Three cafés, one harbour.', bg: '#FBF3E8', ink: '#2B2118', accent: '#C0703A', variant: 2 });
    await uploadFileVersion(as('leo'), { fileId: fileIds.homepage, note: 'Warmer palette and a larger hero image, per Hannah’s feedback.' }, { buffer: img, originalName: 'homepage-concept-v2.png' });
    await move('leo', 'HPC', 'HPC-4', 'review')();
  });
  clock.at(4, 11, async () => {
    const [round2] = (await withTenant(org.id, (tx) => tx.execute<{ id: string }>(sql`select id from approvals where file_id = ${fileIds.homepage} and status = 'pending' order by round desc limit 1`))).rows;
    if (round2) {
      approvalIds.homepage2 = round2.id;
      await withTenant(org.id, (tx) => tx.execute(sql`update approvals set due_date = ${isoDay(2)} where id = ${round2.id}`));
      await decideApproval(as('marcus'), { approvalId: round2.id, decision: 'approved', comment: 'Much warmer. Approved from my side.' });
    }
  });

  // Request 2: seasonal menu PDF, under review.
  clock.at(9, 13, async () => {
    const formId = await defaultFormId();
    const r = await submitRequest(as('marcus'), { formId, title: 'Add the autumn menu as a downloadable PDF', details: 'We print a seasonal menu each quarter. Can customers download it from the menu page? Attached is this season’s version.', answers: { type: 'Something new', deadline: isoDay(12) }, projectId: projects.HPC });
    requestIds[2] = r.id;
    await uploadFile(as('marcus'), { requestId: r.id, name: 'Autumn menu', sharedWithClient: true }, { buffer: simplePdf('Harbor & Pine - Autumn menu', ['Espresso drinks', 'Filter of the week', 'Pumpkin & sage scone', 'Toasted sourdough, three ways']), originalName: 'autumn-menu.pdf' });
  });
  clock.at(8, 10, async () => {
    await triageRequest(as('priya'), { requestId: requestIds[2]!, version: await requestVersion(requestIds[2]!), status: 'in_review', ownerId: ids.priya, priority: 'medium' });
    await createComment(as('priya'), { parent: { type: 'request', id: requestIds[2]! }, visibility: 'client', body: plainToRichText('Good idea. We will add a menu download that the café team can replace each season from the CMS. Confirming the timing with Sam.') });
    await createComment(as('priya'), { parent: { type: 'request', id: requestIds[2]! }, visibility: 'internal', body: withMention('', ids.sam, 'Sam Ito', ' this fits the menu content type. Can we add a file field before build starts?') });
  });

  // Request 3: needs more information.
  clock.at(3, 18, async () => {
    const formId = await defaultFormId();
    const r = await submitRequest(as('hannah'), { formId, title: 'Photo on the About page looks stretched on my phone', details: 'The team photo looks squashed on mobile.', answers: { type: 'Problem or bug', link: 'https://harborpine.example/about' }, projectId: projects.HPC });
    requestIds[3] = r.id;
  });
  clock.at(2, 10, async () => {
    await triageRequest(as('priya'), { requestId: requestIds[3]!, version: await requestVersion(requestIds[3]!), status: 'needs_info', ownerId: ids.tomas });
    await createComment(as('tomas'), { parent: { type: 'request', id: requestIds[3]! }, visibility: 'client', body: plainToRichText('Thanks Hannah. Which phone and browser are you using? A screenshot would help us reproduce it.') });
  });

  // Request 4: duplicate of request 1.
  clock.at(6, 9, async () => {
    const formId = await defaultFormId();
    const r = await submitRequest(as('marcus'), { formId, title: 'Opening hours for Quay Street are wrong', details: 'Weekday opening is 7:00.', answers: { type: 'Change to existing work' }, projectId: projects.HPC });
    requestIds[4] = r.id;
  });
  clock.at(6, 11, async () => {
    await markDuplicate(as('priya'), { requestId: requestIds[4]!, duplicateOfNumber: 1 });
  });

  clock.at(7, 16, async () => {
    await postProjectUpdate(as('priya'), { projectId: projects.HPC, health: 'on_track', summary: 'Design round two is with Hannah and Marcus', body: doc(p('Discovery is complete and the sitemap is signed off. The second homepage concept addresses the colour feedback. Build starts once the concept is approved.')), sharedWithClient: true });
  });

  // ——— Lumen Health brand refresh ———
  clock.at(30, 10, async () => {
    const proj = await createProject(as('maya'), {
      name: 'Lumen Health brand refresh',
      key: 'LUM',
      templateId: 'brand-identity',
      clientAccountId: clients.lumen,
      startDate: isoDay(-30),
      dueDate: isoDay(12),
      memberIds: [ids.leo, ids.nadia],
      description: 'Refreshing the Lumen Health identity ahead of three new clinics: logo, colour, type and guidelines.',
    });
    projects.LUM = proj.id;
    await loadStatuses('LUM');
    await setPortalEnabled(as('maya'), { projectId: proj.id, enabled: true });
    for (let n = 1; n <= 4; n++) taskIds[`LUM-${n}`] = await templateTaskId('LUM', n);
    const assign: Record<number, [PersonaKey, string, boolean]> = { 1: ['nadia', isoDay(-24), true], 2: ['nadia', isoDay(-20), false], 3: ['leo', isoDay(-15), true], 4: ['nadia', isoDay(-1), true] };
    for (const [n, [who, due, shared]] of Object.entries(assign)) {
      const id = taskIds[`LUM-${n}`]!;
      await updateTask(as('maya'), { taskId: id, version: await taskVersion(id), assigneeId: ids[who], dueDate: due, sharedWithClient: shared, statusId: statusIds.LUM!.unstarted });
    }
  });
  clock.at(29, 10, move('nadia', 'LUM', 'LUM-1', 'started'));
  clock.at(24, 16, move('nadia', 'LUM', 'LUM-1', 'completed'));
  clock.at(26, 10, move('nadia', 'LUM', 'LUM-2', 'started'));
  clock.at(21, 12, async () => {
    await move('nadia', 'LUM', 'LUM-2', 'completed')();
    const readout = await createDocument(as('nadia'), { title: 'Research readout', projectId: projects.LUM, template: 'blank' });
    docs.readout = readout.id;
    await saveDocument(as('nadia'), {
      documentId: readout.id,
      baseVersion: readout.version,
      content: doc(
        h(2, 'What we heard'),
        ul(['Patients describe Lumen as “kind but clinical”.', 'Staff want materials that work in black and white for printed letters.', 'Competitors lean on blue; warmth is an opening.']),
        h(2, 'Implications for the identity'),
        p('Keep the trust of a medical brand, add warmth through colour and a friendlier typeface, and make sure the mark survives single-colour print.'),
      ),
    });
    await setDocumentShared(as('maya'), { documentId: readout.id, shared: true });
  });
  clock.at(20, 10, move('leo', 'LUM', 'LUM-3', 'started'));
  clock.at(16, 15, async () => {
    const sheet = await logoSheet({ name: 'Lumen', colors: ['#E07A5F', '#3D7068', '#F2B134'] });
    const { file } = await uploadFile(as('leo'), { projectId: projects.LUM, taskId: taskIds['LUM-3'], kind: 'deliverable', name: 'Logo directions', description: 'Three directions for the Lumen mark.', sharedWithClient: true }, { buffer: sheet, originalName: 'lumen-logo-directions.png' });
    fileIds.logos = file.id;
    await updateFile(as('maya'), { fileId: file.id, sharedWithClient: true });
    await move('leo', 'LUM', 'LUM-3', 'review')();
    const a = await createApproval(as('maya'), { projectId: projects.LUM, title: 'Logo direction', instructions: 'Pick the direction to develop. Any one of you can sign off.', fileId: file.id, reviewerIds: [ids.ruth], rule: 'any', dueDate: isoDay(-13) });
    approvalIds.logos = a.id;
  });
  clock.at(14, 11, async () => {
    await decideApproval(as('ruth'), { approvalId: approvalIds.logos!, decision: 'approved', comment: 'The warm coral direction (first one) is our favourite. Let’s develop that.' });
    await move('leo', 'LUM', 'LUM-3', 'completed')();
  });
  clock.at(12, 10, move('nadia', 'LUM', 'LUM-4', 'started'));
  clock.at(6, 14, async () => {
    const draft = await createDocument(as('nadia'), { title: 'Brand guidelines (draft)', projectId: projects.LUM, template: 'blank' });
    docs.guidelines = draft.id;
    await saveDocument(as('nadia'), {
      documentId: draft.id,
      baseVersion: draft.version,
      content: doc(
        h(2, 'Logo'),
        p('Use the coral mark on light backgrounds and the single-colour version for print letters. Keep clear space equal to the height of the dot.'),
        h(2, 'Colour'),
        ul(['Coral: primary accent', 'Deep teal: text and UI', 'Sunlight: highlights only, never for text']),
        h(2, 'Still to come'),
        todo([['Photography direction', false], ['Signage examples for the new clinics', false]]),
      ),
    });
    const a = await createApproval(as('nadia'), { projectId: projects.LUM, title: 'Guidelines draft: internal check', instructions: 'Quick internal review before we share with Ruth.', documentId: draft.id, reviewerIds: [ids.leo, ids.maya], rule: 'any', dueDate: isoDay(-1) });
    approvalIds.guidelines = a.id;
  });
  clock.at(4, 17, async () => {
    await postProjectUpdate(as('maya'), { projectId: projects.LUM, health: 'at_risk', summary: 'Guidelines are slipping while we wait for photography', body: doc(p('The logo direction is approved. The guidelines need the clinic photography, which has moved to next week, so the delivery date is at risk by a few days.')), sharedWithClient: false });
  });
  clock.at(1, 15, async () => {
    const formId = await defaultFormId();
    const r = await submitRequest(as('ruth'), { formId, title: 'Logo files for a print run', details: 'Our printer needs the new logo as vector files (and a single-colour version) for appointment cards.', answers: { type: 'Something new', deadline: isoDay(10) }, projectId: projects.LUM });
    requestIds[5] = r.id;
  });

  // ——— Ongoing internal bits ———
  clock.at(15, 10, async () => {
    const t = await createTask(as('priya'), { projectId: projects.HPC, title: 'Café pages: gather photos and directions', assigneeId: ids.nadia, dueDate: isoDay(-2), priority: 'medium', statusId: statusIds.HPC!.started, sharedWithClient: true });
    taskIds.cafes = t.id;
    for (const item of ['Quay Street', 'Old Market', 'Harbourside', 'Fourth café (opening spring)']) await saveChecklistItem(as('nadia'), { taskId: t.id, text: item });
  });
  clock.at(9, 9, async () => {
    const t = await createTask(as('sam'), { projectId: projects.HPC, title: 'Set up CMS content types for menus and locations', assigneeId: ids.sam, dueDate: isoDay(6), priority: 'high', statusId: statusIds.HPC!.started });
    taskIds.cms = t.id;
  });
  clock.at(5, 10, async () => {
    const t = await createTask(as('priya'), { projectId: projects.HPC, title: 'Menu PDF download on the menu page', assigneeId: ids.sam, dueDate: isoDay(9), priority: 'medium', statusId: statusIds.HPC!.backlog });
    taskIds.menuPdf = t.id;
  });
  clock.at(2, 16, async () => {
    await createTask(as('leo'), { projectId: projects.HPC, title: 'Prepare hero photography crops', assigneeId: ids.leo, dueDate: isoDay(1), priority: 'high', statusId: statusIds.HPC!.unstarted });
    await createTask(as('priya'), { projectId: projects.HPC, title: 'Fix spacing on café cards at tablet width', assigneeId: ids.leo, dueDate: isoDay(-1), priority: 'medium', statusId: statusIds.HPC!.unstarted, labelIds: await labelId('Client feedback') });
  });
  clock.at(1, 11, async () => {
    await saveView(as('priya'), { projectId: null, name: 'Urgent and overdue', layout: 'list', query: { due: 'overdue' }, shared: true }).catch(() => {});
    await postProjectUpdate(as('priya'), { projectId: projects.ATL, health: 'on_track', summary: '12 of 14 requests done this cycle', body: doc(p('Rental landing page is in progress; SSL alert renewal is queued. 15 of 20 retainer hours used.')), sharedWithClient: true });
  });

  await clock.run();
  await rewriteTimestamps(org.id, clock.checkpoints);
  log(`seeded ${org.slug} with ${Object.keys(projects).length} projects`);
  return { orgId: org.id, slug: org.slug, users: ids };

  async function defaultFormId() {
    const rows = await withTenant(org.id, (tx) => tx.execute<{ id: string }>(sql`select id from request_forms where org_id = ${org.id} order by created_at limit 1`));
    return rows.rows[0]!.id;
  }
}

/**
 * Moves every timestamp the seed wrote onto the story timeline: a value written in real time
 * r after checkpoint (r_i → v_i) becomes v_i + (r − r_i). Order within a step is preserved.
 */
async function rewriteTimestamps(orgId: string, checkpoints: { real: Date; virt: Date }[]) {
  if (!checkpoints.length) return;
  const start = checkpoints[0]!.real;
  const end = new Date();
  await withSystem(async (tx) => {
    await tx.execute(sql`create temp table seed_clock (real timestamptz primary key, virt timestamptz not null) on commit drop`);
    for (const c of checkpoints) await tx.execute(sql`insert into seed_clock values (${c.real.toISOString()}, ${c.virt.toISOString()}) on conflict do nothing`);
    const cols = await tx.execute<{ table_name: string; column_name: string }>(sql`
      select c.table_name, c.column_name from information_schema.columns c
      join information_schema.tables t on t.table_name = c.table_name and t.table_schema = c.table_schema and t.table_type = 'BASE TABLE'
      where c.table_schema = 'public' and c.data_type = 'timestamp with time zone' and c.table_name not in ('sessions', 'rate_limits', 'email_tokens', '__drizzle_migrations')`);
    for (const { table_name, column_name } of cols.rows) {
      const t = sql.identifier(table_name);
      const c = sql.identifier(column_name);
      await tx.execute(sql`
        update ${t} set ${c} = (select s.virt + (${t}.${c} - s.real) from seed_clock s where s.real <= ${t}.${c} order by s.real desc limit 1)
        where ${c} >= ${start.toISOString()}::timestamptz and ${c} <= ${end.toISOString()}::timestamptz`);
    }
    // Story emails were never meant to be sent, and anything older than a few days is read.
    await tx.update(outbox).set({ processedAt: new Date() }).where(and(eq(outbox.orgId, orgId)));
    await tx.execute(sql`update outbox set processed_at = now() where org_id is null and processed_at is null and payload->>'to' like '%.example'`);
    await tx.update(notifications).set({ readAt: sql`created_at + interval '2 hours'` }).where(and(eq(notifications.orgId, orgId), sql`${notifications.createdAt} < now() - interval '3 days'`));
    await tx.execute(sql`update users set created_at = now() - interval '63 days', updated_at = now() - interval '1 day' where is_demo`);
    await tx.update(clientAccounts).set({ updatedAt: sql`created_at` }).where(eq(clientAccounts.orgId, orgId));
  });
}
