import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Check } from 'lucide-react';
import { LinkButton } from '@/components/marketing/link-button';
import { Container, headlineTags, PageIntro, SectionHeading } from '@/components/marketing/typography';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('marketing.pricing');
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
    alternates: { canonical: '/pricing' },
    openGraph: { title: `${t('metaTitle')} · Orqivanta`, description: t('metaDescription'), url: '/pricing' },
  };
}

const ITEMS = ['all', 'portal', 'people', 'reports', 'storage', 'export'] as const;
const FAQ = ['paid', 'ready', 'export', 'limits', 'tiers'] as const;

export default async function PricingPage() {
  const t = await getTranslations('marketing.pricing');
  return (
    <>
      <PageIntro eyebrow={t('eyebrow')} title={t.rich('title', headlineTags)} lead={t('lead')} />

      {/* One honest plan. No comparison table, because there is nothing to compare. */}
      <section className="border-y border-line">
        <Container className="py-16 sm:py-20">
          <div className="mx-auto max-w-[720px] rounded-xl border border-line bg-surface p-7 sm:p-10">
            <div className="flex flex-wrap items-baseline justify-between gap-4">
              <div>
                <p className="text-[12px] font-medium tracking-[0.16em] text-ink-3 uppercase">{t('planName')}</p>
                <p className="mt-3 font-serif text-[56px] leading-none text-ink">{t('price')}</p>
                <p className="mt-2 text-[14px] text-ink-3">{t('priceNote')}</p>
              </div>
              <div className="flex flex-col items-start gap-2">
                <LinkButton href="/sign-up" size="lg" variant="primary">
                  {t('cta')}
                </LinkButton>
                <p className="text-[12.5px] text-ink-3">{t('noCard')}</p>
              </div>
            </div>
            <h2 className="mt-10 border-t border-line pt-6 text-[12px] font-medium tracking-[0.16em] text-ink-3 uppercase">{t('includes')}</h2>
            <ul className="mt-5 grid gap-3 sm:grid-cols-2">
              {ITEMS.map((key) => (
                <li key={key} className="flex items-start gap-2.5 text-[14.5px] leading-[1.55] text-ink-2">
                  <Check className="mt-[3px] size-4 shrink-0 text-accent" aria-hidden />
                  {t(`items.${key}`)}
                </li>
              ))}
            </ul>
          </div>
        </Container>
      </section>

      <section>
        <Container className="py-16 sm:py-20" narrow>
          <SectionHeading title={t('faqTitle')} />
          <dl className="mt-10">
            {FAQ.map((key) => (
              <div key={key} className="border-t border-line py-6">
                <dt className="text-[16px] font-medium text-ink">{t(`faq.${key}.q`)}</dt>
                <dd className="mt-2.5 text-[15px] leading-[1.7] text-ink-2">{t(`faq.${key}.a`)}</dd>
              </div>
            ))}
          </dl>
        </Container>
      </section>
    </>
  );
}
