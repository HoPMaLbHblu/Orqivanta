'use client';

import { Star } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { setFavoriteAction } from '@/actions/projects';
import { cn } from '@/lib/cn';
import { useAction } from '@/lib/use-action';

/** Star toggle. Flips immediately and rolls back if the server refuses. */
export function FavoriteButton({ org, projectId, projectName, initial, className }: { org: string; projectId: string; projectName: string; initial: boolean; className?: string }) {
  const t = useTranslations('projects');
  const { call } = useAction();
  const [on, setOn] = useState(initial);
  useEffect(() => setOn(initial), [initial]);
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? t('unfavorite', { name: projectName }) : t('favorite', { name: projectName })}
      title={on ? t('unfavoriteShort') : t('favoriteShort')}
      onClick={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const next = !on;
        setOn(next);
        const res = await call(() => setFavoriteAction(org, { entityType: 'project', entityId: projectId, favorite: next }));
        if (!res.ok) setOn(!next);
      }}
      className={cn('inline-flex size-7 shrink-0 items-center justify-center rounded-md text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink', on && 'text-attention hover:text-attention', className)}
    >
      <Star className="size-4" fill={on ? 'currentColor' : 'none'} aria-hidden />
    </button>
  );
}
