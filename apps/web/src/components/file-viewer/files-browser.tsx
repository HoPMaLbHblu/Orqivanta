'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useState, type ReactNode } from 'react';
import { Download, FileStack, HardDrive, Search, Upload, Users, X } from 'lucide-react';
import { ApprovalStatusBadge, Badge, type ApprovalStatus } from '@/components/domain/badges';
import { RelativeTime } from '@/components/domain/dates';
import { toneInk } from '@/components/domain/tone';
import { FileIcon } from '@/components/files/file-icon';
import { downloadUrl, formatBytes } from '@/components/files/format';
import { FileUploader } from '@/components/files/uploader';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input, NativeSelect } from '@/components/ui/input';
import { EmptyState, Mono } from '@/components/ui/primitives';
import { cn } from '@/lib/cn';

export interface FilesProject {
  id: string;
  key: string;
  name: string;
  color: string | null;
  canUpload: boolean;
  hasClient: boolean;
  canShare: boolean;
}

export interface FileRow {
  id: string;
  name: string;
  description: string | null;
  kind: string;
  projectKey: string | null;
  projectName: string | null;
  projectColor: string | null;
  sharedWithClient: boolean;
  currentVersion: number;
  updatedAt: Date;
  versionId: string;
  mimeType: string;
  sizeBytes: number;
  uploadedByName: string | null;
  approvalStatus: string | null;
}

const TYPES = ['image', 'pdf', 'document', 'other'] as const;

export function FilesBrowser({ org, files, projects, usage, filters, sampleBadge }: { org: string; files: FileRow[]; projects: FilesProject[]; usage: { usedBytes: number; quotaBytes: number; versionCount: number }; filters: { project: string; type: string; kind: string; q: string }; sampleBadge: ReactNode }) {
  const t = useTranslations('fileViewer.browser');
  const tk = useTranslations('enums.fileKind');
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState(filters.q);
  const [uploadOpen, setUploadOpen] = useState(false);
  const uploadTargets = projects.filter((p) => p.canUpload);
  const [target, setTarget] = useState(uploadTargets.find((p) => p.key === filters.project)?.id ?? uploadTargets[0]?.id ?? '');
  const [shareNew, setShareNew] = useState(false);
  const [deliverable, setDeliverable] = useState(false);
  const targetProject = uploadTargets.find((p) => p.id === target);
  const filtered = Boolean(filters.project || filters.type || filters.kind || filters.q);

  useEffect(() => setQ(filters.q), [filters.q]);

  function setParams(patch: Record<string, string | null>) {
    const next = new URLSearchParams();
    const merged = { project: filters.project || null, type: filters.type || null, kind: filters.kind || null, q: filters.q || null, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) next.set(k, v);
    const s = next.toString();
    router.push(s ? `${pathname}?${s}` : pathname);
  }

  useEffect(() => {
    if (q === filters.q) return;
    const id = setTimeout(() => setParams({ q: q.trim() || null }), 350);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const pct = usage.quotaBytes ? Math.min(100, (usage.usedBytes / usage.quotaBytes) * 100) : 0;

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
        {uploadTargets.length ? (
          <Button variant="primary" size="sm" onClick={() => setUploadOpen((o) => !o)} aria-expanded={uploadOpen}>
            <Upload /> {t('upload')}
          </Button>
        ) : null}
      </header>

      {uploadOpen && uploadTargets.length ? (
        <section aria-label={t('uploadPanel')} className="mt-4 rounded-lg border border-line bg-surface p-4">
          <div className="flex flex-wrap items-end gap-4">
            <label className="flex min-w-56 flex-1 flex-col gap-1.5">
              <span className="text-[13px] font-medium text-ink">{t('uploadTo')}</span>
              <NativeSelect value={target} onChange={(e) => setTarget(e.target.value)}>
                {uploadTargets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.key} · {p.name}
                  </option>
                ))}
              </NativeSelect>
            </label>
            <label className="flex cursor-pointer items-center gap-2 pb-2 text-[13px] text-ink">
              <Checkbox checked={deliverable} onCheckedChange={setDeliverable} />
              {t('asDeliverable')}
            </label>
            <label className={cn('flex items-center gap-2 pb-2 text-[13px]', targetProject?.hasClient && targetProject?.canShare ? 'cursor-pointer text-ink' : 'text-ink-3')}>
              <Checkbox checked={shareNew} onCheckedChange={setShareNew} disabled={!targetProject?.hasClient || !targetProject?.canShare} />
              {t('shareWithClient')}
            </label>
            <Button size="icon" variant="ghost" aria-label={t('closeUpload')} onClick={() => setUploadOpen(false)} className="ml-auto">
              <X />
            </Button>
          </div>
          {!targetProject?.hasClient ? <p className="mt-1 text-[12px] text-ink-3">{t('noClientHint')}</p> : null}
          <FileUploader className="mt-3" endpoint={`/api/orgs/${org}/files`} meta={{ projectId: target, kind: deliverable ? 'deliverable' : 'attachment', sharedWithClient: shareNew }} />
        </section>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center gap-2" role="search" aria-label={t('filtersLabel')}>
        <div className="relative w-full sm:w-60">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('search')} aria-label={t('search')} type="search" className="h-8 pl-8 text-[13px]" />
        </div>
        <NativeSelect aria-label={t('project')} value={filters.project} onChange={(e) => setParams({ project: e.target.value || null })} className="h-8 w-full text-[13px] sm:w-52">
          <option value="">{t('allProjects')}</option>
          {projects.map((p) => (
            <option key={p.id} value={p.key}>
              {p.key} · {p.name}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect aria-label={t('type')} value={filters.type} onChange={(e) => setParams({ type: e.target.value || null })} className="h-8 w-full text-[13px] sm:w-40">
          <option value="">{t('allTypes')}</option>
          {TYPES.map((x) => (
            <option key={x} value={x}>
              {t(`types.${x}`)}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect aria-label={t('kind')} value={filters.kind} onChange={(e) => setParams({ kind: e.target.value || null })} className="h-8 w-full text-[13px] sm:w-56">
          <option value="">{t('allKinds')}</option>
          <option value="deliverable">{tk('deliverable')}</option>
          <option value="attachment">{tk('attachment')}</option>
        </NativeSelect>
        {filtered ? (
          <Button size="sm" variant="ghost" onClick={() => router.push(pathname)}>
            {t('clear')}
          </Button>
        ) : null}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
        <section aria-label={t('listLabel')} className="min-w-0 overflow-hidden rounded-lg border border-line bg-surface">
          {files.length ? (
            <ul className="divide-y divide-line">
              {files.map((f) => (
                <li key={f.id} className="group relative flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2">
                  <FileIcon mimeType={f.mimeType} />
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <Link href={`/${org}/files/${f.id}`} className="min-w-0 truncate text-[13px] font-medium text-ink after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:rounded-md focus-visible:after:ring-2 focus-visible:after:ring-accent/40">
                        {f.name}
                      </Link>
                      {f.kind === 'deliverable' ? <Badge tone="info">{tk('deliverable')}</Badge> : null}
                      {f.currentVersion > 1 ? <span className="shrink-0 font-mono text-[11px] text-ink-3">v{f.currentVersion}</span> : null}
                    </div>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12px] text-ink-3">
                      {f.projectKey ? (
                        <span className="inline-flex items-center gap-1">
                          <span className="size-2 rounded-[2px]" style={{ background: toneInk(f.projectColor) }} aria-hidden />
                          <Mono>{f.projectKey}</Mono>
                        </span>
                      ) : null}
                      <span>{formatBytes(f.sizeBytes)}</span>
                      <span aria-hidden>·</span>
                      <span>
                        {f.uploadedByName ? `${f.uploadedByName} · ` : ''}
                        <RelativeTime date={f.updatedAt} />
                      </span>
                    </p>
                  </div>
                  {f.approvalStatus ? <ApprovalStatusBadge status={f.approvalStatus as ApprovalStatus} /> : null}
                  {f.sharedWithClient ? (
                    <Badge tone="accent" icon={Users} className="hidden md:inline-flex">
                      {t('shared')}
                    </Badge>
                  ) : null}
                  <a href={downloadUrl(f.versionId)} aria-label={t('downloadFile', { name: f.name })} className="relative z-10 inline-flex size-7 items-center justify-center rounded-md text-ink-3 hover:bg-surface-3 hover:text-ink">
                    <Download className="size-4" aria-hidden />
                  </a>
                </li>
              ))}
            </ul>
          ) : filtered ? (
            <EmptyState icon={<Search />} title={t('emptyFiltered')} description={t('emptyFilteredHint')} action={<Button size="sm" variant="secondary" onClick={() => router.push(pathname)}>{t('clear')}</Button>} />
          ) : (
            <EmptyState
              icon={<FileStack />}
              title={t('empty')}
              description={uploadTargets.length ? t('emptyHint') : t('emptyHintReadOnly')}
              action={
                uploadTargets.length ? (
                  <Button size="sm" variant="primary" onClick={() => setUploadOpen(true)}>
                    <Upload /> {t('upload')}
                  </Button>
                ) : null
              }
            />
          )}
        </section>

        <aside aria-labelledby="storage-heading" className="rounded-lg border border-line bg-surface p-4 lg:self-start">
          <h2 id="storage-heading" className="flex items-center gap-2 text-[13px] font-semibold text-ink">
            <HardDrive className="size-4 text-ink-3" aria-hidden /> {t('storage.title')}
          </h2>
          <p className="mt-2 text-[13px] text-ink">
            {t('storage.used', { used: formatBytes(usage.usedBytes), quota: formatBytes(usage.quotaBytes) })}
          </p>
          <div role="progressbar" aria-labelledby="storage-heading" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} aria-valuetext={t('storage.used', { used: formatBytes(usage.usedBytes), quota: formatBytes(usage.quotaBytes) })} className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-3">
            <div className={cn('h-full', pct > 90 ? 'bg-danger' : pct > 75 ? 'bg-attention' : 'bg-accent')} style={{ width: `${Math.max(pct, 0.5)}%` }} />
          </div>
          <p className="mt-2 text-[12px] text-ink-3">{t('storage.detail', { count: usage.versionCount })}</p>
          <p className="mt-1 text-[12px] text-ink-3">{t('storage.note')}</p>
        </aside>
      </div>
    </>
  );
}
