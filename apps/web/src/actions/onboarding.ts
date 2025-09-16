'use server';

import { AppError, completeOnboardingStep, createInvitations, createOrganization, createProject } from '@orqivanta/core';
import { run } from '@/lib/action';
import { actorFor, getSession } from '@/lib/session';

export async function createOrganizationAction(input: { name: string; slug: string; purpose?: string }) {
  return run(async () => {
    const s = await getSession();
    if (!s) throw new AppError('UNAUTHENTICATED', 'Your session has ended. Sign in again to continue.');
    const org = await createOrganization(s.user.id, input);
    return { slug: org.slug };
  });
}

export async function completeOnboardingStepAction(org: string, step: 'template' | 'invite' | 'project' | 'dismissed') {
  return run(async () => {
    await completeOnboardingStep(await actorFor(org), step);
    return true;
  });
}

export async function inviteTeammatesAction(org: string, input: { emails: string[]; role: 'admin' | 'member' }) {
  return run(async () => {
    const actor = await actorFor(org);
    const res = await createInvitations(actor, input);
    await completeOnboardingStep(actor, 'invite');
    return res;
  });
}

export async function createFirstProjectAction(org: string, input: { name: string; key: string; templateId: string }) {
  return run(async () => {
    const actor = await actorFor(org);
    const p = await createProject(actor, input);
    await completeOnboardingStep(actor, 'project');
    return { key: p.key };
  });
}
