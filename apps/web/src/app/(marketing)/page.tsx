import Link from 'next/link';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { ArrowRight, ClipboardList, Inbox, PenLine, Stamp, Target } from 'lucide-react';
import { config } from '@orqivanta/core';
import { ClosingCta } from '@/components/marketing/cta';
import { ApprovalMock, BoardMock, DocumentMock, RequestTimelineMock } from '@/components/marketing/mockups';
import { Container, Eyebrow, headlineTags, Plate, Point, SectionHeading } from '@/components/marketing/typography';
import { LinkButton } from '@/components/marketing/link-button';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('marketing.home');
  return {
    // The home page carries the full brand line rather than the "%s · Orqivanta" template.
    title: { absolute: t('metaTitle') },
    description: t('metaDescription'),
    alternates: { canonical: '/' },
    openGraph: { title: t('metaTitle'), description: t('metaDescription'), url: '/' },
  };
}

const STEP_ICONS = { request: Inbox, plan: ClipboardList, make: PenLine, review: Stamp, report: Target } as const;

export default async function HomePage() {
  const [t, tc] = await Promise.all([getTranslations('marketing.home'), getTranslations('marketing')]);
  const demo = config.demoMode;
  const steps = ['request', 'plan', 'make', 'review', 'report'] as const;
  const principles = ['private', 'server', 'conflicts', 'access'] as const;

  return (
    <>
      {/* Hero: typography first, one illustration beside it. */}
      <section className="border-b border-line">
        <Container className="grid items-center gap-12 pt-14 pb-16 sm:pt-20 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-16 lg:pt-24 lg:pb-24">
          <div>
            <Eyebrow>{t('eyebrow')}</Eyebrow>
            <h1 className="mt-6 font-serif text-[46px] leading-[1.0] tracking-[-0.02em] text-balance text-ink sm:text-[68px] lg:text-[78px]">{t.rich('title', headlineTags)}</h1>
            <p className="mt-7 max-w-[54ch] text-[17px] leading-[1.6] text-pretty text-ink-2 sm:text-[19px]">{t('lead')}</p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <LinkButton href="/sign-up" size="lg" variant="primary">
                {t('ctaPrimary')}
                <ArrowRight />
              </LinkButton>
              {demo ? (
                <LinkButton href="/demo" size="lg" variant="secondary">{t('ctaDemo')}</LinkButton>
              ) : null}
            </div>
            <p className="mt-5 text-[13px] text-ink-3">{demo ? t('demoNote') : t('ctaFree')}</p>
          </div>
          <Plate>
            <BoardMock />
          </Plate>
        </Container>
      </section>

      {/* The delivery loop, as five steps. */}
      <section className="border-b border-line">
        <Container className="py-16 sm:py-24">
          <SectionHeading eyebrow={t('loopEyebrow')} title={t('loopTitle')} lead={t('loopLead')} />
          <ol className="mt-12 grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-5">
            {steps.map((key, i) => {
              const Icon = STEP_ICONS[key];
              return (
                <li key={key} className="flex flex-col bg-surface p-5">
                  <div className="flex items-center gap-2">
                    <Icon className="size-4 text-accent" aria-hidden />
                    <span className="font-mono text-[11px] text-ink-3">{String(i + 1).padStart(2, '0')}</span>
                  </div>
                  <h3 className="mt-4 text-[16px] font-medium text-ink">{t(`steps.${key}.title`)}</h3>
                  <p className="mt-2 text-[13.5px] leading-[1.6] text-ink-2">{t(`steps.${key}.body`)}</p>
                </li>
              );
            })}
          </ol>
        </Container>
      </section>

      {/* Approvals. */}
      <section className="border-b border-line">
        <Container className="grid items-center gap-12 py-16 sm:py-24 lg:grid-cols-2 lg:gap-20">
          <div>
            <SectionHeading eyebrow={t('approvals.eyebrow')} title={t('approvals.title')} lead={t('approvals.body')} />
            <ul className="mt-8 flex flex-col gap-3">
              <Point>{t('approvals.p1')}</Point>
              <Point>{t('approvals.p2')}</Point>
              <Point>{t('approvals.p3')}</Point>
            </ul>
          </div>
          <Plate className="lg:order-first">
            <ApprovalMock />
          </Plate>
        </Container>
      </section>

      {/* Client portal. */}
      <section className="border-b border-line">
        <Container className="grid items-center gap-12 py-16 sm:py-24 lg:grid-cols-2 lg:gap-20">
          <div>
            <SectionHeading eyebrow={t('portal.eyebrow')} title={t('portal.title')} lead={t('portal.body')} />
            <ul className="mt-8 flex flex-col gap-3">
              <Point>{t('portal.p1')}</Point>
              <Point>{t('portal.p2')}</Point>
              <Point>{t('portal.p3')}</Point>
            </ul>
            <Link href="/client-portal" className="mt-8 inline-flex items-center gap-1.5 text-[14px] font-medium text-accent underline decoration-accent/40 underline-offset-4 hover:decoration-accent">
              {t('portalLink')}
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
          <Plate>
            <RequestTimelineMock />
          </Plate>
        </Container>
      </section>

      {/* Tasks and documents. */}
      <section className="border-b border-line">
        <Container className="grid items-center gap-12 py-16 sm:py-24 lg:grid-cols-2 lg:gap-20">
          <div>
            <SectionHeading eyebrow={t('tasks.eyebrow')} title={t('tasks.title')} lead={t('tasks.body')} />
            <ul className="mt-8 flex flex-col gap-3">
              <Point>{t('tasks.p1')}</Point>
              <Point>{t('tasks.p2')}</Point>
              <Point>{t('tasks.p3')}</Point>
            </ul>
            <Link href="/product" className="mt-8 inline-flex items-center gap-1.5 text-[14px] font-medium text-accent underline decoration-accent/40 underline-offset-4 hover:decoration-accent">
              {tc('seeProduct')}
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
          <Plate className="lg:order-first">
            <DocumentMock />
          </Plate>
        </Container>
      </section>

      {/* Principles. */}
      <section>
        <Container className="py-16 sm:py-24">
          <SectionHeading eyebrow={t('principlesEyebrow')} title={t('principlesTitle')} />
          <dl className="mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            {principles.map((key) => (
              <div key={key}>
                <dt className="border-t border-line-strong pt-4 text-[16px] font-medium text-ink">{t(`principles.${key}.title`)}</dt>
                <dd className="mt-2 text-[14px] leading-[1.65] text-ink-2">{t(`principles.${key}.body`)}</dd>
              </div>
            ))}
          </dl>
        </Container>
      </section>

      <ClosingCta />
    </>
  );
}
