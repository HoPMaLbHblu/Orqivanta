'use server';

import {
  createApproval,
  createDocument,
  deleteCollection,
  getDocumentVersion,
  listProjectPeople,
  moveDocument,
  nameDocumentVersion,
  restoreDocumentVersion,
  saveCollection,
  saveDocument,
  setDocumentDeleted,
  setDocumentShared,
  setFavorite,
} from '@orqivanta/core';
import { run } from '@/lib/action';
import { actorFor } from '@/lib/session';

export async function createDocumentAction(org: string, input: unknown) {
  return run(async () => {
    const doc = await createDocument(await actorFor(org), input);
    return { id: doc.id };
  });
}

/** Autosave. On CONFLICT the error carries the latest version, title and content. */
export async function saveDocumentAction(org: string, input: unknown) {
  return run(async () => {
    const res = await saveDocument(await actorFor(org), input);
    return { version: res.version, updatedAt: res.updatedAt.toISOString() };
  });
}

export async function setDocumentSharedAction(org: string, input: unknown) {
  return run(async () => {
    await setDocumentShared(await actorFor(org), input);
    return true;
  });
}

export async function setDocumentDeletedAction(org: string, input: unknown) {
  return run(async () => {
    await setDocumentDeleted(await actorFor(org), input);
    return true;
  });
}

export async function moveDocumentAction(org: string, input: unknown) {
  return run(async () => {
    await moveDocument(await actorFor(org), input);
    return true;
  });
}

export async function saveCollectionAction(org: string, input: unknown) {
  return run(async () => {
    const c = await saveCollection(await actorFor(org), input);
    return { id: c.id, name: c.name };
  });
}

export async function deleteCollectionAction(org: string, input: unknown) {
  return run(async () => {
    await deleteCollection(await actorFor(org), input);
    return true;
  });
}

export async function getDocumentVersionAction(org: string, documentId: string, versionId: string) {
  return run(async () => {
    const v = await getDocumentVersion(await actorFor(org), documentId, versionId);
    return { id: v.id, version: v.version, title: v.title, content: v.content, label: v.label, createdAt: v.createdAt.toISOString() };
  });
}

export async function nameDocumentVersionAction(org: string, input: unknown) {
  return run(async () => {
    const v = await nameDocumentVersion(await actorFor(org), input);
    return { id: v.id, version: v.version };
  });
}

export async function restoreDocumentVersionAction(org: string, input: unknown) {
  return run(async () => restoreDocumentVersion(await actorFor(org), input));
}

export async function setDocumentFavoriteAction(org: string, documentId: string, favorite: boolean) {
  return run(async () => {
    await setFavorite(await actorFor(org), { entityType: 'document', entityId: documentId, favorite });
    return true;
  });
}

/** People who can open the project, for the reviewer picker. */
export async function listReviewerCandidatesAction(org: string, projectId: string) {
  return run(async () => {
    const people = await listProjectPeople(await actorFor(org), projectId);
    return people.map((p) => ({ id: p.id, name: p.name, email: p.email, avatarColor: p.avatarColor, role: p.role }));
  });
}

/** Requests a review of a document (frozen into a version) or of a file version. */
export async function createApprovalAction(org: string, input: unknown) {
  return run(async () => {
    const a = await createApproval(await actorFor(org), input);
    return { id: a.id };
  });
}
