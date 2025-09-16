import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { config } from '@orqivanta/core';
import { LinkButton } from '@/components/marketing/link-button';
import { Container } from './typography';

/** Closing invitation, shared by most public pages. Honest about the demo being fictional. */
export async function ClosingCta({ title, body }: { title?: string; body?: string }) {
  const t = await getTranslations('marketing');
  const demo = config.demoMode;
  return (
    <section className="border-y border-line bg-surface-2">
      <Container className="py-16 sm:py-20">
        <div className="max-w-[640px]">
          <h2 className="font-serif text-[34px] leading-[1.08] tracking-[-0.01em] text-balance text-ink sm:text-[42px]">{title ?? t('home.closingTitle')}</h2>
          <p className="mt-5 text-[16px] leading-[1.65] text-pretty text-ink-2">{body ?? (demo ? t('home.closingBody') : t('home.closingBodyNoDemo'))}</p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            {demo ? (
              <>
                <LinkButton href="/demo" size="lg" variant="primary">{t('home.ctaDemo')}</LinkButton>
                <LinkButton href="/sign-up" size="lg" variant="secondary">{t('home.closingSecondary')}</LinkButton>
              </>
            ) : (
              <LinkButton href="/sign-up" size="lg" variant="primary">{t('home.closingSecondary')}</LinkButton>
            )}
          </div>
          <p className="mt-4 text-[13px] text-ink-3">{demo ? t('home.demoNote') : t('home.ctaFree')}</p>
        </div>
      </Container>
    </section>
  );
}
