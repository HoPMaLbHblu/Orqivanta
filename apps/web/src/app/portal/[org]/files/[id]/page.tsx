import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { ArrowLeft, Download } from 'lucide-react';
import { getFile } from '@orqivanta/core';
import { FormattedDate, RelativeTime } from '@/components/domain/dates';
import { downloadUrl, formatBytes } from '@/components/files/format';
import { PortalCard, PortalCardHeader, PortalPageHeader } from '@/components/portal/portal-ui';
import { VersionPreview } from '@/components/portal/version-preview';
import { orNotFound, requirePortal } from '@/components/portal/portal-session';
import { Button } from '@/components/ui/button';

export async function generateMetadata({ params }: { params: Promise<{ org: string; id: string }> }) {
  const { org, id } = await params;
  const { viewer } = await requirePortal(org);
  const f = await orNotFound(getFile(viewer, id)).catch(() => null);
  return { title: f?.file.name ?? 'File' };
}

/** Read-only view of one shared file: the current version, with its earlier versions listed. */
export default async function PortalFilePage({ params }: { params: Promise<{ org: string; id: string }> }) {
  const { org, id } = await params;
  const { viewer } = await requirePortal(org);
  const t = await getTranslations('portal.file');
  const base = `/portal/${org}`;
  const detail = await orNotFound(getFile(viewer, id));
  const current = detail.versions.find((v) => v.version === detail.file.currentVersion) ?? detail.versions[0]!;

  return (
    <div className="mx-auto max-w-[900px] px-4 py-10 sm:px-6 lg:py-14">
      <Link href={`${base}/deliverables`} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-3 hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> {t('eyebrow')}
      </Link>
      <PortalPageHeader
        className="mt-4"
        eyebrow={detail.project ? detail.project.name : undefined}
        title={detail.file.name}
        description={detail.file.description ?? undefined}
        action={
          <Button variant="primary" asChild>
            <a href={downloadUrl(current.id)}>
              <Download /> {t('download')}
            </a>
          </Button>
        }
      />
      <div className="mt-8">
        <VersionPreview
          file={{ id: detail.file.id, name: detail.file.name, versionId: current.id, version: current.version, mimeType: current.mimeType, sizeBytes: current.sizeBytes, hasPreview: Boolean(current.previewKey), note: current.note }}
        />
      </div>
      {detail.versions.length > 1 ? (
        <PortalCard className="mt-6">
          <PortalCardHeader title={t('versions')} />
          <ul className="divide-y divide-line">
            {detail.versions.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-5 py-3.5 text-[13px]">
                <span className="font-medium text-ink">{t('version', { version: v.version, total: detail.file.currentVersion })}</span>
                <span className="text-ink-3">{formatBytes(v.sizeBytes)}</span>
                <span className="min-w-0 flex-1 truncate text-ink-2">{v.note ?? ''}</span>
                <span className="text-ink-3">
                  <RelativeTime date={v.createdAt} /> · <FormattedDate date={v.createdAt} />
                </span>
                <a href={downloadUrl(v.id)} className="inline-flex items-center gap-1 font-medium text-accent hover:underline">
                  <Download className="size-3.5" aria-hidden /> {t('download')}
                  <span className="sr-only">: v{v.version}</span>
                </a>
              </li>
            ))}
          </ul>
        </PortalCard>
      ) : null}
    </div>
  );
}
