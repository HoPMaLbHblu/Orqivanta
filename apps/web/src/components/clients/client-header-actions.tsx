'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Archive, ArchiveRestore, Pencil } from 'lucide-react';
import { setClientArchivedAction } from '@/actions/clients';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm';
import { useAction } from '@/lib/use-action';
import { ClientDialog } from './client-dialog';

/** Edit and archive/restore for one client. Archiving closes portal access. */
export function ClientHeaderActions({ org, client }: { org: string; client: { id: string; name: string; website: string | null; internalNotes: string | null; archived: boolean } }) {
  const t = useTranslations('clients');
  const router = useRouter();
  const { call } = useAction();
  const [edit, setEdit] = useState(false);
  const [confirm, setConfirm] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" variant="secondary" onClick={() => setEdit(true)}>
        <Pencil /> {t('edit')}
      </Button>
      {client.archived ? (
        <Button
          size="sm"
          variant="secondary"
          onClick={async () => {
            const res = await call(() => setClientArchivedAction(org, { clientId: client.id, archived: false }), { success: t('restored') });
            if (res.ok) router.refresh();
          }}
        >
          <ArchiveRestore /> {t('restore')}
        </Button>
      ) : (
        <Button size="sm" variant="danger-ghost" onClick={() => setConfirm(true)}>
          <Archive /> {t('archive')}
        </Button>
      )}
      <ClientDialog org={org} open={edit} onOpenChange={setEdit} client={{ id: client.id, name: client.name, website: client.website, internalNotes: client.internalNotes }} />
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={t('archiveTitle', { name: client.name })}
        description={t('archiveBody')}
        confirmLabel={t('archive')}
        onConfirm={async () => {
          const res = await call(() => setClientArchivedAction(org, { clientId: client.id, archived: true }), { success: t('archivedDone') });
          if (res.ok) router.refresh();
          return res.ok;
        }}
      />
    </div>
  );
}
