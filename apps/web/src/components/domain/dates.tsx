import { useFormatter, useNow, useTranslations } from 'next-intl';
import { CalendarClock } from 'lucide-react';
import { cn } from '@/lib/cn';

/** "3 hours ago", with the exact time on hover. */
export function RelativeTime({ date, className }: { date: Date | string; className?: string }) {
  const format = useFormatter();
  const now = useNow();
  const d = typeof date === 'string' ? new Date(date) : date;
  // Server and browser render a few seconds apart, so "just now" can become "1 second ago".
  return (
    <time dateTime={d.toISOString()} title={format.dateTime(d, { dateStyle: 'medium', timeStyle: 'short' })} className={className} suppressHydrationWarning>
      {format.relativeTime(d, now)}
    </time>
  );
}

function todayISO(now: Date, timeZone?: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/**
 * Due dates are calendar days (no time). Overdue items say so in words and carry an icon,
 * not just a red colour.
 */
export function DueDate({ date, done, className, withIcon = true, short }: { date: string | null; done?: boolean; className?: string; withIcon?: boolean; short?: boolean }) {
  const t = useTranslations('common');
  const format = useFormatter();
  const now = useNow();
  if (!date) return null;
  const today = todayISO(now);
  const d = new Date(`${date}T12:00:00Z`);
  const overdue = !done && date < today;
  const isToday = date === today;
  const tomorrow = todayISO(new Date(now.getTime() + 86_400_000));
  const label = isToday ? t('today') : date === tomorrow ? t('tomorrow') : format.dateTime(d, { day: 'numeric', month: 'short', timeZone: 'UTC', ...(d.getUTCFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}) });
  return (
    <span className={cn('inline-flex items-center gap-1 text-[12px] whitespace-nowrap tabular-nums', overdue ? 'font-medium text-danger' : isToday && !done ? 'font-medium text-attention' : 'text-ink-3', className)} title={overdue ? `${t('overdue')} · ${format.dateTime(d, { dateStyle: 'long', timeZone: 'UTC' })}` : format.dateTime(d, { dateStyle: 'long', timeZone: 'UTC' })}>
      {withIcon ? <CalendarClock className="size-3.5" aria-hidden /> : null}
      {overdue && !short ? `${t('overdue')} · ` : null}
      {label}
    </span>
  );
}

export function FormattedDate({ date, withTime, className }: { date: Date | string; withTime?: boolean; className?: string }) {
  const format = useFormatter();
  const d = typeof date === 'string' ? new Date(date.length === 10 ? `${date}T12:00:00Z` : date) : date;
  const opts = typeof date === 'string' && date.length === 10 ? ({ dateStyle: 'medium', timeZone: 'UTC' } as const) : withTime ? ({ dateStyle: 'medium', timeStyle: 'short' } as const) : ({ dateStyle: 'medium' } as const);
  return (
    <time dateTime={d.toISOString()} className={className}>
      {format.dateTime(d, opts)}
    </time>
  );
}
