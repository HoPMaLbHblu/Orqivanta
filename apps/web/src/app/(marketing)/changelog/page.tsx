import type { Metadata } from 'next';
import { getFormatter, getTranslations } from 'next-intl/server';
import { CHANGELOG, type ChangeTag } from '../../../../content/changelog';
import { Container, Eyebrow } from '@/components/marketing/typography';
import { cn } from '@/lib/cn';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('marketing.changelog');
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
    alternates: { canonical: '/changelog' },
    openGraph: { title: `${t('metaTitle')} · Orqivanta`, description: t('metaDescription'), url: '/changelog' },
  };
}

const TAG_CLASS: Record<ChangeTag, string> = {
  new: 'border-accent/25 bg-accent-soft text-accent',
  improved: 'border-info/25 bg-info-soft text-info',
  fixed: 'border-line bg-surface-2 text-ink-3',
};

export default async function ChangelogPage() {
  const t = await getTranslations('marketing.changelog');
  const format = await getFormatter();
  return (
    <>
      <header className="pt-14 pb-10 sm:pt-20">
        <Container>
          <Eyebrow>{t('eyebrow')}</Eyebrow>
          <h1 className="mt-6 font-serif text-[44px] leading-[1.02] tracking-[-0.015em] text-ink sm:text-[60px]">{t('title')}</h1>
          <p className="mt-6 max-w-[58ch] text-[16px] leading-[1.65] text-ink-2 sm:text-[17px]">{t('lead')}</p>
        </Container>
      </header>

      <Container className="pb-8">
        <ol className="border-t border-line">
          {CHANGELOG.map((entry) => (
            <li key={entry.version} className="grid gap-5 border-b border-line py-10 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-12">
              <div className="lg:pt-1">
                <time dateTime={entry.date} className="block text-[13px] text-ink-3">
                  {format.dateTime(new Date(`${entry.date}T12:00:00Z`), { day: 'numeric', month: 'long', year: 'numeric' })}
                </time>
                <p className="mt-1 font-mono text-[12px] text-ink-3">{t('version', { version: entry.version })}</p>
              </div>
              <div>
                <h2 className="font-serif text-[27px] leading-tight text-ink sm:text-[32px]">{entry.title}</h2>
                <p className="mt-3 max-w-[62ch] text-[15px] leading-[1.7] text-ink-2">{entry.summary}</p>
                <ul className="mt-6 flex flex-col gap-3">
                  {entry.changes.map((c) => (
                    <li key={c.text} className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                      <span className={cn('inline-flex h-[20px] shrink-0 items-center rounded-full border px-2 text-[11px] font-medium', TAG_CLASS[c.tag])}>{t(`tags.${c.tag}`)}</span>
                      <span className="min-w-0 flex-1 text-[14.5px] leading-[1.6] text-ink-2">{c.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </li>
          ))}
        </ol>
      </Container>
    </>
  );
}
