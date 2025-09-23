import { cn } from '@/lib/cn';

/** Progress bar with its value in text for screen readers. */
export function ProgressBar({ value, label, className }: { value: number | null; label: string; className?: string }) {
  const pct = value === null ? 0 : Math.round(value * 100);
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value === null ? undefined : pct} className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
        <div data-progress-fill className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-9 text-right text-[12px] tabular-nums text-ink-3">{value === null ? '—' : `${pct}%`}</span>
    </div>
  );
}
