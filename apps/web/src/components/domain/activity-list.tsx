import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Activity } from 'lucide-react';
import { Avatar } from './avatar';
import { RelativeTime } from './dates';
import { EmptyState } from '@/components/ui/primitives';

export interface ActivityItem {
  id: string;
  summary: string;
  createdAt: Date;
  actorName: string | null;
  actorColor: string | null;
  projectKey?: string | null;
  projectName?: string | null;
}

export function ActivityList({ items, orgSlug, showProject = true, emptyLabel }: { items: ActivityItem[]; orgSlug: string; showProject?: boolean; emptyLabel?: string }) {
  const t = useTranslations('activity');
  if (!items.length) return <EmptyState compact icon={<Activity />} title={emptyLabel ?? t('empty')} />;
  return (
    <ol className="flex flex-col">
      {items.map((a) => (
        <li key={a.id} className="flex gap-3 py-2.5">
          <Avatar name={a.actorName ?? t('system')} color={a.actorColor} size="sm" title="" />
          <div className="min-w-0 flex-1 text-[13px] leading-snug">
            <p className="text-ink-2">
              <span className="font-medium text-ink">{a.actorName ?? t('system')}</span> {a.summary}
            </p>
            <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-ink-3">
              <RelativeTime date={a.createdAt} />
              {showProject && a.projectKey ? (
                <>
                  <span aria-hidden>·</span>
                  <Link href={`/${orgSlug}/projects/${a.projectKey}`} className="hover:text-ink hover:underline">
                    {a.projectName}
                  </Link>
                </>
              ) : null}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
