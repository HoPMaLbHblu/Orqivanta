import { useTranslations } from 'next-intl';
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Circle,
  CircleDashed,
  CircleDot,
  CircleHelp,
  CircleSlash,
  Clock,
  Copy,
  Eye,
  Inbox,
  Loader,
  RotateCcw,
  SignalHigh,
  SignalLow,
  SignalMedium,
  Siren,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { toneStyle } from './tone';

type Tone = 'neutral' | 'accent' | 'attention' | 'danger' | 'success' | 'info' | 'muted';
const toneClass: Record<Tone, string> = {
  neutral: 'bg-surface-2 text-ink-2 border-line',
  muted: 'bg-transparent text-ink-3 border-line',
  accent: 'bg-accent-soft text-accent border-accent/20',
  attention: 'bg-attention-soft text-attention border-attention/25',
  danger: 'bg-danger-soft text-danger border-danger/25',
  success: 'bg-success-soft text-success border-success/25',
  info: 'bg-info-soft text-info border-info/25',
};

/** Status is never colour alone: every badge carries an icon and a text label. */
export function Badge({ tone = 'neutral', icon: Icon, children, className, title }: { tone?: Tone; icon?: LucideIcon; children: ReactNode; className?: string; title?: string }) {
  return (
    <span title={title} className={cn('inline-flex h-[22px] max-w-full items-center gap-1 rounded-full border px-2 text-[12px] font-medium whitespace-nowrap', toneClass[tone], className)}>
      {Icon ? <Icon className="size-3.5 shrink-0" aria-hidden /> : null}
      <span className="truncate">{children}</span>
    </span>
  );
}

export type StatusCategory = 'backlog' | 'unstarted' | 'started' | 'review' | 'completed' | 'canceled';
const CATEGORY: Record<StatusCategory, { icon: LucideIcon; tone: Tone }> = {
  backlog: { icon: CircleDashed, tone: 'muted' },
  unstarted: { icon: Circle, tone: 'neutral' },
  started: { icon: CircleDot, tone: 'info' },
  review: { icon: Eye, tone: 'attention' },
  completed: { icon: CheckCircle2, tone: 'success' },
  canceled: { icon: CircleSlash, tone: 'muted' },
};

export function StatusIcon({ category, className }: { category: StatusCategory; className?: string }) {
  const { icon: Icon, tone } = CATEGORY[category] ?? CATEGORY.unstarted;
  const color = { muted: 'text-ink-3', neutral: 'text-ink-2', info: 'text-info', attention: 'text-attention', success: 'text-success', accent: 'text-accent', danger: 'text-danger' }[tone];
  return <Icon className={cn('size-4 shrink-0', color, className)} aria-hidden />;
}

export function StatusBadge({ category, name }: { category: StatusCategory; name: string }) {
  const { icon, tone } = CATEGORY[category] ?? CATEGORY.unstarted;
  return (
    <Badge tone={tone} icon={icon}>
      {name}
    </Badge>
  );
}

export type Priority = 'none' | 'low' | 'medium' | 'high' | 'urgent';
const PRIORITY: Record<Priority, { icon: LucideIcon; className: string }> = {
  none: { icon: Circle, className: 'text-ink-3 opacity-40' },
  low: { icon: SignalLow, className: 'text-ink-3' },
  medium: { icon: SignalMedium, className: 'text-ink-2' },
  high: { icon: SignalHigh, className: 'text-attention' },
  urgent: { icon: Siren, className: 'text-danger' },
};

export function PriorityIcon({ priority, withLabel, className }: { priority: Priority; withLabel?: boolean; className?: string }) {
  const t = useTranslations('enums.priority');
  const { icon: Icon, className: c } = PRIORITY[priority] ?? PRIORITY.none;
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-[13px]', className)} title={t(priority)}>
      <Icon className={cn('size-4 shrink-0', c)} aria-hidden />
      {withLabel ? <span className="text-ink-2">{t(priority)}</span> : <span className="sr-only">{t(priority)}</span>}
    </span>
  );
}

export type RequestStatus = 'submitted' | 'in_review' | 'needs_info' | 'accepted' | 'in_progress' | 'completed' | 'declined' | 'duplicate';
const REQUEST: Record<RequestStatus, { icon: LucideIcon; tone: Tone }> = {
  submitted: { icon: Inbox, tone: 'accent' },
  in_review: { icon: Eye, tone: 'info' },
  needs_info: { icon: CircleHelp, tone: 'attention' },
  accepted: { icon: CheckCircle2, tone: 'neutral' },
  in_progress: { icon: Loader, tone: 'info' },
  completed: { icon: CheckCircle2, tone: 'success' },
  declined: { icon: Ban, tone: 'muted' },
  duplicate: { icon: Copy, tone: 'muted' },
};

/** Client-facing wording differs: "needs info" reads as "waiting on you" in the portal. */
export function RequestStatusBadge({ status, client }: { status: RequestStatus; client?: boolean }) {
  const t = useTranslations(client ? 'enums.requestStatusClient' : 'enums.requestStatus');
  const { icon, tone } = REQUEST[status] ?? REQUEST.submitted;
  return (
    <Badge tone={tone} icon={icon}>
      {t(status)}
    </Badge>
  );
}

export type ApprovalStatus = 'pending' | 'approved' | 'changes_requested' | 'rejected' | 'canceled' | 'superseded';
const APPROVAL: Record<ApprovalStatus, { icon: LucideIcon; tone: Tone }> = {
  pending: { icon: Clock, tone: 'attention' },
  approved: { icon: CheckCircle2, tone: 'success' },
  changes_requested: { icon: RotateCcw, tone: 'info' },
  rejected: { icon: XCircle, tone: 'danger' },
  canceled: { icon: CircleSlash, tone: 'muted' },
  superseded: { icon: CircleSlash, tone: 'muted' },
};

export function ApprovalStatusBadge({ status }: { status: ApprovalStatus }) {
  const t = useTranslations('enums.approvalStatus');
  const { icon, tone } = APPROVAL[status] ?? APPROVAL.pending;
  return (
    <Badge tone={tone} icon={icon}>
      {t(status)}
    </Badge>
  );
}

export type Health = 'on_track' | 'at_risk' | 'off_track';
export function HealthBadge({ health, source }: { health: Health; source?: 'manual' | 'computed' | string }) {
  const t = useTranslations('enums.health');
  const map: Record<Health, { icon: LucideIcon; tone: Tone }> = {
    on_track: { icon: CheckCircle2, tone: 'success' },
    at_risk: { icon: AlertTriangle, tone: 'attention' },
    off_track: { icon: XCircle, tone: 'danger' },
  };
  const { icon, tone } = map[health] ?? map.on_track;
  return (
    <Badge tone={tone} icon={icon} title={source === 'computed' ? t('computedHint') : undefined}>
      {t(health)}
    </Badge>
  );
}

export function LabelChip({ name, color, className }: { name: string; color: string; className?: string }) {
  return (
    <span className={cn('inline-flex h-5 items-center rounded-full px-2 text-[11px] font-medium whitespace-nowrap', className)} style={toneStyle(color)}>
      {name}
    </span>
  );
}

export function SampleDataBadge() {
  const t = useTranslations('common');
  return (
    <Badge tone="attention" icon={AlertTriangle} title={t('sampleDataHint')}>
      {t('sampleData')}
    </Badge>
  );
}
