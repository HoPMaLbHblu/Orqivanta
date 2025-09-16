import { Download, FileQuestion } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { FileIcon } from '@/components/files/file-icon';
import { downloadUrl, formatBytes, inlineUrl, previewUrl } from '@/components/files/format';
import { cn } from '@/lib/cn';

export interface PreviewFile {
  id: string;
  name: string;
  versionId: string;
  version: number;
  mimeType: string;
  sizeBytes: number;
  hasPreview: boolean;
  note?: string | null;
}

/**
 * A large look at the exact version under review: images inline (the generated preview when
 * there is one), PDFs in an embedded viewer, anything else as a download.
 */
export function VersionPreview({ file, className }: { file: PreviewFile; className?: string }) {
  const t = useTranslations('portal.approvals');
  const isImage = file.mimeType.startsWith('image/');
  const isPdf = file.mimeType === 'application/pdf';
  return (
    <figure className={cn('flex flex-col', className)}>
      <div className="flex items-center justify-center overflow-hidden rounded-t-xl border border-line bg-surface-2">
        {isImage ? (
          // eslint-disable-next-line @next/next/no-img-element -- private, permission-checked stream, not a static asset
          <img src={file.hasPreview ? previewUrl(file.versionId) : inlineUrl(file.versionId)} alt={file.name} className="max-h-[70vh] w-full object-contain" />
        ) : isPdf ? (
          <object data={inlineUrl(file.versionId)} type="application/pdf" className="h-[70vh] w-full" aria-label={file.name}>
            <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
              <FileQuestion className="size-6 text-ink-3" aria-hidden />
              <p className="text-[14px] text-ink">{t('noPreview')}</p>
              <a href={downloadUrl(file.versionId)} className="text-[13px] font-medium text-accent hover:underline">
                {t('download')}
              </a>
            </div>
          </object>
        ) : (
          <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
            <FileIcon mimeType={file.mimeType} className="size-6" />
            <div>
              <p className="text-[14px] font-medium text-ink">{t('noPreview')}</p>
              <p className="mt-1 text-[13px] text-ink-3">{t('noPreviewHint')}</p>
            </div>
          </div>
        )}
      </div>
      <figcaption className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-b-xl border border-t-0 border-line bg-surface px-4 py-3 text-[13px]">
        <FileIcon mimeType={file.mimeType} />
        <span className="min-w-0 flex-1 truncate font-medium text-ink">{file.name}</span>
        <span className="text-ink-3">
          {t('version', { version: file.version })} · {formatBytes(file.sizeBytes)}
        </span>
        <a href={downloadUrl(file.versionId)} className="inline-flex items-center gap-1 font-medium text-accent hover:underline">
          <Download className="size-3.5" aria-hidden /> {t('download')}
        </a>
      </figcaption>
      {file.note ? (
        <p className="mt-2 text-[13px] text-ink-2">
          <span className="font-medium text-ink">{t('versionNote')}:</span> {file.note}
        </p>
      ) : null}
    </figure>
  );
}
