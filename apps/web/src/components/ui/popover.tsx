'use client';

import * as P from '@radix-ui/react-popover';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export const Popover = P.Root;
export const PopoverTrigger = P.Trigger;
export const PopoverAnchor = P.Anchor;
export const PopoverClose = P.Close;

export function PopoverContent({ children, className, align = 'start', side, sideOffset = 6 }: { children: ReactNode; className?: string; align?: 'start' | 'center' | 'end'; side?: 'top' | 'bottom' | 'left' | 'right'; sideOffset?: number }) {
  return (
    <P.Portal>
      <P.Content align={align} side={side} sideOffset={sideOffset} className={cn('z-50 rounded-lg border border-line bg-surface p-3 shadow-pop animate-pop-in focus:outline-none', className)}>
        {children}
      </P.Content>
    </P.Portal>
  );
}
