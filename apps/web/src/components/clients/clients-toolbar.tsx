'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ClientDialog } from './client-dialog';

/** Archived toggle (a link, so it has its own URL) plus "New client". */
export function ClientsToolbar({ org, canManage, showArchived, archivedCount }: { org: string; canManage: boolean; showArchived: boolean; archivedCount: number }) {
  const t = useTranslations('clients');
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
      <div className="flex items-center gap-1 text-[13px]">
        <Link href={`/${org}/clients`} aria-current={!showArchived ? 'page' : undefined} className={showArchived ? 'rounded-md px-2 py-1 text-ink-3 hover:text-ink' : 'rounded-md bg-surface-2 px-2 py-1 font-medium text-ink'}>
          {t('active')}
        </Link>
        <Link href={`/${org}/clients?archived=1`} aria-current={showArchived ? 'page' : undefined} className={showArchived ? 'rounded-md bg-surface-2 px-2 py-1 font-medium text-ink' : 'rounded-md px-2 py-1 text-ink-3 hover:text-ink'}>
          {t('showArchived')}
          {archivedCount ? <span className="ml-1.5 text-[11px] tabular-nums text-ink-3">{archivedCount}</span> : null}
        </Link>
      </div>
      {canManage ? (
        <Button size="sm" variant="primary" onClick={() => setOpen(true)}>
          <Plus /> {t('newClient')}
        </Button>
      ) : null}
      <ClientDialog org={org} open={open} onOpenChange={setOpen} />
    </div>
  );
}
