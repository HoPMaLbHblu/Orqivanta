import { File, FileArchive, FileAudio, FileImage, FileSpreadsheet, FileText, FileVideo, Presentation } from 'lucide-react';
import { cn } from '@/lib/cn';

export function FileIcon({ mimeType, className }: { mimeType: string; className?: string }) {
  const Icon = mimeType.startsWith('image/')
    ? FileImage
    : mimeType === 'application/pdf' || mimeType.startsWith('text/')
      ? FileText
      : mimeType.includes('spreadsheet') || mimeType === 'text/csv'
        ? FileSpreadsheet
        : mimeType.includes('presentation')
          ? Presentation
          : mimeType.startsWith('video/')
            ? FileVideo
            : mimeType.startsWith('audio/')
              ? FileAudio
              : mimeType === 'application/zip'
                ? FileArchive
                : File;
  return <Icon className={cn('size-4 shrink-0 text-ink-3', className)} aria-hidden />;
}
