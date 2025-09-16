import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Download, EyeOff, Inbox, Megaphone, Stamp } from 'lucide-react';
import { ClosingCta } from '@/components/marketing/cta';
import { ApprovalMock, RequestTimelineMock } from '@/components/marketing/mockups';
import { Container, headlineTags, PageIntro, Plate, SectionHeading } from '@/components/marketing/typography';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('marketing.portal');
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
    alternates: { canonical: '/client-portal' },
    openGraph: { title: `${t('metaTitle')} · Orqivanta`, description: t('metaDescription'), url: '/client-portal' },
  };
}

const DO = [
  { key: 'requests', icon: Inbox },
  { key: 'approve', icon: Stamp },
  { key: 'deliverables', icon: Download },
  { key: 'updates', icon: Megaphone },
] as const;

const HIDDEN = ['comments', 'tasks', 'unshared', 'others'] as const;

export default async function ClientPortalPage() {
  const t = await getTranslations('marketing.portal');
  return (
    <>
      <PageIntro eyebrow={t('eyebrow')} title={t.rich('title', headlineTags)} lead={t('lead')} />

      <section className="border-y border-line">
        <Container className="grid items-start gap-12 py-16 sm:py-20 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-20">
          <div>
            <h2 className="font-serif text-[30px] leading-tight text-ink sm:text-[36px]">{t('doTitle')}</h2>
            <dl className="mt-9 grid gap-8 sm:grid-cols-2">
              {DO.map(({ key, icon: Icon }) => (
                <div key={key} className="border-t border-line pt-5">
                  <dt className="flex items-center gap-2.5 text-[16px] font-medium text-ink">
                    <Icon className="size-4 text-accent" aria-hidden />
                    {t(`do.${key}.title`)}
                  </dt>
                  <dd className="mt-2 text-[14px] leading-[1.65] text-ink-2">{t(`do.${key}.body`)}</dd>
                </div>
              ))}
            </dl>
          </div>
          <Plate>
            <RequestTimelineMock />
          </Plate>
        </Container>
      </section>

      <section>
        <Container className="grid items-center gap-12 py-16 sm:py-24 lg:grid-cols-2 lg:gap-20">
          <div>
            <SectionHeading eyebrow={t('internalEyebrow')} title={t('internalTitle')} lead={t('internalBody')} />
            <ul className="mt-8 flex flex-col gap-2.5">
              {HIDDEN.map((key) => (
                <li key={key} className="flex items-center gap-2.5 rounded-md border border-line bg-surface px-3.5 py-2.5 text-[14px] text-ink-2">
                  <EyeOff className="size-4 shrink-0 text-ink-3" aria-hidden />
                  {t(`internal.${key}`)}
                </li>
              ))}
            </ul>
          </div>
          <Plate className="lg:order-first">
            <ApprovalMock />
          </Plate>
        </Container>
      </section>

      <section className="border-t border-line bg-surface">
        <Container className="grid gap-12 py-16 sm:py-20 md:grid-cols-2 md:gap-16">
          <div>
            <h2 className="font-serif text-[28px] leading-tight text-ink sm:text-[32px]">{t('previewTitle')}</h2>
            <p className="mt-4 text-[15px] leading-[1.7] text-ink-2">{t('previewBody')}</p>
          </div>
          <div>
            <h2 className="font-serif text-[28px] leading-tight text-ink sm:text-[32px]">{t('joinTitle')}</h2>
            <p className="mt-4 text-[15px] leading-[1.7] text-ink-2">{t('joinBody')}</p>
          </div>
        </Container>
      </section>

      <ClosingCta />
    </>
  );
}
