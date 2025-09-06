import Link from 'next/link';
import { cn } from '@/lib/cn';

/** The Orqivanta mark: an open orbit around a still point. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn('size-6', className)} aria-hidden fill="none">
      <circle cx="16" cy="16" r="15" fill="var(--accent)" />
      <path d="M9.5 19.5a7.5 7.5 0 1 1 13 .2" stroke="var(--accent-ink)" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="16" cy="16" r="2.6" fill="var(--accent-ink)" />
    </svg>
  );
}

export function Logo({ href = '/', className, size = 'md' }: { href?: string | null; className?: string; size?: 'sm' | 'md' | 'lg' }) {
  const text = { sm: 'text-[19px]', md: 'text-[22px]', lg: 'text-[28px]' }[size];
  const inner = (
    <span className={cn('inline-flex items-center gap-2 text-ink', className)}>
      <LogoMark className={size === 'lg' ? 'size-8' : size === 'sm' ? 'size-5' : 'size-6'} />
      <span className={cn('font-serif leading-none tracking-[-0.01em]', text)}>Orqivanta</span>
    </span>
  );
  return href ? (
    <Link href={href} aria-label="Orqivanta home" className="rounded-md">
      {inner}
    </Link>
  ) : (
    inner
  );
}
