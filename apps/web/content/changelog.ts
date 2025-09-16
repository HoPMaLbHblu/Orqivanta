/**
 * Release notes shown on /changelog, newest first. Each entry describes what actually
 * landed in the product; nothing here is a plan or a promise. Dates are ISO (YYYY-MM-DD).
 */
export type ChangeTag = 'new' | 'improved' | 'fixed';

export interface ChangelogEntry {
  version: string;
  date: string;
  title: string;
  summary: string;
  changes: { tag: ChangeTag; text: string }[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '1.0.0',
    date: '2025-10-05',
    title: 'Release 1',
    summary:
      'The first complete release: the whole loop from sign-up to client sign-off works end to end, in English and Russian, on desktop and phone.',
    changes: [
      { tag: 'new', text: 'Contact form on the public site, saved to the database, with rate limits and a spam trap.' },
      { tag: 'new', text: 'Accessibility statement listing the WCAG 2.2 AA target, how pages are checked and the known limitations.' },
      { tag: 'improved', text: 'Error pages: a 404 that never reveals whether a workspace exists, and a 500 page with a retry button and a reference code.' },
      { tag: 'improved', text: 'Every public page now has its own description, social preview image and a place in the sitemap. Workspace and portal addresses are kept out of search engines.' },
    ],
  },
  {
    version: '0.9.0',
    date: '2025-10-01',
    title: 'Public site, Russian and the sample studio',
    summary:
      'Orqivanta can now introduce itself. The public site explains the product, and anyone can explore a fictional studio without signing up.',
    changes: [
      { tag: 'new', text: 'Public site: product, client portal, for agencies, pricing, changelog, about, privacy and terms.' },
      { tag: 'new', text: 'Sample studio “Northwind Studio” with six weeks of fictional projects, requests and approvals. Explore it as a producer, a designer or a client.' },
      { tag: 'new', text: 'Russian translation. Each person chooses their language; anything not yet translated falls back to English instead of showing raw keys.' },
      { tag: 'new', text: 'Audit log of administrative and security changes, filterable by action.' },
      { tag: 'new', text: 'Full data export for owners and admins, prepared in the background and downloadable when ready.' },
    ],
  },
  {
    version: '0.8.0',
    date: '2025-09-25',
    title: 'Inbox, search and reports',
    summary: 'Find anything, hear about what matters, and see how delivery is going — all within your permissions.',
    changes: [
      { tag: 'new', text: 'Inbox with read state for mentions, assignments, review requests and client activity.' },
      { tag: 'new', text: 'Email notifications, sent only after a change is saved, with per-category preferences.' },
      { tag: 'new', text: 'Search across projects, tasks, documents, requests and clients, using PostgreSQL full-text and fuzzy matching. ⌘K opens it from anywhere.' },
      { tag: 'new', text: 'Reports: project progress, overdue work, throughput, cycle time, request response time and approval turnaround. Each has a table view, a written definition and CSV export.' },
      { tag: 'improved', text: 'Search results, counts and previews apply the same permission checks as the pages they link to.' },
    ],
  },
  {
    version: '0.7.0',
    date: '2025-09-18',
    title: 'Approvals and deliverables',
    summary: 'Ask for sign-off on the exact thing you made, and keep a record that holds up later.',
    changes: [
      { tag: 'new', text: 'Approvals on a file version, a document version or a milestone, with reviewers, a due date and an “any” or “all” rule.' },
      { tag: 'new', text: 'Approve, request changes or reject, always with the reviewed version attached to the decision.' },
      { tag: 'new', text: 'Uploading a new version reopens review as the next round, with earlier rounds kept in the history.' },
      { tag: 'new', text: 'Reminders to reviewers before an approval is due, sent by a background job.' },
      { tag: 'fixed', text: 'Deleting a client, milestone or collection no longer fails when other items point to it. The link is cleared and the items are kept.' },
    ],
  },
  {
    version: '0.6.0',
    date: '2025-09-10',
    title: 'Clients, requests and the portal',
    summary: 'Clients get their own front door, and their requests become planned work without retyping.',
    changes: [
      { tag: 'new', text: 'Client accounts with invited contacts. Contacts sign in to a focused portal and never see the internal workspace.' },
      { tag: 'new', text: 'Portal home, requests, deliverables, shared updates and approvals.' },
      { tag: 'new', text: 'Items are internal by default and shared with a client one at a time. “View as client” shows exactly what they’ll see.' },
      { tag: 'new', text: 'Intake forms with typed fields, a triage inbox, clarification threads, duplicate linking and closure reasons.' },
      { tag: 'new', text: 'Convert a request into a task or a project. The original request stays linked, with its answers.' },
    ],
  },
  {
    version: '0.5.0',
    date: '2025-08-30',
    title: 'Documents and files',
    summary: 'Write and upload with confidence: nothing is silently overwritten and nothing is publicly exposed.',
    changes: [
      { tag: 'new', text: 'Rich-text documents with headings, lists, checklists, tables, code and links, organised in collections.' },
      { tag: 'new', text: 'Autosave with numbered versions, version history and one-click restore.' },
      { tag: 'new', text: 'A conflict dialog when someone else saved first, so neither person loses their changes.' },
      { tag: 'new', text: 'File uploads with progress, retry and cancel; file versions; image and PDF previews.' },
      { tag: 'improved', text: 'Files are checked by their actual content, not their extension, and kept in private storage. Every download is permission-checked.' },
      { tag: 'improved', text: 'Per-organization storage quota, with a clear message before an upload would exceed it.' },
    ],
  },
  {
    version: '0.4.0',
    date: '2025-08-22',
    title: 'Projects and tasks',
    summary: 'The heart of the workspace: projects people can trust and tasks that are easy to move along.',
    changes: [
      { tag: 'new', text: 'Projects with goals, milestones, members, project roles and health updates. Progress is computed from the tasks.' },
      { tag: 'new', text: 'Starting templates: client website, brand identity and retainer, each with a status workflow.' },
      { tag: 'new', text: 'Task list and board views. Cards can be dragged, or moved with the keyboard.' },
      { tag: 'new', text: 'Task details: subtasks, checklist, labels, priority, due date, assignee, watchers and blocked-by dependencies, with a field history.' },
      { tag: 'new', text: 'Comments with @mentions, reactions and edit indicators.' },
      { tag: 'new', text: 'Live updates over Server-Sent Events. After a dropped connection, missed events are replayed.' },
    ],
  },
  {
    version: '0.3.0',
    date: '2025-08-14',
    title: 'Accounts and organizations',
    summary: 'Sign up, create an organization and bring your team in — securely.',
    changes: [
      { tag: 'new', text: 'Registration with email verification, sign-in, sign-out and password reset.' },
      { tag: 'new', text: 'Session list with the device and last activity, and the option to sign out anywhere.' },
      { tag: 'new', text: 'Organizations with their own address. Invitations carry a role, expire after seven days and can be revoked.' },
      { tag: 'new', text: 'Onboarding: organization, starting template, teammates and first project, resumable at any step.' },
      { tag: 'improved', text: 'Sign-in, sign-up and password reset respond the same way whether or not an account exists, and are rate limited.' },
    ],
  },
  {
    version: '0.2.0',
    date: '2025-08-09',
    title: 'Permissions and tenancy',
    summary: 'The rules every later feature relies on.',
    changes: [
      { tag: 'new', text: 'One permission function for every action, covering organization, project and client roles.' },
      { tag: 'new', text: 'Row-level security in PostgreSQL on every tenant table, as a second line behind the permission checks.' },
      { tag: 'new', text: 'Transactional outbox, so emails and notifications go out only after a change is committed.' },
    ],
  },
  {
    version: '0.1.0',
    date: '2025-08-05',
    title: 'Foundations',
    summary: 'A workspace that builds, tests and runs locally with one command.',
    changes: [
      { tag: 'new', text: 'Quiet Studio design tokens for light and dark themes: warm paper neutrals, one verdigris accent, amber for attention.' },
      { tag: 'new', text: 'Component library on Radix primitives: buttons, inputs, selects, dialogs, menus, tooltips, toasts and skeletons.' },
      { tag: 'new', text: 'Database schema and migrations with an organization id on every tenant table.' },
      { tag: 'new', text: 'Local setup with Docker Compose, including a development inbox for email.' },
    ],
  },
];

export const LATEST_CHANGE_DATE = CHANGELOG[0]!.date;
