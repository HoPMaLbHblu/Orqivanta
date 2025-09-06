import { cn } from '@/lib/cn';
import { toneStyle } from './tone';

export function initials(name: string | null | undefined) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '')).toUpperCase() || '?';
}

export function Avatar({ name, color, size = 'md', className, title }: { name: string | null | undefined; color?: string | null; size?: 'xs' | 'sm' | 'md' | 'lg'; className?: string; title?: string }) {
  const s = { xs: 'size-5 text-[9px]', sm: 'size-6 text-[10px]', md: 'size-7 text-[11px]', lg: 'size-10 text-[14px]' }[size];
  return (
    <span title={title ?? name ?? undefined} className={cn('inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold tracking-tight', s, className)} style={toneStyle(color)} aria-hidden={title === '' ? true : undefined}>
      {initials(name)}
    </span>
  );
}

export function AvatarStack({ people, max = 4, size = 'sm' }: { people: { name: string | null; color?: string | null }[]; max?: number; size?: 'xs' | 'sm' | 'md' }) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  return (
    <span className="flex items-center -space-x-1.5" aria-label={people.map((p) => p.name).join(', ')}>
      {shown.map((p, i) => (
        <Avatar key={i} name={p.name} color={p.color} size={size} className="ring-2 ring-surface" title="" />
      ))}
      {rest > 0 ? <span className="inline-flex size-6 items-center justify-center rounded-full bg-surface-3 text-[10px] font-medium text-ink-2 ring-2 ring-surface">+{rest}</span> : null}
    </span>
  );
}
