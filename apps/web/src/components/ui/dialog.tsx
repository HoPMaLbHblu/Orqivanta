'use client';

import * as D from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

export function DialogContent({ title, description, children, className, size = 'md', hideClose }: { title: ReactNode; description?: ReactNode; children?: ReactNode; className?: string; size?: 'sm' | 'md' | 'lg' | 'xl'; hideClose?: boolean }) {
  const width = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }[size];
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-40 bg-[var(--overlay)] animate-fade-in" />
      <D.Content
        className={cn('fixed top-[12vh] left-1/2 z-50 flex max-h-[80vh] w-[calc(100vw-2rem)] -translate-x-1/2 flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-pop animate-pop-in focus:outline-none', width, className)}
        aria-describedby={description ? undefined : undefined}
      >
        <div className="flex items-start justify-between gap-4 px-5 pt-5">
          <div className="min-w-0">
            <D.Title className="text-[16px] font-semibold text-ink">{title}</D.Title>
            {description ? <D.Description className="mt-1 text-[13px] text-ink-2">{description}</D.Description> : <D.Description className="sr-only">{typeof title === 'string' ? title : ''}</D.Description>}
          </div>
          {hideClose ? null : (
            <D.Close className="-mt-1 -mr-2 rounded-md p-1.5 text-ink-3 hover:bg-surface-2 hover:text-ink" aria-label="Close">
              <X className="size-4" />
            </D.Close>
          )}
        </div>
        <div className="min-h-0 overflow-y-auto px-5 pt-4 pb-5">{children}</div>
      </D.Content>
    </D.Portal>
  );
}

export function DialogFooter({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('mt-5 flex flex-wrap items-center justify-end gap-2', className)}>{children}</div>;
}

/** Side panel used for task details and filters. */
export function Sheet({ open, onOpenChange, title, children, width = 'max-w-2xl' }: { open: boolean; onOpenChange: (open: boolean) => void; title: ReactNode; children: ReactNode; width?: string }) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-40 bg-[var(--overlay)] animate-fade-in" />
        <D.Content className={cn('fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-line bg-surface shadow-pop animate-slide-in focus:outline-none', width)}>
          <D.Title className="sr-only">{title}</D.Title>
          <D.Description className="sr-only">{typeof title === 'string' ? title : ''}</D.Description>
          {children}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
