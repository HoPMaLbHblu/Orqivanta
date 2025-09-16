'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, ChevronRight, Download, Pencil, Stamp, Trash2, Upload, Users } from 'lucide-react';
import { setFileDeletedAction, updateFileAction } from '@/actions/files';
import { RequestApprovalDialog } from '@/components/documents/request-approval-dialog';
import { Avatar } from '@/components/domain/avatar';
import { ApprovalStatusBadge, Badge, type ApprovalStatus } from '@/components/domain/badges';
import { DueDate, FormattedDate, RelativeTime } from '@/components/domain/dates';
import { toneInk } from '@/components/domain/tone';
import { FileIcon } from '@/components/files/file-icon';
import { downloadUrl, formatBytes } from '@/components/files/format';
import { FileUploader } from '@/components/files/uploader';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/checkbox';
import { ConfirmDialog } from '@/components/ui/confirm';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { Mono, Notice } from '@/components/ui/primitives';
import { cn } from '@/lib/cn';
import { useAction } from '@/lib/use-action';
import { FilePreview, type VersionView } from './preview';

interface Props {
  org: string;
  file: { id: string; name: string; description: string | null; kind: string; currentVersion: number; sharedWithClient: boolean; createdAt: Date; updatedAt: Date };
  project: { id: string; key: string; name: string; portalEnabled: boolean; clientAccountId: string | null; color: string | null; archived: boolean } | null;
  access: { isClient: boolean; canUpload: boolean; canDelete: boolean; canShare: boolean; canRequestApproval: boolean };
  versions: VersionView[];
  approvals: { id: string; title: string; status: string; round: number; createdAt: Date; fileVersionId: string | null; dueDate: string | null; reviewers: { name: string; color: string | null; decision: string | null }[] }[];
  task: { id: string; number: number; title: string } | null;
  request: { id: string; number: number; title: string } | null;
}

export function FileViewer({ org, file, project, access, versions, approvals, task, request }: Props) {
  const t = useTranslations('fileViewer');
  const tk = useTranslations('enums.fileKind');
  const router = useRouter();
  const { call, pending } = useAction();
  const [selectedId, setSelectedId] = useState(versions[0]?.id ?? '');
  const [editing, setEditing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const selected = versions.find((v) => v.id === selectedId) ?? versions[0];
  const isLatest = selected?.version === file.currentVersion;

  async function toggleShare(shared: boolean) {
    await call(() => updateFileAction(org, { fileId: file.id, sharedWithClient: shared }), { success: shared ? t('share.sharedToast') : t('share.unsharedToast') });
  }

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6 lg:px-10">
      <nav aria-label={t('breadcrumb')} className="flex min-w-0 items-center gap-1 text-[13px] text-ink-3">
        <Link href={`/${org}/files`} className="hover:text-ink">
          {t('files')}
        </Link>
        {project ? (
          <>
            <ChevronRight className="size-3.5 shrink-0" aria-hidden />
            <Link href={`/${org}/files?project=${project.key}`} className="inline-flex shrink-0 items-center gap-1 hover:text-ink">
              <span className="size-2 rounded-[2px]" style={{ background: toneInk(project.color) }} aria-hidden />
              <Mono>{project.key}</Mono>
            </Link>
          </>
        ) : null}
        <ChevronRight className="size-3.5 shrink-0" aria-hidden />
        <span className="min-w-0 truncate text-ink-2" aria-current="page">
          {file.name}
        </span>
      </nav>

      <header className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <FileIcon mimeType={selected?.mimeType ?? ''} className="mt-1 size-5" />
          <div className="min-w-0">
            <h1 className="truncate text-[20px] font-semibold tracking-[-0.01em] text-ink">{file.name}</h1>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-ink-3">
              <span>{tk(file.kind as 'attachment')}</span>
              <span aria-hidden>·</span>
              <span>{t('versionCount', { count: file.currentVersion })}</span>
              {selected ? (
                <>
                  <span aria-hidden>·</span>
                  <span>{formatBytes(selected.sizeBytes)}</span>
                </>
              ) : null}
              {file.sharedWithClient ? (
                <>
                  <span aria-hidden>·</span>
                  <span className="inline-flex items-center gap-1 text-accent">
                    <Users className="size-3.5" aria-hidden /> {t('shared')}
                  </span>
                </>
              ) : null}
            </p>
            {file.description ? <p className="mt-2 max-w-2xl text-[13px] text-ink-2">{file.description}</p> : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {selected ? (
            <a href={downloadUrl(selected.id)} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line-strong bg-surface px-2.5 text-[13px] font-medium text-ink transition-colors hover:bg-surface-2">
              <Download className="size-4" aria-hidden /> {isLatest ? t('download') : t('downloadVersion', { version: selected.version })}
            </a>
          ) : null}
          {access.canUpload && !access.isClient ? (
            <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
              <Pencil /> {t('editDetails')}
            </Button>
          ) : null}
          {access.canUpload ? (
            <Button size="sm" variant="primary" onClick={() => setUploading((u) => !u)} aria-expanded={uploading}>
              <Upload /> {t('newVersion')}
            </Button>
          ) : null}
          {access.canDelete ? (
            <Button size="icon" variant="ghost" aria-label={t('delete')} onClick={() => setDeleting(true)}>
              <Trash2 />
            </Button>
          ) : null}
        </div>
      </header>

      {project?.archived ? (
        <Notice tone="neutral" className="mt-4">
          {t('archivedProject')}
        </Notice>
      ) : null}

      {uploading && access.canUpload ? (
        <div className="mt-4 rounded-lg border border-line bg-surface p-4">
          <h2 className="text-[13px] font-semibold text-ink">{t('upload.title')}</h2>
          <p className="mt-0.5 mb-3 text-[12px] text-ink-3">{t('upload.hint', { version: file.currentVersion + 1 })}</p>
          <FileUploader
            endpoint={`/api/orgs/${org}/files/${file.id}/versions`}
            multiple={false}
            onUploaded={() => {
              setUploading(false);
              toast.success(t('upload.done', { version: file.currentVersion + 1 }));
              router.refresh();
            }}
          />
        </div>
      ) : null}

      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          {selected ? (
            <>
              {!isLatest ? (
                <Notice tone="attention" icon={<AlertTriangle />} className="mb-3" action={<Button size="xs" variant="secondary" onClick={() => setSelectedId(versions[0]!.id)}>{t('showLatest')}</Button>}>
                  {t('viewingOld', { version: selected.version, latest: file.currentVersion })}
                </Notice>
              ) : null}
              <FilePreview version={selected} name={file.name} />
            </>
          ) : (
            <Notice tone="neutral">{t('noVersions')}</Notice>
          )}
        </div>

        <aside className="flex flex-col gap-5">
          <section aria-labelledby="versions-heading" className="rounded-lg border border-line bg-surface">
            <h2 id="versions-heading" className="border-b border-line px-4 py-2.5 text-[13px] font-semibold text-ink">
              {t('versions')}
            </h2>
            <ol className="max-h-80 divide-y divide-line overflow-y-auto">
              {versions.map((v) => (
                <li key={v.id}>
                  <button type="button" onClick={() => setSelectedId(v.id)} aria-current={v.id === selected?.id ? 'true' : undefined} className={cn('flex w-full flex-col gap-1 px-4 py-2.5 text-left transition-colors', v.id === selected?.id ? 'bg-accent-soft/60' : 'hover:bg-surface-2')}>
                    <span className="flex items-center gap-2">
                      <span className="font-mono text-[12px] text-ink-2">v{v.version}</span>
                      {v.version === file.currentVersion ? <Badge tone="accent">{t('latest')}</Badge> : null}
                      {v.status === 'quarantined' ? <Badge tone="danger">{t('quarantined')}</Badge> : null}
                      <span className="ml-auto text-[12px] text-ink-3">{formatBytes(v.sizeBytes)}</span>
                    </span>
                    <span className="flex items-center gap-1.5 text-[12px] text-ink-3">
                      {v.uploadedByName ? <Avatar name={v.uploadedByName} color={v.uploadedByColor} size="xs" title="" /> : null}
                      <span className="truncate">{v.uploadedByName ?? t('someone')}</span>
                      <span aria-hidden>·</span>
                      <RelativeTime date={v.createdAt} />
                    </span>
                    {v.note ? <span className="text-[12px] text-ink-2">{v.note}</span> : null}
                  </button>
                </li>
              ))}
            </ol>
          </section>

          <section aria-labelledby="file-details" className="rounded-lg border border-line bg-surface">
            <h2 id="file-details" className="border-b border-line px-4 py-2.5 text-[13px] font-semibold text-ink">
              {t('details')}
            </h2>
            <dl className="flex flex-col gap-3 px-4 py-3 text-[13px]">
              <Row label={t('project')}>
                {project ? (
                  <Link href={`/${org}/projects/${project.key}`} className="inline-flex min-w-0 items-center gap-1.5 text-ink hover:underline">
                    <span className="size-2 shrink-0 rounded-[2px]" style={{ background: toneInk(project.color) }} aria-hidden />
                    <span className="truncate">{project.name}</span>
                  </Link>
                ) : (
                  <span className="text-ink-2">{t('noProject')}</span>
                )}
              </Row>
              {task ? (
                <Row label={t('task')}>
                  <Link href={`/${org}/tasks/${project?.key}-${task.number}`} className="text-accent hover:underline">
                    {project?.key}-{task.number} · {task.title}
                  </Link>
                </Row>
              ) : null}
              {request ? (
                <Row label={t('request')}>
                  <Link href={`/${org}/requests/${request.number}`} className="text-accent hover:underline">
                    #{request.number} · {request.title}
                  </Link>
                </Row>
              ) : null}
              <Row label={t('fileType')}>
                <span className="text-ink-2 break-all">{selected?.mimeType ?? '—'}</span>
              </Row>
              <Row label={t('originalName')}>
                <span className="text-ink-2 break-all">{selected?.originalName ?? '—'}</span>
              </Row>
              <Row label={t('added')}>
                <span className="text-ink-2">
                  <FormattedDate date={file.createdAt} />
                </span>
              </Row>
            </dl>
          </section>

          {project && !access.isClient ? (
            <section aria-labelledby="file-share" className="rounded-lg border border-line bg-surface">
              <h2 id="file-share" className="border-b border-line px-4 py-2.5 text-[13px] font-semibold text-ink">
                {t('share.title')}
              </h2>
              <div className="px-4 py-3">
                {access.canShare ? (
                  <div className="flex items-start justify-between gap-3">
                    <label htmlFor="file-share-switch" className="text-[13px] text-ink">
                      {t('share.label')}
                      <span id="file-share-hint" className="mt-0.5 block text-[12px] text-ink-3">
                        {!project.clientAccountId ? t('share.noClient') : file.sharedWithClient ? t('share.onHint') : t('share.offHint')}
                      </span>
                    </label>
                    <Switch id="file-share-switch" checked={file.sharedWithClient} onCheckedChange={toggleShare} disabled={pending || (!project.clientAccountId && !file.sharedWithClient)} aria-describedby="file-share-hint" />
                  </div>
                ) : (
                  <p className="flex flex-wrap items-center gap-2 text-[13px]">
                    {file.sharedWithClient ? <Badge tone="accent" icon={Users}>{t('shared')}</Badge> : <Badge tone="muted">{t('internalOnly')}</Badge>}
                    <span className="text-[12px] text-ink-3">{t('share.managersOnly')}</span>
                  </p>
                )}
                {file.sharedWithClient && !project.portalEnabled ? <p className="mt-2 text-[12px] text-attention">{t('share.portalOff')}</p> : null}
              </div>
            </section>
          ) : null}

          {project ? (
            <section aria-labelledby="file-approvals" className="rounded-lg border border-line bg-surface">
              <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2.5">
                <h2 id="file-approvals" className="text-[13px] font-semibold text-ink">
                  {t('approvals.title')}
                </h2>
                {access.canRequestApproval && selected ? (
                  <Button size="xs" variant="ghost" onClick={() => setRequesting(true)}>
                    <Stamp /> {t('approvals.request')}
                  </Button>
                ) : null}
              </div>
              {approvals.length ? (
                <ul className="divide-y divide-line">
                  {approvals.map((a) => {
                    const v = versions.find((x) => x.id === a.fileVersionId);
                    return (
                      <li key={a.id}>
                        <Link href={`/${org}/approvals/${a.id}`} className="flex flex-col gap-1 px-4 py-2.5 hover:bg-surface-2">
                          <span className="truncate text-[13px] font-medium text-ink">{a.title}</span>
                          <span className="flex flex-wrap items-center gap-2">
                            <ApprovalStatusBadge status={a.status as ApprovalStatus} />
                            {v ? <span className="font-mono text-[12px] text-ink-3">v{v.version}</span> : null}
                            {a.round > 1 ? <span className="text-[12px] text-ink-3">{t('approvals.round', { round: a.round })}</span> : null}
                            {a.status === 'pending' ? <DueDate date={a.dueDate} short /> : null}
                          </span>
                          {a.reviewers.length ? (
                            <span className="text-[12px] text-ink-3">{t('approvals.decided', { done: a.reviewers.filter((r) => r.decision).length, total: a.reviewers.length })}</span>
                          ) : null}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="px-4 py-3 text-[12px] text-ink-3">{access.canRequestApproval ? t('approvals.emptyCan') : t('approvals.empty')}</p>
              )}
            </section>
          ) : null}
        </aside>
      </div>

      <EditFileDialog org={org} open={editing} onOpenChange={setEditing} file={file} canChangeKind={!access.isClient} />
      {project && selected && access.canRequestApproval ? (
        <RequestApprovalDialog
          org={org}
          open={requesting}
          onOpenChange={setRequesting}
          target={{ type: 'file', projectId: project.id, fileId: file.id, fileVersionId: selected.id, title: file.name, version: selected.version }}
          sharedWithClient={file.sharedWithClient}
        />
      ) : null}
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={t('deleteTitle', { name: file.name })}
        description={t('deleteBody')}
        confirmLabel={t('delete')}
        onConfirm={async () => {
          const res = await call(() => setFileDeletedAction(org, { fileId: file.id, deleted: true }), { refresh: false });
          if (!res.ok) return false;
          toast(t('deleted', { name: file.name }), {
            action: { label: t('undo'), onClick: () => void setFileDeletedAction(org, { fileId: file.id, deleted: false }).then((r) => r.ok && router.push(`/${org}/files/${file.id}`)) },
          });
          router.push(project ? `/${org}/files?project=${project.key}` : `/${org}/files`);
          return true;
        }}
      />
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[88px_minmax(0,1fr)] items-baseline gap-2">
      <dt className="text-[12px] text-ink-3">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

function EditFileDialog({ org, open, onOpenChange, file, canChangeKind }: { org: string; open: boolean; onOpenChange: (o: boolean) => void; file: { id: string; name: string; description: string | null; kind: string }; canChangeKind: boolean }) {
  const t = useTranslations('fileViewer.edit');
  const tc = useTranslations('common');
  const tk = useTranslations('enums.fileKind');
  const { call, pending, fieldErrors } = useAction();
  const [name, setName] = useState(file.name);
  const [description, setDescription] = useState(file.description ?? '');
  const [kind, setKind] = useState(file.kind);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) {
          setName(file.name);
          setDescription(file.description ?? '');
          setKind(file.kind);
        }
        onOpenChange(o);
      }}
    >
      <DialogContent title={t('title')} description={t('description')}>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const res = await call(() => updateFileAction(org, { fileId: file.id, name, description: description.trim() || null, kind }), { success: t('saved'), inlineFieldErrors: true });
            if (res.ok) onOpenChange(false);
          }}
          className="flex flex-col gap-4"
        >
          <Field label={t('name')} error={fieldErrors.name} hint={t('nameHint')}>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={180} required autoFocus />
          </Field>
          <Field label={t('descriptionLabel')} optional={tc('optional')} error={fieldErrors.description}>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} className="min-h-20" />
          </Field>
          {canChangeKind ? (
            <Field label={t('kind')} hint={t('kindHint')} error={fieldErrors.kind}>
              <NativeSelect value={kind} onChange={(e) => setKind(e.target.value)}>
                <option value="attachment">{tk('attachment')}</option>
                <option value="deliverable">{tk('deliverable')}</option>
              </NativeSelect>
            </Field>
          ) : null}
          <DialogFooter>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              {tc('cancel')}
            </Button>
            <Button type="submit" variant="primary" loading={pending} disabled={!name.trim()}>
              {tc('saveChanges')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
