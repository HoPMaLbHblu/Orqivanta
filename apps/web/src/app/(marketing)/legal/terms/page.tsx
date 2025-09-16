import type { Metadata } from 'next';
import { getFormatter, getTranslations } from 'next-intl/server';
import { LegalHeader, LegalItem, LegalList, LegalSection, legalTags } from '@/components/marketing/legal';
import { Container } from '@/components/marketing/typography';

const UPDATED = '2025-10-05';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('legal.terms');
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
    alternates: { canonical: '/legal/terms' },
    openGraph: { title: `${t('metaTitle')} · Orqivanta`, description: t('metaDescription'), url: '/legal/terms' },
  };
}

const ACCEPTABLE = ['law', 'harm', 'access', 'disclose'] as const;
const PLAIN = ['using', 'content'] as const;
const PLAIN_TAIL = ['preview', 'fees', 'liability', 'ending', 'changes'] as const;

export default async function TermsPage() {
  const [t, tl, format] = await Promise.all([getTranslations('legal.terms'), getTranslations('legal'), getFormatter()]);
  const updated = tl('updated', { date: format.dateTime(new Date(`${UPDATED}T12:00:00Z`), { day: 'numeric', month: 'long', year: 'numeric' }) });
  let n = 0;
  return (
    <>
      <LegalHeader eyebrow={t('eyebrow')} title={t('title')} lead={t('lead')} updated={updated} />
      <Container narrow className="pb-16">
        {PLAIN.map((key) => (
          <LegalSection key={key} n={++n} title={t(`sections.${key}.title`)}>
            <p>{t(`sections.${key}.body`)}</p>
          </LegalSection>
        ))}
        <LegalSection n={++n} title={t('sections.acceptable.title')}>
          <LegalList>
            {ACCEPTABLE.map((key) => (
              <LegalItem key={key}>{t(`sections.acceptable.items.${key}`)}</LegalItem>
            ))}
          </LegalList>
        </LegalSection>
        {PLAIN_TAIL.map((key) => (
          <LegalSection key={key} n={++n} title={t(`sections.${key}.title`)}>
            <p>{t(`sections.${key}.body`)}</p>
          </LegalSection>
        ))}
        <LegalSection n={++n} title={t('sections.contact.title')}>
          <p>{t.rich('sections.contact.body', legalTags)}</p>
        </LegalSection>
      </Container>
    </>
  );
}
