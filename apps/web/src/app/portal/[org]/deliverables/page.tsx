import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Download, FolderOpen } from 'lucide-react';
import { listFiles } from '@orqivanta/core';
import { Badge } from '@/components/domain/badges';
import { RelativeTime } from '@/components/domain/dates';
import { FileIcon } from '@/components/files/file-icon';
import { downloadUrl, formatBytes } from '@/components/files/format';
import { PortalCard, PortalCardHeader, PortalEmpty, PortalPageHeader } from '@/components/portal/portal-ui';
import { requirePortal } from '@/components/portal/portal-session';

export async function generateMetadata() {
  const t = await getTranslations('portal.deliverables');
  return { title: t('title') };
}

export default async function PortalDeliverablesPage({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const { viewer } = await requirePortal(org);
  const t = await getTranslations('portal.deliverables');
  const base = `/portal/${org}`;
  const files = await listFiles(viewer, {});

  // Group by project: a client's files always belong to a shared project.
  const groups = new Map<string, { key: string | null; name: string; files: typeof files }>();
  for (const f of files) {
    const id = f.projectId ?? 'none';
    const g = groups.get(id) ?? { key: f.projectKey, name: f.projectName ?? '—', files: [] as typeof files };
    g.files.push(f);
    groups.set(id, g);
  }

  return (
    <div className="mx-auto max-w-[1120px] px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <PortalPageHeader title={t('title')} description={t('intro')} />
      {files.length ? (
        <div className="mt-10 flex flex-col gap-6">
          {[...groups.values()].map((g) => (
            <PortalCard key={g.name}>
              <PortalCardHeader
                title={g.name}
                description={t('fileCount', { count: g.files.length })}
                action={
                  g.key ? (
                    <Link href={`${base}/projects/${g.key}`} className="text-[13px] font-medium text-accent hover:underline">
                      {t('openProject')}
                    </Link>
                  ) : null
                }
              />
              <ul className="divide-y divide-line">
                {g.files.map((f) => (
                  <li key={f.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5">
                    <FileIcon mimeType={f.mimeType} className="size-5" />
                    <span className="min-w-0 flex-1 basis-full sm:basis-0">
                      <Link href={`${base}/files/${f.id}`} className="block truncate text-[15px] font-medium text-ink hover:underline">
                        {f.name}
                      </Link>
                      <span className="mt-0.5 block text-[12px] text-ink-3">
                        {t('version', { version: f.currentVersion })} · {formatBytes(f.sizeBytes)} · <RelativeTime date={f.updatedAt} />
                      </span>
                    </span>
                    {f.approvalStatus === 'pending' ? <Badge tone="attention">{t('inReview')}</Badge> : f.approvalStatus === 'approved' ? <Badge tone="success">{t('approved')}</Badge> : null}
                    <a href={downloadUrl(f.versionId)} className="inline-flex items-center gap-1 text-[13px] font-medium text-accent hover:underline">
                      <Download className="size-3.5" aria-hidden /> {t('download')}
                      <span className="sr-only">: {f.name}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </PortalCard>
          ))}
        </div>
      ) : (
        <PortalCard className="mt-10">
          <PortalEmpty icon={<FolderOpen />} title={t('empty')} description={t('emptyHint')} />
        </PortalCard>
      )}
    </div>
  );
}
