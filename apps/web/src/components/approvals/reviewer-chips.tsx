'use client';

import { useTranslations } from 'next-intl';
import { Check, Clock, RotateCcw, X, type LucideIcon } from 'lucide-react';
import { Avatar } from '@/components/domain/avatar';
import { cn } from '@/lib/cn';

export type Decision = 'approved' | 'changes_requested' | 'rejected' | null;

export const DECISION_ICON: Record<'approved' | 'changes_requested' | 'rejected' | 'pending', LucideIcon> = {
  approved: Check,
  changes_requested: RotateCcw,
  rejected: X,
  pending: Clock,
};

const DECISION_CLASS = {
  approved: 'bg-success-soft text-success',
  changes_requested: 'bg-info-soft text-info',
  rejected: 'bg-danger-soft text-danger',
  pending: 'bg-surface-2 text-ink-3',
} as const;

/** Reviewers of an approval with their decision, compact enough for a list row. */
export function ReviewerChips({ reviewers, myUserId, max = 4 }: { reviewers: { userId: string; name: string; avatarColor?: string | null; decision: Decision }[]; myUserId?: string; max?: number }) {
  const t = useTranslations('approvals');
  const te = useTranslations('enums.decision');
  if (!reviewers.length) return null;
  const shown = reviewers.slice(0, max);
  const rest = reviewers.length - shown.length;
  const label = (d: Decision) => (d ? te(d) : t('awaiting'));
  return (
    <span className="flex shrink-0 items-center gap-1.5" aria-label={t('reviewersLabel')}>
      {shown.map((r) => {
        const key = r.decision ?? 'pending';
        const Icon = DECISION_ICON[key];
        return (
          <span key={r.userId} className="inline-flex items-center gap-1" title={`${r.name}${myUserId === r.userId ? ' · ' + t('you') : ''} — ${label(r.decision)}`}>
            <Avatar name={r.name} color={r.avatarColor} size="xs" title="" />
            <span className={cn('inline-flex size-4 items-center justify-center rounded-full', DECISION_CLASS[key])}>
              <Icon className="size-3" aria-hidden />
            </span>
            <span className="sr-only">
              {r.name}: {label(r.decision)}
            </span>
          </span>
        );
      })}
      {rest > 0 ? <span className="text-[12px] text-ink-3">+{rest}</span> : null}
    </span>
  );
}
