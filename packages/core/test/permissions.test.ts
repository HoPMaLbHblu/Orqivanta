import { describe, expect, it } from 'vitest';
import { canOrg, canProject, clientCanSeeItem, effectiveProjectRole, ORG_ACTIONS, PROJECT_ACTIONS, type OrgRole, type ProjectAccessInput } from '../src/permissions';

const base: ProjectAccessInput = {
  orgRole: 'member',
  actorClientAccountId: null,
  projectMemberRole: null,
  visibility: 'org',
  inProjectTeam: false,
  projectClientAccountId: 'client-a',
  portalEnabled: true,
};

describe('organization matrix', () => {
  it('gives clients nothing beyond viewing the organization', () => {
    const allowed = ORG_ACTIONS.filter((a) => canOrg('client', a));
    expect(allowed).toEqual(['org.view']);
  });

  it('reserves destructive and ownership actions for the owner', () => {
    for (const action of ['org.delete', 'org.transferOwnership', 'members.manageAdmins', 'org.export'] as const) {
      expect((['owner', 'admin', 'member', 'client'] as OrgRole[]).filter((r) => canOrg(r, action))).toEqual(['owner']);
    }
  });

  it('never lets a lower role do something a higher role cannot', () => {
    const order: OrgRole[] = ['owner', 'admin', 'member', 'client'];
    for (const action of ORG_ACTIONS) {
      for (let i = 1; i < order.length; i++) {
        if (canOrg(order[i]!, action)) expect(canOrg(order[i - 1]!, action), `${order[i - 1]} / ${action}`).toBe(true);
      }
    }
  });
});

describe('effective project role', () => {
  it('makes owners and admins managers everywhere, including private projects', () => {
    expect(effectiveProjectRole({ ...base, orgRole: 'owner', visibility: 'private' })).toBe('manager');
    expect(effectiveProjectRole({ ...base, orgRole: 'admin', visibility: 'private' })).toBe('manager');
  });

  it('uses the explicit membership role for members', () => {
    expect(effectiveProjectRole({ ...base, projectMemberRole: 'contributor', visibility: 'private' })).toBe('contributor');
  });

  it('gives non-member members read access by visibility only', () => {
    expect(effectiveProjectRole({ ...base, visibility: 'org' })).toBe('viewer');
    expect(effectiveProjectRole({ ...base, visibility: 'team', inProjectTeam: true })).toBe('viewer');
    expect(effectiveProjectRole({ ...base, visibility: 'team', inProjectTeam: false })).toBeNull();
    expect(effectiveProjectRole({ ...base, visibility: 'private' })).toBeNull();
  });

  it('lets clients into their own portal projects only', () => {
    const client = { ...base, orgRole: 'client' as const, actorClientAccountId: 'client-a' };
    expect(effectiveProjectRole(client)).toBe('client');
    expect(effectiveProjectRole({ ...client, portalEnabled: false })).toBeNull();
    expect(effectiveProjectRole({ ...client, projectClientAccountId: 'client-b' })).toBeNull();
    expect(effectiveProjectRole({ ...client, projectClientAccountId: null })).toBeNull();
    // A stray membership row never upgrades a client.
    expect(effectiveProjectRole({ ...client, projectMemberRole: 'manager' })).toBe('client');
  });
});

describe('project matrix', () => {
  it('denies everything without a role', () => {
    for (const action of PROJECT_ACTIONS) expect(canProject(null, action)).toBe(false);
  });

  it('keeps internal content away from clients', () => {
    for (const action of ['project.viewInternal', 'comment.internal', 'task.create', 'file.upload', 'document.update', 'approval.create'] as const) {
      expect(canProject('client', action)).toBe(false);
    }
    expect(canProject('client', 'comment.client')).toBe(true);
    expect(canProject('client', 'request.create')).toBe(true);
  });

  it('lets viewers read but not change work', () => {
    expect(canProject('viewer', 'project.view')).toBe(true);
    expect(canProject('viewer', 'task.update')).toBe(false);
    expect(canProject('viewer', 'comment.client')).toBe(false);
  });

  it('only allows managers who are org owners or admins to delete projects', () => {
    expect(canProject('manager', 'project.delete', 'admin')).toBe(true);
    expect(canProject('manager', 'project.delete', 'member')).toBe(false);
    expect(canProject('contributor', 'project.delete', 'owner')).toBe(false);
  });

  it('only lets managers share with the client', () => {
    expect(PROJECT_ACTIONS.filter(() => true).length).toBeGreaterThan(0);
    expect((['manager', 'contributor', 'viewer', 'client'] as const).filter((r) => canProject(r, 'project.shareWithClient'))).toEqual(['manager']);
  });
});

describe('client item visibility', () => {
  it('hides unshared items from clients and shows everything to the team', () => {
    expect(clientCanSeeItem('client', false)).toBe(false);
    expect(clientCanSeeItem('client', true)).toBe(true);
    expect(clientCanSeeItem('viewer', false)).toBe(true);
    expect(clientCanSeeItem(null, true)).toBe(false);
  });
});
