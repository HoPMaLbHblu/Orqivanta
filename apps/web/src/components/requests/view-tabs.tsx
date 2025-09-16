import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Query-string views (?view=…) rendered as real links, so every view has its own URL.
 * Used by the requests, approvals and clients lists.
 */
export function ViewTabs({ items, label, className }: { items: { href: string; label: ReactNode; count?: number; active: boolean; attention?: boolean }[]; label: string; className?: string }) {
  return (
    <nav aria-label={label} className={cn('-mx-1 flex gap-1 overflow-x-auto border-b border-line px-1', className)}>
      {items.map((it) => (
        <Link
          key={it.href}
          href={it.href}
          aria-current={it.active ? 'page' : undefined}
          className={cn('-mb-px inline-flex items-center gap-1.5 border-b-2 px-2.5 pb-2 text-[13px] font-medium whitespace-nowrap transition-colors', it.active ? 'border-accent text-ink' : 'border-transparent text-ink-3 hover:text-ink')}
        >
          {it.label}
          {it.count ? <span className={cn('rounded-full px-1.5 text-[11px] tabular-nums', it.attention ? 'bg-attention-soft text-attention' : 'bg-surface-2 text-ink-2')}>{it.count}</span> : null}
        </Link>
      ))}
    </nav>
  );
}

/** A GET search box that keeps the current view. Works without JavaScript. */
export function SearchForm({ action, q, view, label, placeholder, extra }: { action: string; q?: string; view?: string; label: string; placeholder: string; extra?: Record<string, string> }) {
  return (
    <form action={action} method="get" role="search" className="w-full sm:w-64">
      {view ? <input type="hidden" name="view" value={view} /> : null}
      {Object.entries(extra ?? {}).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <label className="sr-only" htmlFor="list-search">
        {label}
      </label>
      <input
        id="list-search"
        name="q"
        type="search"
        defaultValue={q}
        placeholder={placeholder}
        className="h-8 w-full rounded-md border border-line-strong bg-surface px-3 text-[13px] text-ink placeholder:text-ink-3 hover:border-ink-3 focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/25 focus-visible:outline-none"
      />
    </form>
  );
}
