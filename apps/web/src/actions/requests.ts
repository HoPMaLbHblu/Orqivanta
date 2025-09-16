'use server';

import { askForInformation, convertRequestToProject, convertRequestToTask, listRequests, markDuplicate, submitRequest, triageRequest } from '@orqivanta/core';
import { run } from '@/lib/action';
import { actorFor } from '@/lib/session';

export async function submitRequestAction(org: string, input: unknown) {
  return run(async () => {
    const r = await submitRequest(await actorFor(org), input);
    return { number: r.number };
  });
}

export async function triageRequestAction(org: string, input: unknown) {
  return run(async () => {
    const r = await triageRequest(await actorFor(org), input);
    return { version: r.version, status: r.status };
  });
}

/** Posts a question to the requester and moves the request to "needs info". */
export async function askForInformationAction(org: string, input: unknown) {
  return run(async () => {
    const r = await askForInformation(await actorFor(org), input);
    return { version: r.version, status: r.status };
  });
}

export async function markDuplicateAction(org: string, input: unknown) {
  return run(async () => {
    await markDuplicate(await actorFor(org), input);
    return true;
  });
}

/** Finds other requests by number or words, for the duplicate picker. */
export async function searchRequestsAction(org: string, q: string) {
  return run(async () => {
    const rows = await listRequests(await actorFor(org), { view: 'all', q: q.trim() || undefined });
    return rows.slice(0, 8).map((r) => ({ id: r.id, number: r.number, title: r.title, status: r.status, clientName: r.clientName }));
  });
}

export async function convertRequestToTaskAction(org: string, input: unknown) {
  return run(async () => {
    const res = await convertRequestToTask(await actorFor(org), input);
    return { href: res.href, ref: res.task.ref as string };
  });
}

export async function convertRequestToProjectAction(org: string, input: unknown) {
  return run(async () => {
    const p = await convertRequestToProject(await actorFor(org), input);
    return { key: p.key, name: p.name };
  });
}

