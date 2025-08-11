/**
 * The permission model, as pure functions with no database access. The same functions
 * decide what the server allows and which controls the interface shows, so the UI can
 * never offer an action the server would refuse (and vice versa).
 *
 * Every rule here is covered by the matrix test in test/permissions.test.ts.
 */

export type OrgRole = 'owner' | 'admin' | 'member' | 'client';
export type ProjectRole = 'manager' | 'contributor' | 'viewer';
/** Effective role on a project after combining org role, project membership and visibility. */
export type EffectiveProjectRole = ProjectRole | 'client';
export type ProjectVisibility = 'private' | 'team' | 'org';

export interface Actor {
  userId: string;
  orgId: string;
  orgSlug: string;
  role: OrgRole;
  /** Only for client contacts: the client account they belong to. */
  clientAccountId: string | null;
}

// ---------------------------------------------------------------------------
// Organization-level actions
// ---------------------------------------------------------------------------

export const ORG_ACTIONS = [
  'org.view',
  'org.update',
  'org.delete',
  'org.transferOwnership',
  'members.view',
  'members.invite',
  'members.manage',
  'members.manageAdmins',
  'teams.manage',
  'clients.view',
  'clients.manage',
  'forms.manage',
  'labels.manage',
  'audit.view',
  'org.export',
  'projects.create',
  'projects.browse',
  'documents.browse',
  'requests.triage',
  'reports.view',
  'search.internal',
] as const;
export type OrgAction = (typeof ORG_ACTIONS)[number];

const ORG_MATRIX: Record<OrgAction, readonly OrgRole[]> = {
  'org.view': ['owner', 'admin', 'member', 'client'],
  'org.update': ['owner', 'admin'],
  'org.delete': ['owner'],
  'org.transferOwnership': ['owner'],
  'members.view': ['owner', 'admin', 'member'],
  'members.invite': ['owner', 'admin'],
  'members.manage': ['owner', 'admin'],
  /** Only the owner can promote to, demote from, or remove an admin. */
  'members.manageAdmins': ['owner'],
  'teams.manage': ['owner', 'admin'],
  'clients.view': ['owner', 'admin', 'member'],
  'clients.manage': ['owner', 'admin'],
  'forms.manage': ['owner', 'admin'],
  'labels.manage': ['owner', 'admin'],
  'audit.view': ['owner', 'admin'],
  'org.export': ['owner'],
  'projects.create': ['owner', 'admin', 'member'],
  'projects.browse': ['owner', 'admin', 'member'],
  'documents.browse': ['owner', 'admin', 'member'],
  'requests.triage': ['owner', 'admin', 'member'],
  'reports.view': ['owner', 'admin', 'member'],
  'search.internal': ['owner', 'admin', 'member'],
};

export function canOrg(role: OrgRole, action: OrgAction): boolean {
  return ORG_MATRIX[action].includes(role);
}

// ---------------------------------------------------------------------------
// Project-level actions
// ---------------------------------------------------------------------------

export const PROJECT_ACTIONS = [
  'project.view',
  'project.update',
  'project.archive',
  'project.delete',
  'project.manageMembers',
  'project.postUpdate',
  'project.shareWithClient',
  'project.viewInternal',
  'milestone.manage',
  'task.create',
  'task.update',
  'task.delete',
  'comment.internal',
  'comment.client',
  'document.create',
  'document.update',
  'document.delete',
  'file.upload',
  'file.delete',
  'approval.create',
  'approval.cancel',
  'request.create',
  'request.triage',
] as const;
export type ProjectAction = (typeof PROJECT_ACTIONS)[number];

const PROJECT_MATRIX: Record<ProjectAction, readonly EffectiveProjectRole[]> = {
  'project.view': ['manager', 'contributor', 'viewer', 'client'],
  'project.update': ['manager'],
  'project.archive': ['manager'],
  /** Deleting is limited further to org owners/admins in canProject below. */
  'project.delete': ['manager'],
  'project.manageMembers': ['manager'],
  'project.postUpdate': ['manager'],
  'project.shareWithClient': ['manager'],
  /** Internal notes, estimates, internal comments and unshared items. */
  'project.viewInternal': ['manager', 'contributor', 'viewer'],
  'milestone.manage': ['manager'],
  'task.create': ['manager', 'contributor'],
  'task.update': ['manager', 'contributor'],
  'task.delete': ['manager'],
  'comment.internal': ['manager', 'contributor', 'viewer'],
  /** Client-visible comments, on items that are shared with the client. */
  'comment.client': ['manager', 'contributor', 'client'],
  'document.create': ['manager', 'contributor'],
  'document.update': ['manager', 'contributor'],
  'document.delete': ['manager'],
  'file.upload': ['manager', 'contributor'],
  'file.delete': ['manager'],
  'approval.create': ['manager', 'contributor'],
  'approval.cancel': ['manager'],
  'request.create': ['manager', 'contributor', 'client'],
  'request.triage': ['manager'],
};

export function canProject(
  role: EffectiveProjectRole | null,
  action: ProjectAction,
  orgRole?: OrgRole,
): boolean {
  if (!role) return false;
  if (action === 'project.delete' && orgRole !== 'owner' && orgRole !== 'admin') return false;
  return PROJECT_MATRIX[action].includes(role);
}

export interface ProjectAccessInput {
  orgRole: OrgRole;
  actorClientAccountId: string | null;
  /** Explicit project membership role, if the user is a project member. */
  projectMemberRole: ProjectRole | null;
  visibility: ProjectVisibility;
  /** Whether the user belongs to the project's team (for team-visible projects). */
  inProjectTeam: boolean;
  projectClientAccountId: string | null;
  portalEnabled: boolean;
}

/**
 * Resolves what a user can do on a project:
 * - Org owners and admins manage every project.
 * - Members get their explicit project role; otherwise read-only access to org-visible
 *   projects and to team-visible projects of their team; private projects are invisible.
 * - Client contacts see a project only when it belongs to their client account and the
 *   portal is enabled for it. Membership rows never grant clients more than "client".
 */
export function effectiveProjectRole(input: ProjectAccessInput): EffectiveProjectRole | null {
  switch (input.orgRole) {
    case 'owner':
    case 'admin':
      return 'manager';
    case 'member':
      if (input.projectMemberRole) return input.projectMemberRole;
      if (input.visibility === 'org') return 'viewer';
      if (input.visibility === 'team' && input.inProjectTeam) return 'viewer';
      return null;
    case 'client':
      if (
        input.portalEnabled &&
        input.actorClientAccountId !== null &&
        input.actorClientAccountId === input.projectClientAccountId
      ) {
        return 'client';
      }
      return null;
  }
}

/**
 * Whether a client contact may see a specific item inside a project they can open.
 * Visibility is decided per resource, never inferred from project access alone.
 */
export function clientCanSeeItem(role: EffectiveProjectRole | null, sharedWithClient: boolean): boolean {
  if (!role) return false;
  if (role !== 'client') return true;
  return sharedWithClient;
}

export const ROLE_LABELS: Record<OrgRole | ProjectRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
  client: 'Client contact',
  manager: 'Manager',
  contributor: 'Contributor',
  viewer: 'Viewer',
};

/** Which org roles an actor may assign when inviting or changing a member. */
export function assignableRoles(actorRole: OrgRole): OrgRole[] {
  if (actorRole === 'owner') return ['admin', 'member', 'client'];
  if (actorRole === 'admin') return ['member', 'client'];
  return [];
}
