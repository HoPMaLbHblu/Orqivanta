import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { FileText, Globe } from 'lucide-react';
import { listDocuments } from '@orqivanta/core';
import { RelativeTime } from '@/components/domain/dates';
import { loadProject } from '@/components/projects/load';
import { NewDocumentButton } from '@/components/projects/new-document-button';
import { Card, CardHeader, EmptyState } from '@/components/ui/primitives';

export async function generateMetadata({ params }: { params: Promise<{ org: string; key: string }> }) {
  const { org, key } = await params;
  const [{ project }, t] = await Promise.all([loadProject(org, key), getTranslations('projects')]);
  return { title: `${t('tabs.documents')} · ${project.name}` };
}

export default async function ProjectDocumentsPage({ params }: { params: Promise<{ org: string; key: string }> }) {
  const { org, key } = await params;
  const { actor, project, can } = await loadProject(org, key);
  const t = await getTranslations('projects');
  const tk = await getTranslations('enums.documentKind');
  const docs = await listDocuments(actor, { projectId: project.id });
  return (
    <Card className="max-w-3xl">
      <CardHeader title={t('documents.title')} description={t('documents.hint')} action={can.createDocument ? <NewDocumentButton org={org} projectId={project.id} /> : null} />
      {docs.length ? (
        <ul className="divide-y divide-line">
          {docs.map((d) => (
            <li key={d.id}>
              <Link href={`/${org}/documents/${d.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2">
                <FileText className="size-4 shrink-0 text-ink-3" aria-hidden />
                <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{d.title}</span>
                <span className="hidden text-[12px] text-ink-3 sm:block">{tk(d.kind)}</span>
                {d.sharedWithClient ? <Globe className="size-3.5 shrink-0 text-accent" aria-label={t('documents.shared')} /> : null}
                <span className="hidden w-24 text-right text-[12px] text-ink-3 md:block">
                  <RelativeTime date={d.updatedAt} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState compact icon={<FileText />} title={t('documents.empty')} description={can.createDocument ? t('documents.emptyBody') : undefined} action={can.createDocument ? <NewDocumentButton org={org} projectId={project.id} /> : null} />
      )}
    </Card>
  );
}
