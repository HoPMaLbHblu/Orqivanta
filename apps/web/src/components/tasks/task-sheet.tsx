'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { Sheet } from '@/components/ui/dialog';

/**
 * Side panel for a task, opened by the ?task=REF search param so every panel has its own
 * address. The panel content is rendered on the server by the page.
 */
export function TaskSheet({ taskRef, children }: { taskRef: string | null; children: ReactNode }) {
  const t = useTranslations('tasks');
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const close = () => {
    const next = new URLSearchParams(sp.toString());
    next.delete('task');
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };
  return (
    <Sheet open={Boolean(taskRef)} onOpenChange={(o) => !o && close()} title={t('sheet.title', { ref: taskRef ?? '' })} width="max-w-3xl">
      {children}
    </Sheet>
  );
}

/** Links a list/board row to the panel without losing the current filters. */
export function useOpenTaskPanel() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  return (ref: string) => {
    const next = new URLSearchParams(sp.toString());
    next.set('task', ref);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };
}
