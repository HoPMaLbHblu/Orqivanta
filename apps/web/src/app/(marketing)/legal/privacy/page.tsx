import type { Metadata } from 'next';
import { getFormatter, getTranslations } from 'next-intl/server';
import { LegalHeader, LegalItem, LegalList, LegalSection, legalTags } from '@/components/marketing/legal';
import { Container } from '@/components/marketing/typography';

/** Set when the wording last changed. Shown to readers, so it isn't a build timestamp. */
const UPDATED = '2025-10-05';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('legal.privacy');
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
    alternates: { canonical: '/legal/privacy' },
    openGraph: { title: `${t('metaTitle')} · Orqivanta`, description: t('metaDescription'), url: '/legal/privacy' },
  };
}

const COLLECT = ['account', 'content', 'sessions', 'audit', 'limits', 'email', 'contact'] as const;
const RETENTION = ['sessions', 'deleted', 'audit', 'contact'] as const;
const CHOICES = ['export', 'sessions', 'prefs', 'delete'] as const;

export default async function PrivacyPage() {
  const [t, tl, format] = await Promise.all([getTranslations('legal.privacy'), getTranslations('legal'), getFormatter()]);
  const updated = tl('updated', { date: format.dateTime(new Date(`${UPDATED}T12:00:00Z`), { day: 'numeric', month: 'long', year: 'numeric' }) });
  return (
    <>
      <LegalHeader eyebrow={t('eyebrow')} title={t('title')} lead={t('lead')} updated={updated} />
      <Container narrow className="pb-16">
        <LegalSection n={1} title={t('sections.collect.title')}>
          <LegalList>
            {COLLECT.map((key) => (
              <LegalItem key={key}>{t.rich(`sections.collect.items.${key}`, legalTags)}</LegalItem>
            ))}
          </LegalList>
        </LegalSection>
        <LegalSection n={2} title={t('sections.cookies.title')}>
          <p>{t('sections.cookies.body')}</p>
        </LegalSection>
        <LegalSection n={3} title={t('sections.dont.title')}>
          <p>{t('sections.dont.body')}</p>
        </LegalSection>
        <LegalSection n={4} title={t('sections.access.title')}>
          <p>{t('sections.access.body')}</p>
        </LegalSection>
        <LegalSection n={5} title={t('sections.where.title')}>
          <p>{t('sections.where.body')}</p>
        </LegalSection>
        <LegalSection n={6} title={t('sections.retention.title')}>
          <LegalList>
            {RETENTION.map((key) => (
              <LegalItem key={key}>{t(`sections.retention.items.${key}`)}</LegalItem>
            ))}
          </LegalList>
        </LegalSection>
        <LegalSection n={7} title={t('sections.choices.title')}>
          <LegalList>
            {CHOICES.map((key) => (
              <LegalItem key={key}>{t.rich(`sections.choices.items.${key}`, legalTags)}</LegalItem>
            ))}
          </LegalList>
        </LegalSection>
        <LegalSection n={8} title={t('sections.demo.title')}>
          <p>{t('sections.demo.body')}</p>
        </LegalSection>
        <LegalSection n={9} title={t('sections.changes.title')}>
          <p>{t('sections.changes.body')}</p>
        </LegalSection>
        <LegalSection n={10} title={t('sections.contact.title')}>
          <p>{t.rich('sections.contact.body', legalTags)}</p>
        </LegalSection>
      </Container>
    </>
  );
}
