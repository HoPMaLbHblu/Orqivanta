import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

const base =
  'w-full rounded-md border border-line-strong bg-surface px-3 text-[14px] text-ink placeholder:text-ink-3 transition-colors duration-150 hover:border-ink-3 focus-visible:outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/25 disabled:opacity-60 aria-[invalid=true]:border-danger aria-[invalid=true]:ring-danger/20';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cn(base, 'h-9', className)} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cn(base, 'min-h-24 py-2 leading-relaxed', className)} {...rest} />;
});

export const NativeSelect = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function NativeSelect({ className, children, ...rest }, ref) {
  return (
    <select ref={ref} className={cn(base, 'h-9 appearance-none bg-[url("data:image/svg+xml,%3Csvg%20xmlns%3D%27http%3A//www.w3.org/2000/svg%27%20width%3D%2716%27%20height%3D%2716%27%20viewBox%3D%270%200%2024%2024%27%20fill%3D%27none%27%20stroke%3D%27%236f685d%27%20stroke-width%3D%272%27%3E%3Cpath%20d%3D%27m6%209%206%206%206-6%27/%3E%3C/svg%3E")] bg-[position:right_0.6rem_center] bg-no-repeat pr-8', className)} {...rest}>
      {children}
    </select>
  );
});
