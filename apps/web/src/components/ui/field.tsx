'use client';

import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from 'react';
import { CircleAlert } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * Label, hint and error around one control. Wires up htmlFor, aria-describedby and
 * aria-invalid so screen readers announce the hint and the error with the field.
 */
export function Field({ label, hint, error, optional, children, className, labelHidden }: { label: ReactNode; hint?: ReactNode; error?: string | null; optional?: string; children: ReactElement; className?: string; labelHidden?: boolean }) {
  const id = useId();
  const childId = (children.props as { id?: string }).id ?? id;
  const hintId = hint ? `${childId}-hint` : undefined;
  const errorId = error ? `${childId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={childId} className={cn('text-[13px] font-medium text-ink', labelHidden && 'sr-only')}>
        {label}
        {optional ? <span className="ml-1.5 font-normal text-ink-3">{optional}</span> : null}
      </label>
      {isValidElement(children) ? cloneElement(children as ReactElement<Record<string, unknown>>, { id: childId, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined }) : children}
      {hint && !error ? (
        <p id={hintId} className="text-[12px] text-ink-3">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="flex items-start gap-1 text-[12px] text-danger" role="alert">
          <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div role="alert" className="flex items-start gap-2 rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-[13px] text-danger">
      <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{message}</span>
    </div>
  );
}
