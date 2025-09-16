'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';

export function SettingsNav({ label, items }: { label: string; items: { href: string; label: string }[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className="-mx-4 min-w-0 overflow-x-auto px-4 lg:mx-0 lg:overflow-visible lg:px-0">
      <ul className="flex gap-1 border-b border-line pb-px lg:flex-col lg:border-0 lg:pb-0">
        {items.map((it) => {
          const active = pathname === it.href || pathname.startsWith(`${it.href}/`);
          return (
            <li key={it.href}>
              <Link
                href={it.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex h-8 items-center rounded-md px-2.5 text-[13px] whitespace-nowrap transition-colors',
                  active ? 'bg-surface-3 font-medium text-ink' : 'text-ink-2 hover:bg-surface-2 hover:text-ink',
                )}
              >
                {it.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Section wrapper used by every settings page: title, description, content. */
export function SettingsSection({ title, description, children, action, danger }: { title: React.ReactNode; description?: React.ReactNode; children: React.ReactNode; action?: React.ReactNode; danger?: boolean }) {
  return (
    <section className={cn('rounded-lg border bg-surface', danger ? 'border-danger/30' : 'border-line')}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3">
        <div className="min-w-0">
          <h2 className={cn('text-[14px] font-semibold', danger ? 'text-danger' : 'text-ink')}>{title}</h2>
          {description ? <p className="mt-0.5 max-w-2xl text-[13px] text-ink-3">{description}</p> : null}
        </div>
        {action}
      </div>
      <div>{children}</div>
    </section>
  );
}
