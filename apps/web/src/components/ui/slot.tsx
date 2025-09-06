import { cloneElement, forwardRef, isValidElement, type HTMLAttributes, type ReactElement } from 'react';
import { cn } from '@/lib/cn';

/** Minimal asChild support: merges props and class names onto the single child element. */
export const Slot = forwardRef<HTMLElement, HTMLAttributes<HTMLElement> & { children?: React.ReactNode }>(function Slot({ children, className, ...rest }, ref) {
  if (!isValidElement(children)) return null;
  const child = children as ReactElement<Record<string, unknown>>;
  const childProps = child.props as { className?: string; children?: React.ReactNode };
  return cloneElement(child, { ...rest, ...child.props, ref, className: cn(className, childProps.className) });
});
