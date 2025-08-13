/**
 * Starting templates for organizations and projects. Applied in the same transaction
 * that creates the project, so a project never exists without its workflow.
 */

export type StatusCategory = 'backlog' | 'unstarted' | 'started' | 'review' | 'completed' | 'canceled';

export const DEFAULT_STATUSES: { name: string; category: StatusCategory }[] = [
  { name: 'Backlog', category: 'backlog' },
  { name: 'To do', category: 'unstarted' },
  { name: 'In progress', category: 'started' },
  { name: 'In review', category: 'review' },
  { name: 'Done', category: 'completed' },
  { name: 'Canceled', category: 'canceled' },
];

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  milestones: { name: string; offsetDays: number }[];
  tasks: { title: string; status: StatusCategory; milestone?: number; priority?: 'low' | 'medium' | 'high' }[];
  goals: string[];
}

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: 'blank',
    name: 'Blank project',
    description: 'A standard workflow with no tasks. Start from scratch.',
    milestones: [],
    tasks: [],
    goals: [],
  },
  {
    id: 'client-website',
    name: 'Client website',
    description: 'Discovery, design, build and launch for a client site, with review gates.',
    goals: ['Launch a site the client approves on schedule', 'Keep the client informed every week'],
    milestones: [
      { name: 'Discovery complete', offsetDays: 10 },
      { name: 'Design approved', offsetDays: 28 },
      { name: 'Build complete', offsetDays: 56 },
      { name: 'Launch', offsetDays: 70 },
    ],
    tasks: [
      { title: 'Kickoff call and goals workshop', status: 'unstarted', milestone: 0, priority: 'high' },
      { title: 'Collect brand assets and content inventory', status: 'unstarted', milestone: 0 },
      { title: 'Sitemap and page outlines', status: 'backlog', milestone: 0 },
      { title: 'Homepage design concepts', status: 'backlog', milestone: 1, priority: 'high' },
      { title: 'Design system: type, colour, components', status: 'backlog', milestone: 1 },
      { title: 'Build page templates', status: 'backlog', milestone: 2 },
      { title: 'Accessibility review', status: 'backlog', milestone: 2 },
      { title: 'Launch checklist and DNS handover', status: 'backlog', milestone: 3 },
    ],
  },
  {
    id: 'brand-identity',
    name: 'Brand identity',
    description: 'Research, concepts, refinement and guidelines for a brand.',
    goals: ['Agree a brand direction in two concept rounds'],
    milestones: [
      { name: 'Research readout', offsetDays: 7 },
      { name: 'Concepts presented', offsetDays: 21 },
      { name: 'Guidelines delivered', offsetDays: 42 },
    ],
    tasks: [
      { title: 'Stakeholder interviews', status: 'unstarted', milestone: 0 },
      { title: 'Competitive landscape review', status: 'backlog', milestone: 0 },
      { title: 'Three logo concepts', status: 'backlog', milestone: 1, priority: 'high' },
      { title: 'Brand guidelines document', status: 'backlog', milestone: 2 },
    ],
  },
  {
    id: 'retainer',
    name: 'Ongoing retainer',
    description: 'Continuous support work fed by client requests.',
    goals: ['Respond to every client request within one business day'],
    milestones: [],
    tasks: [{ title: 'Monthly report for the client', status: 'unstarted', priority: 'medium' }],
  },
];

export const ORG_PURPOSES = [
  { id: 'agency', label: 'Agency or studio' },
  { id: 'consultancy', label: 'Consultancy' },
  { id: 'freelance', label: 'Freelance collective' },
  { id: 'inhouse', label: 'In-house team with internal clients' },
  { id: 'other', label: 'Something else' },
] as const;

export const DEFAULT_LABELS = [
  { name: 'Design', color: 'plum' },
  { name: 'Development', color: 'ocean' },
  { name: 'Content', color: 'moss' },
  { name: 'Bug', color: 'rose' },
  { name: 'Client feedback', color: 'amber' },
];

export const DEFAULT_REQUEST_FORM = {
  name: 'General request',
  description: 'Ask for a change, report a problem, or start something new.',
  fields: [
    {
      key: 'type',
      label: 'What kind of request is this?',
      type: 'select' as const,
      required: true,
      options: ['Change to existing work', 'Something new', 'Problem or bug', 'Question'],
    },
    { key: 'deadline', label: 'Is there a date this is needed by?', type: 'date' as const, required: false },
    { key: 'link', label: 'Link to the page or file, if any', type: 'url' as const, required: false },
  ],
};
