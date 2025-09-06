import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-lg border border-line bg-surface', className)} {...rest} />;
}

export function CardHeader({ title, action, description, className }: { title: ReactNode; action?: ReactNode; description?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-start justify-between gap-3 border-b border-line px-4 py-3', className)}>
      <div className="min-w-0">
        <h2 className="text-[13px] font-semibold text-ink">{title}</h2>
        {description ? <p className="mt-0.5 text-[12px] text-ink-3">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return <kbd className={cn('inline-flex h-5 min-w-5 items-center justify-center rounded border border-line-strong bg-surface-2 px-1 font-mono text-[11px] text-ink-2', className)}>{children}</kbd>;
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('animate-pulse rounded-md bg-surface-3', className)} />;
}

export function Divider({ className }: { className?: string }) {
  return <hr className={cn('border-line', className)} />;
}

export function Mono({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn('font-mono text-[12px] text-ink-3', className)}>{children}</span>;
}

export function PageHeader({ title, description, actions, eyebrow, className }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode; className?: string }) {
  return (
    <header className={cn('flex flex-wrap items-end justify-between gap-4', className)}>
      <div className="min-w-0">
        {eyebrow ? <div className="mb-1 text-[12px] text-ink-3">{eyebrow}</div> : null}
        <h1 className="truncate text-[22px] font-semibold tracking-[-0.01em] text-ink">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-[13px] text-ink-2">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function EmptyState({ icon, title, description, action, className, compact }: { icon?: ReactNode; title: ReactNode; description?: ReactNode; action?: ReactNode; className?: string; compact?: boolean }) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center', compact ? 'gap-2 px-4 py-8' : 'gap-3 px-6 py-14', className)}>
      {icon ? <div className="flex size-10 items-center justify-center rounded-full bg-surface-2 text-ink-3 [&_svg]:size-5">{icon}</div> : null}
      <div>
        <p className="text-[14px] font-medium text-ink">{title}</p>
        {description ? <p className="mx-auto mt-1 max-w-sm text-[13px] text-ink-3">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Notice({ tone = 'info', icon, children, className, action }: { tone?: 'info' | 'attention' | 'danger' | 'success' | 'neutral'; icon?: ReactNode; children: ReactNode; className?: string; action?: ReactNode }) {
  const tones = {
    info: 'border-info/25 bg-info-soft text-info',
    attention: 'border-attention/25 bg-attention-soft text-attention',
    danger: 'border-danger/25 bg-danger-soft text-danger',
    success: 'border-success/25 bg-success-soft text-success',
    neutral: 'border-line bg-surface-2 text-ink-2',
  };
  return (
    <div role="status" className={cn('flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-[13px] [&>svg]:mt-0.5 [&>svg]:size-4 [&>svg]:shrink-0', tones[tone], className)}>
      {icon}
      <div className="min-w-0 flex-1 text-ink">{children}</div>
      {action}
    </div>
  );
}
