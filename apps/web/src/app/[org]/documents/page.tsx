import { getTranslations } from 'next-intl/server';
import { canOrg, listAuthoredDocumentIds, listCollections, listDocuments, listProjectCapabilities } from '@orqivanta/core';
import { DocumentsBrowser, type BrowserCollection, type BrowserDoc, type BrowserProject } from '@/components/documents/browser';
import { SampleDataBadge } from '@/components/domain/badges';
import { requireActor } from '@/lib/session';

export async function generateMetadata() {
  const t = await getTranslations('documents');
  return { title: t('title') };
}

type Search = { project?: string; shared?: string; mine?: string; q?: string; view?: string };

export default async function DocumentsPage({ params, searchParams }: { params: Promise<{ org: string }>; searchParams: Promise<Search> }) {
  const { org } = await params;
  const sp = await searchParams;
  const actor = await requireActor(org);
  const isAdmin = actor.role === 'owner' || actor.role === 'admin';
  const caps = await listProjectCapabilities(actor);
  const trash = sp.view === 'trash';
  const q = sp.q?.trim().slice(0, 100) || undefined;
  const projectFilter = sp.project === 'workspace' ? 'workspace' : (caps.find((p) => p.key === sp.project?.toUpperCase())?.id ?? null);

  const [docs, authored, ...collectionLists] = await Promise.all([
    listDocuments(actor, {
      q,
      deleted: trash || undefined,
      ...(projectFilter === 'workspace' ? { scope: 'org' } : projectFilter ? { projectId: projectFilter } : {}),
    }),
    listAuthoredDocumentIds(actor),
    canOrg(actor.role, 'documents.browse') ? listCollections(actor, null) : Promise.resolve([]),
    ...caps.map((p) => listCollections(actor, p.id)),
  ]);
  const mine = new Set(authored);
  const capById = new Map(caps.map((p) => [p.id, p]));

  const projects: BrowserProject[] = caps.map((p) => ({ id: p.id, key: p.key, name: p.name, color: p.color, canCreate: p.canCreateDocument, canDelete: p.canDeleteDocuments, hasClient: p.hasClient }));
  const collections: BrowserCollection[] = collectionLists.flat().map((c) => {
    const cap = c.projectId ? capById.get(c.projectId) : null;
    return {
      id: c.id,
      name: c.name,
      description: c.description,
      projectId: c.projectId,
      docCount: c.docCount,
      canEdit: c.projectId ? Boolean(cap?.canCreateDocument) : true,
      canDelete: c.projectId ? Boolean(cap?.canDeleteDocuments) : isAdmin,
    };
  });

  const rows: BrowserDoc[] = docs
    .filter((d) => (sp.shared === '1' ? d.sharedWithClient : true))
    .filter((d) => (sp.mine === '1' ? mine.has(d.id) : true))
    .map((d) => {
      const cap = d.projectId ? capById.get(d.projectId) : null;
      const isMine = mine.has(d.id);
      const canEdit = d.projectId ? Boolean(cap?.canCreateDocument) : true;
      return {
        id: d.id,
        title: d.title,
        kind: d.kind,
        projectId: d.projectId,
        projectKey: d.projectKey,
        projectName: d.projectName,
        projectColor: cap?.color ?? null,
        collectionId: d.collectionId,
        sharedWithClient: d.sharedWithClient,
        updatedAt: d.updatedAt,
        deletedAt: d.deletedAt,
        updatedByName: d.updatedByName,
        updatedByColor: d.updatedByColor,
        excerpt: d.excerpt,
        commentCount: d.commentCount,
        canEdit,
        canDelete: d.projectId ? Boolean(cap?.canDeleteDocuments) || (isMine && canEdit) : isAdmin || isMine,
      };
    });

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6 lg:px-10">
      <DocumentsBrowser
        org={org}
        docs={rows}
        collections={collections}
        projects={projects}
        canCreateWorkspace={canOrg(actor.role, 'documents.browse')}
        filters={{ project: projectFilter === 'workspace' ? 'workspace' : (caps.find((p) => p.id === projectFilter)?.key ?? ''), shared: sp.shared === '1', mine: sp.mine === '1', q: q ?? '', trash }}
        sampleBadge={actor.isDemo ? <SampleDataBadge /> : null}
      />
    </div>
  );
}
