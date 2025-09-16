'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowRight } from 'lucide-react';
import { setPortalPreviewAction } from '@/actions/portal';
import { Spinner } from '@/components/ui/spinner';
import { useAction } from '@/lib/use-action';

/** Picks the client account whose portal to preview; the choice is stored in a cookie. */
export function PreviewPicker({ org, clients }: { org: string; clients: { id: string; name: string; portalProjects: number }[] }) {
  const t = useTranslations('portal.preview');
  const router = useRouter();
  const { call, pending } = useAction();
  return (
    <ul className="flex flex-col gap-2">
      {clients.map((c) => (
        <li key={c.id}>
          <button
            type="button"
            disabled={pending}
            className="group flex w-full items-center gap-4 rounded-xl border border-line bg-surface px-5 py-4 text-left transition-colors hover:border-accent/50 hover:bg-accent-soft/30 disabled:opacity-60"
            onClick={() =>
              call(async () => {
                const res = await setPortalPreviewAction(org, c.id);
                if (res.ok) router.push(`/portal/${org}`);
                return res;
              }, { refresh: false })
            }
          >
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-medium text-ink">{c.name}</span>
              <span className="mt-0.5 block text-[13px] text-ink-3">{t('projectsCount', { count: c.portalProjects })}</span>
            </span>
            {pending ? <Spinner className="size-4" /> : null}
            <span className="inline-flex items-center gap-1 text-[13px] font-medium text-accent group-hover:underline">
              {t('open')} <ArrowRight className="size-3.5" aria-hidden />
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
