import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Avatar } from '@/components/domain/avatar';
import { HealthBadge } from '@/components/domain/badges';
import { RelativeTime } from '@/components/domain/dates';
import { RichText } from '@/components/rich-text/render';
import { cn } from '@/lib/cn';

export interface PortalUpdate {
  id: string;
  projectKey?: string | null;
  projectName?: string | null;
  health: 'on_track' | 'at_risk' | 'off_track';
  summary: string;
  body: unknown;
  createdAt: Date;
  authorName: string | null;
  authorColor: string | null;
}

/** One shared status update. Compact on the home page, full in the updates feed. */
export function UpdateCard({ update, href, compact, showProject = true, className }: { update: PortalUpdate; href?: string; compact?: boolean; showProject?: boolean; className?: string }) {
  const t = useTranslations('portal.updates');
  const title = href ? (
    <Link href={href} className="font-medium text-ink hover:underline">
      {update.summary}
    </Link>
  ) : (
    <span className="font-medium text-ink">{update.summary}</span>
  );
  return (
    <article className={cn('flex flex-col gap-2', className)}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <HealthBadge health={update.health} />
        {showProject && update.projectName ? <span className="text-[12px] text-ink-3">{update.projectName}</span> : null}
        <RelativeTime date={update.createdAt} className="text-[12px] text-ink-3" />
      </div>
      <p className={cn(compact ? 'text-[14px] leading-snug' : 'text-[16px] leading-snug')}>{title}</p>
      {!compact && update.body ? <RichText doc={update.body} className="text-[14px] leading-relaxed text-ink-2" /> : null}
      <div className="flex items-center gap-2 text-[12px] text-ink-3">
        <Avatar name={update.authorName} color={update.authorColor} size="xs" title="" />
        {t('postedBy', { name: update.authorName ?? '—' })}
      </div>
    </article>
  );
}
