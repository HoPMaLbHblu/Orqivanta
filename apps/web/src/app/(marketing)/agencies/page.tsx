import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { ClosingCta } from '@/components/marketing/cta';
import { BoardMock } from '@/components/marketing/mockups';
import { Container, headlineTags, PageIntro, Plate, SectionHeading } from '@/components/marketing/typography';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('marketing.agencies');
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
    alternates: { canonical: '/agencies' },
    openGraph: { title: `${t('metaTitle')} · Orqivanta`, description: t('metaDescription'), url: '/agencies' },
  };
}

const PAIRS = ['feedback', 'version', 'status', 'access'] as const;
const ROLES = [
  { key: 'owner', scope: 'scopeOrg' },
  { key: 'admin', scope: 'scopeOrg' },
  { key: 'member', scope: 'scopeOrg' },
  { key: 'manager', scope: 'scopeProject' },
  { key: 'contributor', scope: 'scopeProject' },
  { key: 'viewer', scope: 'scopeProject' },
  { key: 'client', scope: 'scopeClient' },
] as const;
const WEEK = ['org', 'template', 'team', 'client', 'share'] as const;

export default async function AgenciesPage() {
  const t = await getTranslations('marketing.agencies');
  return (
    <>
      <PageIntro eyebrow={t('eyebrow')} title={t.rich('title', headlineTags)} lead={t('lead')} />

      <section className="border-y border-line">
        <Container className="py-16 sm:py-20">
          <h2 className="font-serif text-[30px] leading-tight text-ink sm:text-[36px]">{t('pairsTitle')}</h2>
          <ul className="mt-10 grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2">
            {PAIRS.map((key) => (
              <li key={key} className="bg-surface p-6 sm:p-7">
                <p className="font-serif text-[22px] leading-snug text-ink-3">“{t(`pairs.${key}.problem`)}”</p>
                <p className="mt-4 border-t border-line pt-4 text-[14.5px] leading-[1.65] text-ink-2">{t(`pairs.${key}.answer`)}</p>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <section>
        <Container className="py-16 sm:py-24">
          <SectionHeading eyebrow={t('rolesEyebrow')} title={t('rolesTitle')} lead={t('rolesLead')} />
          <div className="mt-10 overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[640px] border-collapse text-left">
              <caption className="sr-only">{t('rolesCaption')}</caption>
              <thead>
                <tr className="border-b border-line bg-surface-2 text-[12px] tracking-[0.1em] text-ink-3 uppercase">
                  <th scope="col" className="px-4 py-3 font-medium">
                    {t('roleCol')}
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    {t('scopeCol')}
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    {t('canCol')}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-surface">
                {ROLES.map((r) => (
                  <tr key={r.key} className="border-b border-line last:border-0">
                    <th scope="row" className="px-4 py-3.5 align-top text-[14px] font-medium whitespace-nowrap text-ink">
                      {t(`roles.${r.key}.name`)}
                    </th>
                    <td className="px-4 py-3.5 align-top text-[13.5px] whitespace-nowrap text-ink-3">{t(r.scope)}</td>
                    <td className="px-4 py-3.5 align-top text-[14px] leading-[1.6] text-ink-2">{t(`roles.${r.key}.can`)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Container>
      </section>

      <section className="border-t border-line bg-surface">
        <Container className="grid items-start gap-12 py-16 sm:py-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)] lg:gap-20">
          <div>
            <SectionHeading eyebrow={t('weekEyebrow')} title={t('weekTitle')} />
            <ol className="mt-10 flex flex-col">
              {WEEK.map((key, i) => (
                <li key={key} className="flex gap-5 border-t border-line py-5">
                  <span className="mt-0.5 font-mono text-[12px] text-ink-3">{String(i + 1).padStart(2, '0')}</span>
                  <div>
                    <h3 className="text-[16px] font-medium text-ink">{t(`week.${key}.title`)}</h3>
                    <p className="mt-1.5 max-w-[52ch] text-[14px] leading-[1.65] text-ink-2">{t(`week.${key}.body`)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <Plate className="lg:sticky lg:top-24">
            <BoardMock />
          </Plate>
        </Container>
      </section>

      <ClosingCta />
    </>
  );
}
