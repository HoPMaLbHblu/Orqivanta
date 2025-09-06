'use client';

import * as M from '@radix-ui/react-dropdown-menu';
import { Check } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export const Menu = M.Root;
export const MenuTrigger = M.Trigger;
export const MenuGroup = M.Group;
export const MenuSub = M.Sub;

const panel = 'z-50 min-w-48 overflow-hidden rounded-lg border border-line bg-surface p-1 shadow-pop animate-pop-in';
const item = 'relative flex h-8 cursor-default select-none items-center gap-2 rounded-md px-2 text-[13px] text-ink outline-none data-[highlighted]:bg-surface-2 data-[disabled]:opacity-50 [&_svg]:size-4 [&_svg]:text-ink-3';

export function MenuContent({ children, align = 'start', className, sideOffset = 6 }: { children: ReactNode; align?: 'start' | 'center' | 'end'; className?: string; sideOffset?: number }) {
  return (
    <M.Portal>
      <M.Content align={align} sideOffset={sideOffset} className={cn(panel, className)}>
        {children}
      </M.Content>
    </M.Portal>
  );
}

export function MenuItem({ children, onSelect, danger, disabled, className, shortcut }: { children: ReactNode; onSelect?: (e: Event) => void; danger?: boolean; disabled?: boolean; className?: string; shortcut?: string }) {
  return (
    <M.Item onSelect={onSelect} disabled={disabled} className={cn(item, danger && 'text-danger [&_svg]:text-danger data-[highlighted]:bg-danger-soft', className)}>
      {children}
      {shortcut ? <span className="ml-auto pl-4 font-mono text-[11px] text-ink-3">{shortcut}</span> : null}
    </M.Item>
  );
}

export function MenuLinkItem({ children, href }: { children: ReactNode; href: string }) {
  return (
    <M.Item asChild className={item}>
      <a href={href}>{children}</a>
    </M.Item>
  );
}

export function MenuCheckItem({ children, checked, onCheckedChange }: { children: ReactNode; checked: boolean; onCheckedChange: (v: boolean) => void }) {
  return (
    <M.CheckboxItem checked={checked} onCheckedChange={onCheckedChange} onSelect={(e) => e.preventDefault()} className={cn(item, 'pl-7')}>
      <M.ItemIndicator className="absolute left-2">
        <Check className="!text-accent" />
      </M.ItemIndicator>
      {children}
    </M.CheckboxItem>
  );
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <M.Label className="px-2 pt-1.5 pb-1 text-[11px] font-medium tracking-wide text-ink-3 uppercase">{children}</M.Label>;
}

export function MenuSeparator() {
  return <M.Separator className="-mx-1 my-1 h-px bg-line" />;
}

export function MenuSubTrigger({ children }: { children: ReactNode }) {
  return <M.SubTrigger className={cn(item, 'data-[state=open]:bg-surface-2')}>{children}</M.SubTrigger>;
}

export function MenuSubContent({ children }: { children: ReactNode }) {
  return (
    <M.Portal>
      <M.SubContent sideOffset={4} className={panel}>
        {children}
      </M.SubContent>
    </M.Portal>
  );
}
