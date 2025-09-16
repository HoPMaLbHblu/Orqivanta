import Link from 'next/link';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { ContactForm } from '@/components/marketing/contact-form';
import { Container, Eyebrow, headlineTags } from '@/components/marketing/typography';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('marketing.contact');
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
    alternates: { canonical: '/contact' },
    openGraph: { title: `${t('metaTitle')} · Orqivanta`, description: t('metaDescription'), url: '/contact' },
  };
}

export default async function ContactPage() {
  const t = await getTranslations('marketing.contact');
  return (
    <Container className="grid gap-12 pt-14 pb-20 sm:pt-20 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)] lg:gap-20">
      <div>
        <Eyebrow>{t('eyebrow')}</Eyebrow>
        <h1 className="mt-6 font-serif text-[44px] leading-[1.02] tracking-[-0.015em] text-ink sm:text-[58px]">{t.rich('title', headlineTags)}</h1>
        <p className="mt-6 max-w-[48ch] text-[17px] leading-[1.65] text-ink-2">{t('lead')}</p>
        <dl className="mt-10 flex flex-col">
          {[
            { key: 'expect', body: <>{t('expectBody')}</> },
            {
              key: 'stored',
              body: t.rich('storedBody', {
                link: (chunks) => (
                  <Link href="/legal/privacy" className="text-accent underline decoration-accent/40 underline-offset-4 hover:decoration-accent">
                    {chunks}
                  </Link>
                ),
              }),
            },
            { key: 'security', body: <>{t('securityBody')}</> },
          ].map((item) => (
            <div key={item.key} className="border-t border-line py-5">
              <dt className="text-[15px] font-medium text-ink">{t(`${item.key}Title`)}</dt>
              <dd className="mt-1.5 max-w-[50ch] text-[14px] leading-[1.65] text-ink-2">{item.body}</dd>
            </div>
          ))}
        </dl>
      </div>
      <ContactForm />
    </Container>
  );
}
