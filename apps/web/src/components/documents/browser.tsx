'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { ArrowLeft, FileText, Folder, FolderInput, FolderPlus, Inbox, MessageSquare, MoreHorizontal, Pencil, Plus, RotateCcw, Search, Trash2, Users } from 'lucide-react';
import { deleteCollectionAction, setDocumentDeletedAction } from '@/actions/documents';
import { Avatar } from '@/components/domain/avatar';
import { Badge } from '@/components/domain/badges';
import { RelativeTime } from '@/components/domain/dates';
import { toneInk } from '@/components/domain/tone';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm';
import { Input, NativeSelect } from '@/components/ui/input';
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@/components/ui/menu';
import { EmptyState, Mono } from '@/components/ui/primitives';
import { cn } from '@/lib/cn';
import { useAction } from '@/lib/use-action';
import { CollectionDialog, MoveDocumentDialog } from './collection-dialogs';
import { NewDocumentDialog, WORKSPACE } from './new-document-dialog';

export interface BrowserProject {
  id: string;
  key: string;
  name: string;
  color: string | null;
  canCreate: boolean;
  canDelete: boolean;
  hasClient: boolean;
}

export interface BrowserCollection {
  id: string;
  name: string;
  description: string | null;
  projectId: string | null;
  docCount: number;
  canEdit: boolean;
  canDelete: boolean;
}

export interface BrowserDoc {
  id: string;
  title: string;
  kind: string;
  projectId: string | null;
  projectKey: string | null;
  projectName: string | null;
  projectColor: string | null;
  collectionId: string | null;
  sharedWithClient: boolean;
  updatedAt: Date;
  deletedAt: Date | null;
  updatedByName: string | null;
  updatedByColor: string | null;
  excerpt: string;
  commentCount: number;
  canEdit: boolean;
  canDelete: boolean;
}

interface Filters {
  project: string;
  shared: boolean;
  mine: boolean;
  q: string;
  trash: boolean;
}

export function DocumentsBrowser({ org, docs, collections, projects, canCreateWorkspace, filters, sampleBadge }: { org: string; docs: BrowserDoc[]; collections: BrowserCollection[]; projects: BrowserProject[]; canCreateWorkspace: boolean; filters: Filters; sampleBadge: ReactNode }) {
  const t = useTranslations('documents');
  const router = useRouter();
  const pathname = usePathname();
  const { call } = useAction();
  const [q, setQ] = useState(filters.q);
  const [newDoc, setNewDoc] = useState<{ projectId?: string | null; collectionId?: string | null } | null>(null);
  const [collectionDialog, setCollectionDialog] = useState<{ collection: BrowserCollection | null } | null>(null);
  const [moving, setMoving] = useState<BrowserDoc | null>(null);
  const [deletingCollection, setDeletingCollection] = useState<BrowserCollection | null>(null);

  useEffect(() => setQ(filters.q), [filters.q]);

  const filterProject = filters.project === WORKSPACE ? null : (projects.find((p) => p.key === filters.project) ?? null);
  const filtered = Boolean(filters.project || filters.shared || filters.mine || filters.q);
  const canCreateAnything = canCreateWorkspace || projects.some((p) => p.canCreate);

  function setParams(patch: Partial<Record<'project' | 'shared' | 'mine' | 'q' | 'view', string | null>>) {
    const next = new URLSearchParams();
    const merged = { project: filters.project || null, shared: filters.shared ? '1' : null, mine: filters.mine ? '1' : null, q: filters.q || null, view: filters.trash ? 'trash' : null, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) next.set(k, v);
    const s = next.toString();
    router.push(s ? `${pathname}?${s}` : pathname);
  }

  // Search as you type, debounced, through the URL so results are shareable.
  useEffect(() => {
    if (q === filters.q) return;
    const id = setTimeout(() => setParams({ q: q.trim() || null }), 350);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  async function trashDoc(doc: BrowserDoc) {
    const res = await call(() => setDocumentDeletedAction(org, { documentId: doc.id, deleted: true }));
    if (!res.ok) return;
    toast(t('trashed', { name: doc.title }), {
      action: {
        label: t('undo'),
        onClick: () => void call(() => setDocumentDeletedAction(org, { documentId: doc.id, deleted: false }), { success: t('restored', { name: doc.title }) }),
      },
    });
  }

  async function restoreDoc(doc: BrowserDoc) {
    await call(() => setDocumentDeletedAction(org, { documentId: doc.id, deleted: false }), { success: t('restored', { name: doc.title }) });
  }

  // Group by collection. Collections only show when relevant to the current filter.
  const groups = useMemo(() => {
    const visibleCollections = collections.filter((c) => (filters.project === WORKSPACE ? c.projectId === null : filterProject ? c.projectId === filterProject.id : true));
    const byCollection = new Map<string, BrowserDoc[]>();
    const loose: BrowserDoc[] = [];
    for (const d of docs) {
      if (d.collectionId && visibleCollections.some((c) => c.id === d.collectionId)) byCollection.set(d.collectionId, [...(byCollection.get(d.collectionId) ?? []), d]);
      else loose.push(d);
    }
    const out = visibleCollections.filter((c) => byCollection.has(c.id) || !filtered).map((c) => ({ collection: c, docs: byCollection.get(c.id) ?? [] }));
    return { collections: out, loose };
  }, [collections, docs, filters.project, filterProject, filtered]);

  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);

  if (filters.trash) {
    return (
      <>
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <Link href={`/${org}/documents`} className="mb-1 inline-flex items-center gap-1 text-[12px] text-ink-3 hover:text-ink">
              <ArrowLeft className="size-3.5" aria-hidden /> {t('title')}
            </Link>
            <h1 className="text-[22px] font-semibold tracking-[-0.01em] text-ink">{t('trash.title')}</h1>
            <p className="mt-1 max-w-2xl text-[13px] text-ink-2">{t('trash.description')}</p>
          </div>
        </header>
        <div className="mt-6 overflow-hidden rounded-lg border border-line bg-surface">
          {docs.length ? (
            <ul className="divide-y divide-line">
              {docs.map((d) => (
                <li key={d.id} className="flex items-center gap-3 px-4 py-2.5">
                  <FileText className="size-4 shrink-0 text-ink-3" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] text-ink">{d.title}</p>
                    <p className="text-[12px] text-ink-3">
                      {d.projectKey ? `${d.projectKey} · ` : `${t('workspace')} · `}
                      {t('trash.deletedAgo')} {d.deletedAt ? <RelativeTime date={d.deletedAt} /> : null}
                    </p>
                  </div>
                  {d.canDelete ? (
                    <Button size="sm" variant="secondary" onClick={() => restoreDoc(d)}>
                      <RotateCcw /> {t('restore')}
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={<Trash2 />} title={t('trash.empty')} description={t('trash.emptyHint')} />
          )}
        </div>
      </>
    );
  }

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[22px] font-semibold tracking-[-0.01em] text-ink">{t('title')}</h1>
            {sampleBadge}
          </div>
          <p className="mt-1 max-w-2xl text-[13px] text-ink-2">{t('description')}</p>
        </div>
        {canCreateAnything ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setCollectionDialog({ collection: null })}>
              <FolderPlus /> {t('newCollection')}
            </Button>
            <Button variant="primary" size="sm" onClick={() => setNewDoc({ projectId: filterProject?.id })}>
              <Plus /> {t('newDocument')}
            </Button>
          </div>
        ) : null}
      </header>

      <div className="mt-6 flex flex-wrap items-center gap-2" role="search" aria-label={t('filters.label')}>
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('filters.search')} aria-label={t('filters.search')} className="h-8 pl-8 text-[13px]" type="search" />
        </div>
        <NativeSelect aria-label={t('filters.project')} value={filters.project} onChange={(e) => setParams({ project: e.target.value || null })} className="h-8 w-full text-[13px] sm:w-56">
          <option value="">{t('filters.allProjects')}</option>
          {canCreateWorkspace ? <option value={WORKSPACE}>{t('workspace')}</option> : null}
          {projects.map((p) => (
            <option key={p.id} value={p.key}>
              {p.key} · {p.name}
            </option>
          ))}
        </NativeSelect>
        <ToggleChip pressed={filters.shared} onClick={() => setParams({ shared: filters.shared ? null : '1' })} icon={<Users />}>
          {t('filters.shared')}
        </ToggleChip>
        <ToggleChip pressed={filters.mine} onClick={() => setParams({ mine: filters.mine ? null : '1' })}>
          {t('filters.mine')}
        </ToggleChip>
        {filtered ? (
          <Button variant="ghost" size="sm" onClick={() => router.push(pathname)}>
            {t('filters.clear')}
          </Button>
        ) : null}
        <Link href={`/${org}/documents?view=trash`} className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-[13px] text-ink-3 hover:bg-surface-2 hover:text-ink">
          <Trash2 className="size-4" aria-hidden /> {t('trash.link')}
        </Link>
      </div>

      {docs.length === 0 && groups.collections.length === 0 ? (
        <div className="mt-6 rounded-lg border border-line bg-surface">
          {filtered ? (
            <EmptyState icon={<Search />} title={t('empty.filteredTitle')} description={t('empty.filteredHint')} action={<Button size="sm" variant="secondary" onClick={() => router.push(pathname)}>{t('filters.clear')}</Button>} />
          ) : (
            <EmptyState
              icon={<FileText />}
              title={t('empty.title')}
              description={canCreateAnything ? t('empty.hint') : t('empty.hintReadOnly')}
              action={
                canCreateAnything ? (
                  <Button size="sm" variant="primary" onClick={() => setNewDoc({})}>
                    <Plus /> {t('newDocument')}
                  </Button>
                ) : null
              }
            />
          )}
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-6">
          {groups.collections.map(({ collection, docs: list }) => {
            const project = collection.projectId ? projectById.get(collection.projectId) : null;
            return (
              <section key={collection.id} aria-labelledby={`col-${collection.id}`} className="overflow-hidden rounded-lg border border-line bg-surface">
                <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
                  <Folder className="size-4 shrink-0 text-ink-3" aria-hidden />
                  <h2 id={`col-${collection.id}`} className="min-w-0 truncate text-[13px] font-semibold text-ink">
                    {collection.name}
                  </h2>
                  {!filterProject && filters.project !== WORKSPACE ? <ProjectChip project={project ?? null} workspaceLabel={t('workspace')} /> : null}
                  <span className="text-[12px] text-ink-3 tabular-nums">{list.length}</span>
                  {collection.description ? <span className="hidden min-w-0 truncate text-[12px] text-ink-3 md:inline">· {collection.description}</span> : null}
                  <div className="ml-auto flex items-center gap-1">
                    {collection.canEdit ? (
                      <Button size="xs" variant="ghost" onClick={() => setNewDoc({ projectId: collection.projectId ?? WORKSPACE, collectionId: collection.id })} aria-label={t('newInCollection', { name: collection.name })}>
                        <Plus />
                        <span className="hidden sm:inline">{t('add')}</span>
                      </Button>
                    ) : null}
                    {collection.canEdit || collection.canDelete ? (
                      <Menu>
                        <MenuTrigger asChild>
                          <Button size="icon-sm" variant="ghost" aria-label={t('collectionMenu', { name: collection.name })}>
                            <MoreHorizontal />
                          </Button>
                        </MenuTrigger>
                        <MenuContent align="end">
                          {collection.canEdit ? (
                            <MenuItem onSelect={() => setCollectionDialog({ collection })}>
                              <Pencil /> {t('collection.edit')}
                            </MenuItem>
                          ) : null}
                          {collection.canDelete ? (
                            <MenuItem danger onSelect={() => setDeletingCollection(collection)}>
                              <Trash2 /> {t('collection.delete')}
                            </MenuItem>
                          ) : null}
                        </MenuContent>
                      </Menu>
                    ) : null}
                  </div>
                </div>
                {list.length ? (
                  <DocList org={org} docs={list} showProject={!filterProject && filters.project !== WORKSPACE} onMove={setMoving} onTrash={trashDoc} collections={collections} />
                ) : (
                  <p className="px-4 py-4 text-[13px] text-ink-3">{t('collection.empty')}</p>
                )}
              </section>
            );
          })}
          {groups.loose.length ? (
            <section aria-labelledby="col-none" className="overflow-hidden rounded-lg border border-line bg-surface">
              <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
                <Inbox className="size-4 shrink-0 text-ink-3" aria-hidden />
                <h2 id="col-none" className="text-[13px] font-semibold text-ink">
                  {groups.collections.length ? t('unfiled') : t('allDocuments')}
                </h2>
                <span className="text-[12px] text-ink-3 tabular-nums">{groups.loose.length}</span>
              </div>
              <DocList org={org} docs={groups.loose} showProject={!filterProject && filters.project !== WORKSPACE} onMove={setMoving} onTrash={trashDoc} collections={collections} />
            </section>
          ) : null}
        </div>
      )}

      <NewDocumentDialog
        org={org}
        open={Boolean(newDoc)}
        onOpenChange={(o) => !o && setNewDoc(null)}
        projects={projects}
        collections={collections}
        canCreateWorkspace={canCreateWorkspace}
        defaultProjectId={newDoc?.projectId === WORKSPACE ? null : newDoc?.projectId}
        defaultCollectionId={newDoc?.collectionId}
      />
      <CollectionDialog org={org} open={Boolean(collectionDialog)} onOpenChange={(o) => !o && setCollectionDialog(null)} collection={collectionDialog?.collection} projects={projects} canCreateWorkspace={canCreateWorkspace} defaultProjectId={filterProject?.id} />
      <MoveDocumentDialog org={org} open={Boolean(moving)} onOpenChange={(o) => !o && setMoving(null)} doc={moving} collections={collections.filter((c) => c.canEdit)} />
      <ConfirmDialog
        open={Boolean(deletingCollection)}
        onOpenChange={(o) => !o && setDeletingCollection(null)}
        title={t('collection.deleteTitle', { name: deletingCollection?.name ?? '' })}
        description={t('collection.deleteBody', { count: deletingCollection?.docCount ?? 0 })}
        confirmLabel={t('collection.delete')}
        onConfirm={async () => {
          if (!deletingCollection) return;
          const res = await call(() => deleteCollectionAction(org, { collectionId: deletingCollection.id }), { success: t('collection.deleted') });
          return res.ok;
        }}
      />
    </>
  );
}

function ToggleChip({ pressed, onClick, children, icon }: { pressed: boolean; onClick: () => void; children: ReactNode; icon?: ReactNode }) {
  return (
    <button type="button" aria-pressed={pressed} onClick={onClick} className={cn('inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[13px] transition-colors [&_svg]:size-3.5', pressed ? 'border-accent/40 bg-accent-soft text-accent' : 'border-line-strong bg-surface text-ink-2 hover:bg-surface-2')}>
      {icon}
      {children}
    </button>
  );
}

function ProjectChip({ project, workspaceLabel }: { project: { key: string; color: string | null; name: string } | null; workspaceLabel: string }) {
  if (!project) return <span className="shrink-0 rounded-sm bg-surface-2 px-1.5 text-[11px] text-ink-3">{workspaceLabel}</span>;
  return (
    <span className="inline-flex shrink-0 items-center gap-1" title={project.name}>
      <span className="size-2 rounded-[2px]" style={{ background: toneInk(project.color) }} aria-hidden />
      <Mono>{project.key}</Mono>
    </span>
  );
}

function DocList({ org, docs, showProject, onMove, onTrash, collections }: { org: string; docs: BrowserDoc[]; showProject: boolean; onMove: (d: BrowserDoc) => void; onTrash: (d: BrowserDoc) => void; collections: BrowserCollection[] }) {
  const t = useTranslations('documents');
  const tk = useTranslations('enums.documentKind');
  return (
    <ul className="divide-y divide-line">
      {docs.map((d) => {
        const canMove = d.canEdit && collections.some((c) => c.canEdit && (c.projectId ?? null) === (d.projectId ?? null));
        return (
          <li key={d.id} className="group relative flex items-center gap-3 px-4 py-2 hover:bg-surface-2">
            <FileText className="size-4 shrink-0 text-ink-3" aria-hidden />
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2">
                <Link href={`/${org}/documents/${d.id}`} className="min-w-0 truncate text-[13px] font-medium text-ink after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:rounded-md focus-visible:after:ring-2 focus-visible:after:ring-accent/40">
                  {d.title}
                </Link>
                {d.kind !== 'page' ? <span className="hidden shrink-0 text-[11px] text-ink-3 sm:inline">{tk(d.kind)}</span> : null}
              </div>
              {d.excerpt ? <p className="mt-0.5 hidden truncate text-[12px] text-ink-3 md:block">{d.excerpt}</p> : null}
            </div>
            {showProject ? (
              <span className="hidden sm:inline-flex">
                <ProjectChip project={d.projectKey ? { key: d.projectKey, color: d.projectColor, name: d.projectName ?? d.projectKey } : null} workspaceLabel={t('workspace')} />
              </span>
            ) : null}
            {d.sharedWithClient ? (
              <Badge tone="accent" icon={Users} className="hidden md:inline-flex">
                {t('shared')}
              </Badge>
            ) : null}
            {d.commentCount ? (
              <span className="hidden items-center gap-1 text-[12px] text-ink-3 tabular-nums sm:inline-flex" title={t('openComments', { count: d.commentCount })}>
                <MessageSquare className="size-3.5" aria-hidden />
                {d.commentCount}
                <span className="sr-only">{t('openComments', { count: d.commentCount })}</span>
              </span>
            ) : null}
            <span className="flex w-28 shrink-0 items-center justify-end gap-1.5 text-[12px] text-ink-3">
              {d.updatedByName ? <Avatar name={d.updatedByName} color={d.updatedByColor} size="xs" title={t('editedBy', { name: d.updatedByName })} /> : null}
              <RelativeTime date={d.updatedAt} />
            </span>
            {canMove || d.canDelete ? (
              <Menu>
                <MenuTrigger asChild>
                  <Button size="icon-sm" variant="ghost" aria-label={t('docMenu', { name: d.title })} className="relative z-10">
                    <MoreHorizontal />
                  </Button>
                </MenuTrigger>
                <MenuContent align="end">
                  {canMove ? (
                    <MenuItem onSelect={() => onMove(d)}>
                      <FolderInput /> {t('moveTo')}
                    </MenuItem>
                  ) : null}
                  {canMove && d.canDelete ? <MenuSeparator /> : null}
                  {d.canDelete ? (
                    <MenuItem danger onSelect={() => onTrash(d)}>
                      <Trash2 /> {t('moveToTrash')}
                    </MenuItem>
                  ) : null}
                </MenuContent>
              </Menu>
            ) : (
              <span className="w-7" aria-hidden />
            )}
          </li>
        );
      })}
    </ul>
  );
}
