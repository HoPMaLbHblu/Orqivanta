import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Bell, FileText, FolderKanban, Inbox, LayoutGrid, Minus, Paperclip, Search, Settings2, Stamp, BarChart3 } from 'lucide-react';
import { ClosingCta } from '@/components/marketing/cta';
import { BoardMock, DocumentMock } from '@/components/marketing/mockups';
import { Container, headlineTags, PageIntro, Plate, SectionHeading } from '@/components/marketing/typography';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('marketing.product');
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
    alternates: { canonical: '/product' },
    openGraph: { title: `${t('metaTitle')} · Orqivanta`, description: t('metaDescription'), url: '/product' },
  };
}

const MODULES = [
  { key: 'projects', icon: FolderKanban },
  { key: 'tasks', icon: LayoutGrid },
  { key: 'documents', icon: FileText },
  { key: 'files', icon: Paperclip },
  { key: 'requests', icon: Inbox },
  { key: 'approvals', icon: Stamp },
  { key: 'notifications', icon: Bell },
  { key: 'search', icon: Search },
  { key: 'reports', icon: BarChart3 },
  { key: 'admin', icon: Settings2 },
] as const;

const DETAILS = ['docs', 'keyboard', 'languages', 'live'] as const;
const LATER = ['billing', 'ai', 'sso', 'integrations', 'time', 'coedit', 'roles', 'public'] as const;

export default async function ProductPage() {
  const t = await getTranslations('marketing.product');
  return (
    <>
      <PageIntro eyebrow={t('eyebrow')} title={t.rich('title', headlineTags)} lead={t('lead')} />

      <section className="border-y border-line">
        <Container className="py-16 sm:py-20">
          <h2 className="font-serif text-[30px] leading-tight text-ink sm:text-[36px]">{t('modulesTitle')}</h2>
          <dl className="mt-10 grid gap-x-10 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
            {MODULES.map(({ key, icon: Icon }) => (
              <div key={key} className="border-t border-line pt-5">
                <dt className="flex items-center gap-2.5 text-[16px] font-medium text-ink">
                  <Icon className="size-4 text-accent" aria-hidden />
                  {t(`modules.${key}.title`)}
                </dt>
                <dd className="mt-2 text-[14px] leading-[1.65] text-ink-2">{t(`modules.${key}.body`)}</dd>
              </div>
            ))}
          </dl>
        </Container>
      </section>

      <section>
        <Container className="grid items-start gap-12 py-16 sm:py-24 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)] lg:gap-20">
          <div>
            <SectionHeading eyebrow={t('detailsEyebrow')} title={t('detailsTitle')} />
            <dl className="mt-10 grid gap-8 sm:grid-cols-2">
              {DETAILS.map((key) => (
                <div key={key}>
                  <dt className="text-[15px] font-medium text-ink">{t(`details.${key}.title`)}</dt>
                  <dd className="mt-2 text-[14px] leading-[1.65] text-ink-2">{t(`details.${key}.body`)}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="flex flex-col gap-6">
            <Plate>
              <BoardMock />
            </Plate>
            <Plate>
              <DocumentMock />
            </Plate>
          </div>
        </Container>
      </section>

      <section className="border-t border-line bg-surface">
        <Container className="py-16 sm:py-20">
          <SectionHeading title={t('laterTitle')} lead={t('laterLead')} />
          <ul className="mt-9 flex flex-wrap gap-2.5">
            {LATER.map((key) => (
              <li key={key} className="inline-flex items-center gap-2 rounded-full border border-line bg-surface-2 px-3.5 py-1.5 text-[13.5px] text-ink-3">
                <Minus className="size-3.5" aria-hidden />
                {t(`later.${key}`)}
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <ClosingCta />
    </>
  );
}
