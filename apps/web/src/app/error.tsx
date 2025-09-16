'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Logo } from '@/components/brand';
import { Button } from '@/components/ui/button';
import { Container } from '@/components/marketing/typography';

/** Recoverable server or render failure anywhere in the app. Retry re-runs the segment. */
export default function GlobalRouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations('errors.error');

  useEffect(() => {
    console.error('[error boundary]', error);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      <div className="border-b border-line">
        <Container className="flex h-16 items-center">
          <Logo />
        </Container>
      </div>
      <main className="flex flex-1 items-center">
        <Container narrow className="py-20">
          <p className="font-mono text-[13px] tracking-[0.12em] text-ink-3 uppercase">{t('eyebrow')}</p>
          <h1 className="mt-5 font-serif text-[44px] leading-[1.05] tracking-[-0.015em] text-ink sm:text-[60px]">{t('title')}</h1>
          <p className="mt-6 max-w-[52ch] text-[16.5px] leading-[1.7] text-ink-2">{t('body')}</p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Button size="lg" variant="primary" onClick={reset}>
              {t('retry')}
            </Button>
            <Link
              href="/"
              className="inline-flex h-11 items-center rounded-lg border border-line-strong bg-surface px-5 text-[15px] font-medium text-ink transition-colors hover:bg-surface-2"
            >
              {t('home')}
            </Link>
          </div>
          {error.digest ? <p className="mt-8 font-mono text-[12px] text-ink-3">{t('reference', { digest: error.digest })}</p> : null}
        </Container>
      </main>
    </div>
  );
}
