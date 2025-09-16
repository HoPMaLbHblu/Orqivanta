'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Download, FileWarning, ShieldAlert } from 'lucide-react';
import { FileIcon } from '@/components/files/file-icon';
import { downloadUrl, formatBytes, inlineUrl, previewUrl } from '@/components/files/format';
import { EmptyState } from '@/components/ui/primitives';

export interface VersionView {
  id: string;
  version: number;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  note: string | null;
  status: string;
  createdAt: Date;
  hasPreview: boolean;
  previewable: boolean;
  uploadedByName: string | null;
  uploadedByColor: string | null;
}

/** Image and PDF preview from the permission-checked preview route; anything else offers a download. */
export function FilePreview({ version, name }: { version: VersionView; name: string }) {
  const t = useTranslations('fileViewer.preview');
  const [failed, setFailed] = useState(false);
  const isImage = version.mimeType.startsWith('image/');
  const isPdf = version.mimeType === 'application/pdf';

  if (version.status === 'quarantined') {
    return (
      <div className="rounded-lg border border-danger/30 bg-danger-soft/40">
        <EmptyState icon={<ShieldAlert />} title={t('quarantined')} description={t('quarantinedHint')} />
      </div>
    );
  }

  if (isImage && !failed) {
    return (
      <figure className="overflow-hidden rounded-lg border border-line bg-surface-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={version.hasPreview ? previewUrl(version.id) : inlineUrl(version.id)} alt={t('imageAlt', { name })} onError={() => setFailed(true)} className="mx-auto block max-h-[70vh] w-auto max-w-full object-contain" />
        <figcaption className="border-t border-line bg-surface px-3 py-1.5 text-[12px] text-ink-3">{t('caption', { version: version.version, size: formatBytes(version.sizeBytes) })}</figcaption>
      </figure>
    );
  }

  if (isPdf && !failed) {
    return (
      <div className="overflow-hidden rounded-lg border border-line bg-surface">
        <object data={inlineUrl(version.id)} type="application/pdf" aria-label={t('pdfLabel', { name })} className="h-[70vh] w-full">
          <div className="p-6">
            <EmptyState
              icon={<FileIcon mimeType={version.mimeType} />}
              title={t('pdfFallback')}
              description={t('pdfFallbackHint')}
              action={
                <a href={downloadUrl(version.id)} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line-strong bg-surface px-2.5 text-[13px] font-medium text-ink hover:bg-surface-2">
                  <Download className="size-4" aria-hidden /> {t('download')}
                </a>
              }
            />
          </div>
        </object>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-line bg-surface">
      <EmptyState
        icon={failed ? <FileWarning /> : <FileIcon mimeType={version.mimeType} className="size-5" />}
        title={failed ? t('failed') : t('noPreview')}
        description={failed ? t('failedHint') : t('noPreviewHint', { type: version.mimeType, size: formatBytes(version.sizeBytes) })}
        action={
          <a href={downloadUrl(version.id)} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line-strong bg-surface px-2.5 text-[13px] font-medium text-ink hover:bg-surface-2">
            <Download className="size-4" aria-hidden /> {t('download')}
          </a>
        }
      />
    </div>
  );
}
