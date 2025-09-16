import Link from 'next/link';
import type { ReactNode } from 'react';
import { Container, Eyebrow } from './typography';

/** Rich-text tags shared by the legal pages. */
export const legalTags = {
  b: (chunks: ReactNode) => <strong className="font-medium text-ink">{chunks}</strong>,
  link: (chunks: ReactNode) => (
    <Link href="/contact" className="text-accent underline decoration-accent/40 underline-offset-4 hover:decoration-accent">
      {chunks}
    </Link>
  ),
};

export function LegalHeader({ eyebrow, title, lead, updated }: { eyebrow: string; title: string; lead: string; updated: string }) {
  return (
    <header className="border-b border-line pt-14 pb-12 sm:pt-20">
      <Container narrow>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className="mt-6 font-serif text-[42px] leading-[1.05] tracking-[-0.015em] text-ink sm:text-[54px]">{title}</h1>
        <p className="mt-6 text-[16.5px] leading-[1.7] text-ink-2">{lead}</p>
        <p className="mt-6 text-[13px] text-ink-3">{updated}</p>
      </Container>
    </header>
  );
}

export function LegalSection({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="border-b border-line py-9 last:border-0">
      <h2 className="flex gap-3 text-[19px] leading-snug font-medium text-ink">
        <span className="mt-1 font-mono text-[12px] text-ink-3">{String(n).padStart(2, '0')}</span>
        {title}
      </h2>
      <div className="mt-3 flex flex-col gap-3 pl-0 text-[15px] leading-[1.75] text-ink-2 sm:pl-[30px]">{children}</div>
    </section>
  );
}

export function LegalList({ children }: { children: ReactNode }) {
  return <ul className="flex flex-col gap-2.5">{children}</ul>;
}

export function LegalItem({ children }: { children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mt-[11px] h-px w-3 shrink-0 bg-line-strong" aria-hidden />
      <span>{children}</span>
    </li>
  );
}
