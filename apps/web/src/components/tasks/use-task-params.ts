'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useTransition } from 'react';

/** Shared helper for the filter controls: patch the URL without losing scroll position. */
export function useTaskParams() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();

  const setParams = useCallback(
    (patch: Record<string, string | null>, opts: { keepTask?: boolean } = {}) => {
      const next = new URLSearchParams(sp.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === '') next.delete(k);
        else next.set(k, v);
      }
      if (!opts.keepTask) next.delete('task');
      const qs = next.toString();
      startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
    },
    [pathname, router, sp],
  );

  const toggleInList = useCallback(
    (key: string, value: string) => {
      const current = (sp.get(key) ?? '').split(',').filter(Boolean);
      const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
      setParams({ [key]: next.length ? next.join(',') : null });
    },
    [setParams, sp],
  );

  return { sp, setParams, toggleInList, pending };
}
