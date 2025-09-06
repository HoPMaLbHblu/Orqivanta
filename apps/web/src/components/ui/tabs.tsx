'use client';

import * as T from '@radix-ui/react-tabs';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export const Tabs = T.Root;
export const TabsContent = T.Content;

export function TabsList({ children, className }: { children: ReactNode; className?: string }) {
  return <T.List className={cn('flex gap-1 border-b border-line', className)}>{children}</T.List>;
}

export function TabsTrigger({ value, children }: { value: string; children: ReactNode }) {
  return (
    <T.Trigger value={value} className="-mb-px border-b-2 border-transparent px-2.5 pb-2 text-[13px] font-medium text-ink-3 hover:text-ink data-[state=active]:border-accent data-[state=active]:text-ink">
      {children}
    </T.Trigger>
  );
}

/** Route tabs: real links, so every tab has its own URL and works without JavaScript. */
export function NavTabs({ items, className }: { items: { href: string; label: ReactNode; count?: number; exact?: boolean }[]; className?: string }) {
  const pathname = usePathname();
  return (
    <nav className={cn('flex gap-1 overflow-x-auto border-b border-line', className)}>
      {items.map((it) => {
        const active = it.exact ? pathname === it.href : pathname === it.href || pathname.startsWith(`${it.href}/`);
        return (
          <Link key={it.href} href={it.href} aria-current={active ? 'page' : undefined} className={cn('-mb-px inline-flex items-center gap-1.5 border-b-2 px-2.5 pb-2 text-[13px] font-medium whitespace-nowrap transition-colors', active ? 'border-accent text-ink' : 'border-transparent text-ink-3 hover:text-ink')}>
            {it.label}
            {it.count ? <span className="rounded-full bg-surface-2 px-1.5 text-[11px] tabular-nums text-ink-2">{it.count}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}
