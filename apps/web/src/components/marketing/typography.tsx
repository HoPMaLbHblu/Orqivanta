import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** Page width for the public site: 16px gutters on phones, roomier on larger screens. */
export function Container({ children, className, narrow }: { children: ReactNode; className?: string; narrow?: boolean }) {
  return <div className={cn('mx-auto w-full px-4 sm:px-8', narrow ? 'max-w-[760px]' : 'max-w-[1160px]', className)}>{children}</div>;
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn('flex items-center gap-2.5 text-[12px] font-medium tracking-[0.16em] text-ink-3 uppercase', className)}>
      <span className="h-px w-6 bg-accent" aria-hidden />
      {children}
    </p>
  );
}

/** Rich-text tags for headline strings: <em> becomes the one italic, accent-coloured moment. */
export const headlineTags = {
  em: (chunks: ReactNode) => <em className="text-accent italic">{chunks}</em>,
};

export function PageIntro({ eyebrow, title, lead, children, className }: { eyebrow: ReactNode; title: ReactNode; lead?: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <header className={cn('pt-14 pb-12 sm:pt-24 sm:pb-16', className)}>
      <Container>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className="mt-6 max-w-[16ch] font-serif text-[44px] leading-[1.02] tracking-[-0.015em] text-balance text-ink sm:text-[64px] lg:text-[76px]">{title}</h1>
        {lead ? <p className="mt-7 max-w-[60ch] text-[17px] leading-[1.6] text-pretty text-ink-2 sm:text-[19px]">{lead}</p> : null}
        {children}
      </Container>
    </header>
  );
}

export function SectionHeading({ eyebrow, title, lead, className, id }: { eyebrow?: ReactNode; title: ReactNode; lead?: ReactNode; className?: string; id?: string }) {
  return (
    <div className={cn('max-w-[720px]', className)}>
      {eyebrow ? <Eyebrow className="mb-5">{eyebrow}</Eyebrow> : null}
      <h2 id={id} className="font-serif text-[34px] leading-[1.08] tracking-[-0.01em] text-balance text-ink sm:text-[44px]">
        {title}
      </h2>
      {lead ? <p className="mt-5 max-w-[58ch] text-[16px] leading-[1.65] text-pretty text-ink-2 sm:text-[17px]">{lead}</p> : null}
    </div>
  );
}

/** A calm, numbered or bulleted list item with a small accent tick. */
export function Point({ children }: { children: ReactNode }) {
  return (
    <li className="flex gap-3 text-[15px] leading-[1.55] text-ink-2">
      <span className="mt-[9px] h-px w-3 shrink-0 bg-accent" aria-hidden />
      <span>{children}</span>
    </li>
  );
}

/** Frame that holds a decorative product illustration, with an honest caption. */
export function Plate({ children, caption, className }: { children: ReactNode; caption?: string; className?: string }) {
  return (
    <figure className={cn('m-0', className)}>
      <div aria-hidden className="relative overflow-hidden rounded-xl border border-line bg-surface-2 p-3 sm:p-5">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(var(--line-strong)_0.8px,transparent_0.8px)] [background-size:18px_18px] opacity-50" />
        <div className="relative">{children}</div>
      </div>
      {caption ? <figcaption className="mt-3 text-[12px] text-ink-3">{caption}</figcaption> : null}
    </figure>
  );
}
