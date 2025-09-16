import Link from 'next/link';
import type { Metadata } from 'next';
import { getFormatter, getTranslations } from 'next-intl/server';
import { AlertTriangle, Check } from 'lucide-react';
import { Container, Eyebrow } from '@/components/marketing/typography';

const REVIEWED = '2025-10-05';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('marketing.accessibility');
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
    alternates: { canonical: '/accessibility' },
    openGraph: { title: `${t('metaTitle')} · Orqivanta`, description: t('metaDescription'), url: '/accessibility' },
  };
}

const DO = ['semantic', 'keyboard', 'focus', 'labels', 'colour', 'motion', 'charts', 'reflow'] as const;
const LIMITS = ['editor', 'files', 'live', 'ru'] as const;

export default async function AccessibilityPage() {
  const [t, format] = await Promise.all([getTranslations('marketing.accessibility'), getFormatter()]);
  return (
    <>
      <header className="border-b border-line pt-14 pb-12 sm:pt-20">
        <Container narrow>
          <Eyebrow>{t('eyebrow')}</Eyebrow>
          <h1 className="mt-6 font-serif text-[42px] leading-[1.05] tracking-[-0.015em] text-ink sm:text-[54px]">{t('title')}</h1>
          <p className="mt-6 text-[16.5px] leading-[1.7] text-ink-2">{t('lead')}</p>
          <p className="mt-6 text-[13px] text-ink-3">{t('updated', { date: format.dateTime(new Date(`${REVIEWED}T12:00:00Z`), { day: 'numeric', month: 'long', year: 'numeric' }) })}</p>
        </Container>
      </header>

      <Container narrow className="pb-16">
        <section className="border-b border-line py-9">
          <h2 className="text-[19px] font-medium text-ink">{t('targetTitle')}</h2>
          <p className="mt-3 text-[15px] leading-[1.75] text-ink-2">{t('targetBody')}</p>
        </section>

        <section className="border-b border-line py-9">
          <h2 className="text-[19px] font-medium text-ink">{t('doTitle')}</h2>
          <ul className="mt-4 flex flex-col gap-2.5">
            {DO.map((key) => (
              <li key={key} className="flex gap-2.5 text-[15px] leading-[1.7] text-ink-2">
                <Check className="mt-[5px] size-4 shrink-0 text-accent" aria-hidden />
                {t(`do.${key}`)}
              </li>
            ))}
          </ul>
        </section>

        <section className="border-b border-line py-9">
          <h2 className="text-[19px] font-medium text-ink">{t('testTitle')}</h2>
          <p className="mt-3 text-[15px] leading-[1.75] text-ink-2">{t('testBody')}</p>
        </section>

        <section className="border-b border-line py-9">
          <h2 className="text-[19px] font-medium text-ink">{t('limitsTitle')}</h2>
          <ul className="mt-4 flex flex-col gap-2.5">
            {LIMITS.map((key) => (
              <li key={key} className="flex gap-2.5 text-[15px] leading-[1.7] text-ink-2">
                <AlertTriangle className="mt-[5px] size-4 shrink-0 text-attention" aria-hidden />
                {t(`limits.${key}`)}
              </li>
            ))}
          </ul>
        </section>

        <section className="py-9">
          <h2 className="text-[19px] font-medium text-ink">{t('reportTitle')}</h2>
          <p className="mt-3 text-[15px] leading-[1.75] text-ink-2">
            {t.rich('reportBody', {
              link: (chunks) => (
                <Link href="/contact" className="text-accent underline decoration-accent/40 underline-offset-4 hover:decoration-accent">
                  {chunks}
                </Link>
              ),
            })}
          </p>
        </section>
      </Container>
    </>
  );
}
