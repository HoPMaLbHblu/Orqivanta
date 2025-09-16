import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

const variants = {
  primary: 'bg-accent text-accent-ink hover:bg-accent-hover border border-transparent',
  secondary: 'bg-surface text-ink border border-line-strong hover:bg-surface-2',
  ghost: 'bg-transparent text-ink-2 hover:bg-surface-2 hover:text-ink border border-transparent',
} as const;

const sizes = {
  sm: 'h-8 px-2.5 text-[13px] gap-1.5 rounded-md',
  md: 'h-9 px-3.5 text-[14px] gap-2 rounded-md',
} as const;

/**
 * A link that looks like a button. `<Button asChild>` renders nothing today (the Slot gets
 * an array of children because of the loading slot), so navigation uses this instead.
 */
export function LinkButton({ href, children, variant = 'secondary', size = 'md', className }: { href: string; children: ReactNode; variant?: keyof typeof variants; size?: keyof typeof sizes; className?: string }) {
  return (
    <Link href={href} className={cn('inline-flex shrink-0 select-none items-center font-medium whitespace-nowrap transition-colors duration-150 [&_svg]:size-4 [&_svg]:shrink-0', variants[variant], sizes[size], className)}>
      {children}
    </Link>
  );
}
