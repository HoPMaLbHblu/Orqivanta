import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Portal surfaces are roomier than the app's: 20px padding, larger type, generous headings.
 * The app's compact Card/CardHeader stay for internal screens.
 */
export function PortalCard({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('overflow-hidden rounded-xl border border-line bg-surface', className)} {...rest} />;
}

export function PortalCardHeader({ title, description, action, className }: { title: ReactNode; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-x-4 gap-y-1.5 border-b border-line px-5 py-4', className)}>
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold tracking-[-0.005em] text-ink">{title}</h2>
        {description ? <p className="mt-1 text-[13px] text-ink-3">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

/** A titled block of the page, with the heading outside the card. */
export function PortalSection({ title, description, action, children, className }: { title: ReactNode; description?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('flex flex-col gap-4', className)}>
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          <h2 className="font-serif text-[22px] leading-tight text-ink">{title}</h2>
          {description ? <p className="mt-1 text-[13px] text-ink-3">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function PortalEmpty({ icon, title, description, action, className }: { icon?: ReactNode; title: ReactNode; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 px-6 py-12 text-center', className)}>
      {icon ? <div className="flex size-11 items-center justify-center rounded-full bg-surface-2 text-ink-3 [&_svg]:size-5">{icon}</div> : null}
      <div>
        <p className="text-[15px] font-medium text-ink">{title}</p>
        {description ? <p className="mx-auto mt-1 max-w-md text-[13px] leading-relaxed text-ink-3">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function PortalPageHeader({ title, description, action, eyebrow, className }: { title: ReactNode; description?: ReactNode; action?: ReactNode; eyebrow?: ReactNode; className?: string }) {
  return (
    <header className={cn('flex flex-wrap items-end justify-between gap-x-6 gap-y-4', className)}>
      <div className="min-w-0 max-w-2xl">
        {eyebrow ? <div className="mb-2 text-[12px] font-medium tracking-wide text-ink-3 uppercase">{eyebrow}</div> : null}
        <h1 className="font-serif text-[32px] leading-[1.12] tracking-[-0.01em] text-ink sm:text-[38px]">{title}</h1>
        {description ? <p className="mt-3 text-[15px] leading-relaxed text-ink-2">{description}</p> : null}
      </div>
      {action ? <div className="flex flex-wrap items-center gap-2">{action}</div> : null}
    </header>
  );
}

/** Label / value rows used on request and review detail pages. */
export function PortalFacts({ items, className }: { items: { label: ReactNode; value: ReactNode }[]; className?: string }) {
  return (
    <dl className={cn('flex flex-col gap-3', className)}>
      {items.map((it, i) => (
        <div key={i} className="flex flex-col gap-0.5">
          <dt className="text-[12px] font-medium tracking-wide text-ink-3 uppercase">{it.label}</dt>
          <dd className="text-[14px] text-ink">{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}
