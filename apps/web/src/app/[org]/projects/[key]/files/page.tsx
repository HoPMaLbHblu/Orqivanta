import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Globe, Paperclip } from 'lucide-react';
import { listFiles } from '@orqivanta/core';
import { RelativeTime } from '@/components/domain/dates';
import { FileIcon } from '@/components/files/file-icon';
import { formatBytes } from '@/components/files/format';
import { FileUploader } from '@/components/files/uploader';
import { loadProject } from '@/components/projects/load';
import { Card, CardHeader, EmptyState } from '@/components/ui/primitives';

export async function generateMetadata({ params }: { params: Promise<{ org: string; key: string }> }) {
  const { org, key } = await params;
  const [{ project }, t] = await Promise.all([loadProject(org, key), getTranslations('projects')]);
  return { title: `${t('tabs.files')} · ${project.name}` };
}

export default async function ProjectFilesPage({ params }: { params: Promise<{ org: string; key: string }> }) {
  const { org, key } = await params;
  const { actor, project, can } = await loadProject(org, key);
  const t = await getTranslations('projects');
  const files = await listFiles(actor, { projectId: project.id });
  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <Card>
        <CardHeader title={t('files.title')} description={t('files.hint')} />
        {files.length ? (
          <ul className="divide-y divide-line">
            {files.map((f) => (
              <li key={f.id}>
                <Link href={`/${org}/files/${f.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2">
                  <FileIcon mimeType={f.mimeType} />
                  <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{f.name}</span>
                  {f.sharedWithClient ? <Globe className="size-3.5 shrink-0 text-accent" aria-label={t('files.shared')} /> : null}
                  <span className="hidden text-[12px] text-ink-3 sm:block">{formatBytes(f.sizeBytes)}</span>
                  {f.currentVersion > 1 ? <span className="text-[12px] text-ink-3">v{f.currentVersion}</span> : null}
                  <span className="hidden w-24 text-right text-[12px] text-ink-3 md:block">
                    <RelativeTime date={f.updatedAt} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState compact icon={<Paperclip />} title={t('files.empty')} description={can.upload ? t('files.emptyBody') : undefined} />
        )}
      </Card>
      {can.upload ? <FileUploader endpoint={`/api/orgs/${org}/files`} meta={{ projectId: project.id }} /> : null}
    </div>
  );
}
