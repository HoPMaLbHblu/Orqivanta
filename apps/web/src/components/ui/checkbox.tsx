'use client';

import * as C from '@radix-ui/react-checkbox';
import * as Sw from '@radix-ui/react-switch';
import { Check, Minus } from 'lucide-react';
import { cn } from '@/lib/cn';

export function Checkbox({ checked, onCheckedChange, id, disabled, className, 'aria-label': ariaLabel }: { checked: boolean | 'indeterminate'; onCheckedChange: (v: boolean) => void; id?: string; disabled?: boolean; className?: string; 'aria-label'?: string }) {
  return (
    <C.Root
      id={id}
      checked={checked}
      onCheckedChange={(v) => onCheckedChange(v === true)}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn('flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-line-strong bg-surface transition-colors hover:border-ink-3 data-[state=checked]:border-accent data-[state=checked]:bg-accent data-[state=indeterminate]:border-accent data-[state=indeterminate]:bg-accent disabled:opacity-50', className)}
    >
      <C.Indicator className="text-accent-ink">{checked === 'indeterminate' ? <Minus className="size-3" strokeWidth={3} /> : <Check className="size-3" strokeWidth={3} />}</C.Indicator>
    </C.Root>
  );
}

export function Switch({ checked, onCheckedChange, id, disabled, 'aria-label': ariaLabel, 'aria-describedby': describedBy }: { checked: boolean; onCheckedChange: (v: boolean) => void; id?: string; disabled?: boolean; 'aria-label'?: string; 'aria-describedby'?: string }) {
  return (
    <Sw.Root id={id} checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} aria-label={ariaLabel} aria-describedby={describedBy} className="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full bg-line-strong transition-colors data-[state=checked]:bg-accent disabled:opacity-50">
      <Sw.Thumb className="block size-4 translate-x-0.5 rounded-full bg-surface shadow transition-transform duration-150 data-[state=checked]:translate-x-[18px]" />
    </Sw.Root>
  );
}
