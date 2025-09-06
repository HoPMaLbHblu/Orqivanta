'use client';

import * as S from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface Option {
  value: string;
  label: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
}

/** Accessible select on Radix. Use NativeSelect inside plain forms posted to the server. */
export function Select({ value, onValueChange, options, placeholder, id, className, disabled, size = 'md', 'aria-label': ariaLabel, 'aria-invalid': ariaInvalid, 'aria-describedby': describedBy }: { value: string | undefined; onValueChange: (v: string) => void; options: Option[]; placeholder?: string; id?: string; className?: string; disabled?: boolean; size?: 'sm' | 'md'; 'aria-label'?: string; 'aria-invalid'?: boolean; 'aria-describedby'?: string }) {
  return (
    <S.Root value={value} onValueChange={onValueChange} disabled={disabled}>
      <S.Trigger
        id={id}
        aria-label={ariaLabel}
        aria-invalid={ariaInvalid}
        aria-describedby={describedBy}
        className={cn(
          'inline-flex w-full items-center justify-between gap-2 rounded-md border border-line-strong bg-surface px-3 text-left text-ink hover:border-ink-3 focus-visible:outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/25 disabled:opacity-60 data-[placeholder]:text-ink-3 aria-[invalid=true]:border-danger',
          size === 'sm' ? 'h-8 text-[13px]' : 'h-9 text-[14px]',
          className,
        )}
      >
        <S.Value placeholder={placeholder} />
        <S.Icon>
          <ChevronDown className="size-4 text-ink-3" />
        </S.Icon>
      </S.Trigger>
      <S.Portal>
        <S.Content position="popper" sideOffset={4} className="z-50 max-h-80 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-lg border border-line bg-surface shadow-pop animate-pop-in">
          <S.Viewport className="p-1">
            {options.map((o) => (
              <S.Item key={o.value} value={o.value} disabled={o.disabled} className="relative flex h-8 cursor-default select-none items-center gap-2 rounded-md pr-2 pl-7 text-[13px] text-ink outline-none data-[highlighted]:bg-surface-2 data-[disabled]:opacity-50">
                <S.ItemIndicator className="absolute left-2">
                  <Check className="size-4 text-accent" />
                </S.ItemIndicator>
                {o.icon}
                <S.ItemText>{o.label}</S.ItemText>
              </S.Item>
            ))}
          </S.Viewport>
        </S.Content>
      </S.Portal>
    </S.Root>
  );
}
