'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Archive, ArchiveRestore, Trash2 } from 'lucide-react';
import { deleteProjectAction, setProjectArchivedAction } from '@/actions/projects';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Card, CardHeader } from '@/components/ui/primitives';
import { useAction } from '@/lib/use-action';

export function ProjectDangerZone({ org, projectId, projectKey, projectName, archived, canArchive, canDelete }: { org: string; projectId: string; projectKey: string; projectName: string; archived: boolean; canArchive: boolean; canDelete: boolean }) {
  const t = useTranslations('projects');
  const tc = useTranslations('common');
  const router = useRouter();
  const { call, fieldErrors } = useAction();
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmKey, setConfirmKey] = useState('');

  return (
    <Card className="border-danger/30">
      <CardHeader title={t('danger.title')} description={t('danger.hint')} />
      <div className="flex flex-col gap-4 px-4 py-4">
        {canArchive ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[13px] font-medium text-ink">{archived ? t('danger.restoreTitle') : t('danger.archiveTitle')}</p>
              <p className="text-[12px] text-ink-3">{archived ? t('danger.restoreBody') : t('danger.archiveBody')}</p>
            </div>
            {archived ? (
              <Button size="sm" onClick={() => call(() => setProjectArchivedAction(org, { projectId, archived: false }), { success: t('danger.restored') })}>
                <ArchiveRestore /> {tc('unarchive')}
              </Button>
            ) : (
              <Button size="sm" onClick={() => setArchiveOpen(true)}>
                <Archive /> {tc('archive')}
              </Button>
            )}
          </div>
        ) : null}

        {canDelete ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
            <div>
              <p className="text-[13px] font-medium text-ink">{t('danger.deleteTitle')}</p>
              <p className="text-[12px] text-ink-3">{t('danger.deleteBody')}</p>
            </div>
            <Button size="sm" variant="danger" onClick={() => setDeleteOpen(true)}>
              <Trash2 /> {t('danger.deleteButton')}
            </Button>
          </div>
        ) : null}
      </div>

      <ConfirmDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        tone="primary"
        title={t('danger.archiveConfirmTitle', { name: projectName })}
        description={t('danger.archiveConfirmBody')}
        confirmLabel={tc('archive')}
        onConfirm={async () => {
          const res = await call(() => setProjectArchivedAction(org, { projectId, archived: true }), { success: t('danger.archived') });
          return res.ok;
        }}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={(o) => {
          setDeleteOpen(o);
          if (!o) setConfirmKey('');
        }}
        title={t('danger.deleteConfirmTitle', { name: projectName })}
        description={t('danger.deleteConfirmBody')}
        confirmLabel={t('danger.deleteButton')}
        onConfirm={async () => {
          const res = await call(() => deleteProjectAction(org, { projectId, confirmKey }), { inlineFieldErrors: true, refresh: false });
          if (!res.ok) return false;
          router.push(`/${org}/projects`);
          return true;
        }}
      >
        <Field label={t('danger.typeKey', { key: projectKey })} error={fieldErrors.confirmKey}>
          <Input value={confirmKey} onChange={(e) => setConfirmKey(e.target.value.toUpperCase())} className="font-mono" autoComplete="off" spellCheck={false} />
        </Field>
      </ConfirmDialog>
    </Card>
  );
}
