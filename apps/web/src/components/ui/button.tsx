import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Slot } from './slot';
import { Spinner } from './spinner';
import { cn } from '@/lib/cn';

const variants = {
  primary: 'bg-accent text-accent-ink hover:bg-accent-hover border border-transparent',
  secondary: 'bg-surface text-ink border border-line-strong hover:bg-surface-2',
  ghost: 'bg-transparent text-ink-2 hover:bg-surface-2 hover:text-ink border border-transparent',
  danger: 'bg-danger text-white hover:opacity-90 border border-transparent dark:text-[#1e1b18]',
  'danger-ghost': 'bg-transparent text-danger hover:bg-danger-soft border border-transparent',
  link: 'bg-transparent text-accent underline-offset-2 hover:underline border-0 px-0 h-auto',
} as const;

const sizes = {
  xs: 'h-7 px-2 text-[12px] gap-1 rounded-sm',
  sm: 'h-8 px-2.5 text-[13px] gap-1.5 rounded-md',
  md: 'h-9 px-3.5 text-[14px] gap-2 rounded-md',
  lg: 'h-11 px-5 text-[15px] gap-2 rounded-lg',
  icon: 'h-8 w-8 justify-center rounded-md',
  'icon-sm': 'h-7 w-7 justify-center rounded-sm',
} as const;

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  loading?: boolean;
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', loading, asChild, className, children, disabled, type, ...rest },
  ref,
) {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp
      ref={ref}
      type={asChild ? undefined : (type ?? 'button')}
      disabled={asChild ? undefined : disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex shrink-0 select-none items-center font-medium whitespace-nowrap transition-colors duration-150 disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {loading ? <Spinner className="size-4" /> : null}
      {children}
    </Comp>
  );
});
