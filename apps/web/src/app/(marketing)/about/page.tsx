import Link from 'next/link';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { LogoMark } from '@/components/brand';
import { ClosingCta } from '@/components/marketing/cta';
import { Container, headlineTags, PageIntro, SectionHeading } from '@/components/marketing/typography';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('marketing.about');
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
    alternates: { canonical: '/about' },
    openGraph: { title: `${t('metaTitle')} · Orqivanta`, description: t('metaDescription'), url: '/about' },
  };
}

const PRINCIPLES = ['calm', 'honest', 'private', 'everyone'] as const;
const STACK = ['next', 'pg', 'drizzle', 'jobs', 'sse', 'ui'] as const;

export default async function AboutPage() {
  const t = await getTranslations('marketing.about');
  return (
    <>
      <PageIntro eyebrow={t('eyebrow')} title={t.rich('title', headlineTags)} />

      <section className="border-y border-line">
        <Container className="py-16 sm:py-20" narrow>
          <div className="flex flex-col gap-6 text-[17px] leading-[1.75] text-ink-2">
            <p className="first-letter:float-left first-letter:mt-1 first-letter:mr-2.5 first-letter:font-serif first-letter:text-[58px] first-letter:leading-[0.8] first-letter:text-ink">
              {t('p1')}
            </p>
            <p>{t('p2')}</p>
            <p>{t('p3')}</p>
          </div>
        </Container>
      </section>

      <section>
        <Container className="py-16 sm:py-20">
          <SectionHeading title={t('principlesTitle')} />
          <dl className="mt-10 grid gap-9 sm:grid-cols-2 lg:grid-cols-4">
            {PRINCIPLES.map((key) => (
              <div key={key} className="border-t border-line-strong pt-4">
                <dt className="text-[16px] font-medium text-ink">{t(`principles.${key}.title`)}</dt>
                <dd className="mt-2 text-[14px] leading-[1.65] text-ink-2">{t(`principles.${key}.body`)}</dd>
              </div>
            ))}
          </dl>
        </Container>
      </section>

      <section className="border-t border-line bg-surface">
        <Container className="py-16 sm:py-20">
          <SectionHeading title={t('stackTitle')} lead={t('stackLead')} />
          <dl className="mt-10 grid gap-x-10 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
            {STACK.map((key) => (
              <div key={key} className="border-t border-line pt-4">
                <dt className="text-[15px] font-medium text-ink">{t(`stack.${key}.name`)}</dt>
                <dd className="mt-1 text-[13.5px] leading-[1.6] text-ink-3">{t(`stack.${key}.body`)}</dd>
              </div>
            ))}
          </dl>
        </Container>
      </section>

      <section>
        <Container className="py-16 sm:py-20" narrow>
          <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:gap-10">
            <LogoMark className="size-16 shrink-0" />
            <div>
              <h2 className="font-serif text-[28px] leading-tight text-ink">{t('nameTitle')}</h2>
              <p className="mt-3 text-[15px] leading-[1.7] text-ink-2">{t('nameBody')}</p>
              <p className="mt-4 text-[15px] text-ink-2">
                {t.rich('contactLine', {
                  link: (chunks) => (
                    <Link href="/contact" className="text-accent underline decoration-accent/40 underline-offset-4 hover:decoration-accent">
                      {chunks}
                    </Link>
                  ),
                })}
              </p>
            </div>
          </div>
        </Container>
      </section>

      <ClosingCta />
    </>
  );
}
