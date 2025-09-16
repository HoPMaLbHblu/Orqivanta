import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { AppError, canOrg, getDocument, listApprovals, listCollections, listComments, listFavorites, listPeople, listProjectCapabilities, listProjectPeople, recordView } from '@orqivanta/core';
import { DocumentWorkspace } from '@/components/documents/workspace';
import { requireActor } from '@/lib/session';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function load<T>(p: Promise<T>): Promise<T> {
  try {
    return await p;
  } catch (err) {
    if (err instanceof AppError && err.code === 'NOT_FOUND') notFound();
    throw err;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ org: string; id: string }> }) {
  const { org, id } = await params;
  const t = await getTranslations('documents');
  if (!UUID.test(id)) return { title: t('title') };
  const actor = await requireActor(org);
  const data = await getDocument(actor, id).catch(() => null);
  return { title: data?.doc.title ?? t('title') };
}

export default async function DocumentPage({ params }: { params: Promise<{ org: string; id: string }> }) {
  const { org, id } = await params;
  if (!UUID.test(id)) notFound();
  const actor = await requireActor(org);
  const data = await load(getDocument(actor, id));
  const projectId = data.project?.id ?? null;
  const deleted = Boolean(data.doc.deletedAt);

  const [comments, people, caps, favorites, approvals, collections] = await Promise.all([
    deleted ? null : listComments(actor, { type: 'document', id }),
    projectId ? listProjectPeople(actor, projectId) : listPeople(actor).then((ps) => ps.filter((p) => p.role !== 'client').map((p) => ({ ...p, role: 'contributor' as const }))),
    listProjectCapabilities(actor),
    listFavorites(actor),
    projectId ? listApprovals(actor, { projectId, view: 'all' }).then((rows) => rows.filter((a) => a.documentId === id)) : Promise.resolve([]),
    projectId || canOrg(actor.role, 'documents.browse') ? listCollections(actor, projectId) : Promise.resolve([]),
  ]);
  void recordView(actor, 'document', id);
  const cap = projectId ? caps.find((p) => p.id === projectId) : null;
  // Clients can only be mentioned in documents they can see.
  const mentionable = people.filter((p) => p.role !== 'client' || data.doc.sharedWithClient).map((p) => ({ id: p.id, name: p.name, color: p.avatarColor }));

  return (
    <DocumentWorkspace
      key={id}
      org={org}
      currentUserId={actor.userId}
      isAdmin={actor.role === 'owner' || actor.role === 'admin'}
      doc={{
        id: data.doc.id,
        title: data.doc.title,
        kind: data.doc.kind,
        content: data.doc.content,
        version: data.doc.version,
        sharedWithClient: data.doc.sharedWithClient,
        updatedAt: data.doc.updatedAt,
        createdAt: data.doc.createdAt,
        deletedAt: data.doc.deletedAt,
        updatedByName: data.updatedBy?.name ?? null,
        updatedByColor: data.updatedBy?.avatarColor ?? null,
      }}
      project={data.project ? { ...data.project, color: cap?.color ?? null, hasClient: Boolean(cap?.hasClient) } : null}
      collection={data.collection}
      collections={collections.map((c) => ({ id: c.id, name: c.name, description: c.description, projectId: c.projectId, docCount: c.docCount, canEdit: data.access.canEdit, canDelete: false }))}
      versionCount={data.versionCount}
      access={{ ...data.access, canRequestApproval: Boolean(cap?.canRequestApproval) && !deleted }}
      isFavorite={favorites.some((f) => f.entityType === 'document' && f.entityId === id)}
      comments={comments}
      people={mentionable}
      approvals={approvals.map((a) => ({ id: a.id, title: a.title, status: a.status, subjectName: a.subjectName, dueDate: a.dueDate, createdAt: a.createdAt, reviewerCount: a.reviewerCount, decidedCount: a.decidedCount }))}
    />
  );
}
