import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Mail, MailWarning } from 'lucide-react';
import { config, getDevEmail, listDevEmails } from '@orqivanta/core';
import { Badge } from '@/components/domain/badges';
import { FormattedDate, RelativeTime } from '@/components/domain/dates';
import { Logo } from '@/components/brand';
import { EmptyState, Notice } from '@/components/ui/primitives';
import { cn } from '@/lib/cn';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  const t = await getTranslations('mailbox');
  return { title: t('title'), robots: { index: false, follow: false } };
}

/** Development mailbox: a copy of every outgoing email. Only exists when DEMO_MODE is on. */
export default async function DevMailbox({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  if (!config.demoMode) notFound();
  const { id } = await searchParams;
  const t = await getTranslations('mailbox');
  const emails = await listDevEmails(100);
  const selected = id ? await getDevEmail(id) : emails[0] ? await getDevEmail(emails[0].id) : null;

  return (
    <div className="min-h-dvh bg-paper">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Logo />
            <span className="text-[13px] font-medium text-ink-2">{t('title')}</span>
          </div>
          <Badge tone="attention" icon={MailWarning}>
            {t('devOnly')}
          </Badge>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6">
        <p className="max-w-2xl text-[13px] text-ink-2">{t('description')}</p>
        {emails.length ? (
          <div className="mt-5 grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
            <nav aria-label={t('listLabel')} className="max-h-[70vh] overflow-y-auto rounded-lg border border-line bg-surface">
              <ul className="divide-y divide-line">
                {emails.map((e) => (
                  <li key={e.id}>
                    <Link href={`/dev/mailbox?id=${e.id}`} aria-current={selected?.id === e.id ? 'page' : undefined} className={cn('block px-3 py-2.5 hover:bg-surface-2', selected?.id === e.id && 'bg-surface-2')}>
                      <span className="block truncate text-[13px] font-medium text-ink">{e.subject}</span>
                      <span className="block truncate text-[12px] text-ink-3">{e.to}</span>
                      <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-ink-3">
                        <RelativeTime date={e.createdAt} />
                        <span aria-hidden>·</span>
                        {e.status === 'failed' ? <span className="text-danger">{t('failed')}</span> : <span>{e.transport}</span>}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
            {selected ? (
              <article className="min-w-0 overflow-hidden rounded-lg border border-line bg-surface">
                <header className="border-b border-line px-4 py-3">
                  <h2 className="text-[15px] font-semibold text-ink">{selected.subject}</h2>
                  <p className="mt-1 text-[12px] text-ink-3">
                    {t('to')} <span className="font-mono">{selected.to}</span> · <FormattedDate date={selected.createdAt} withTime /> · {selected.transport} / {selected.status}
                  </p>
                  {selected.error ? (
                    <div className="mt-2">
                      <Notice tone="danger">{selected.error}</Notice>
                    </div>
                  ) : null}
                </header>
                <iframe
                  title={t('previewTitle', { subject: selected.subject })}
                  srcDoc={selected.html}
                  sandbox=""
                  referrerPolicy="no-referrer"
                  className="h-[60vh] w-full bg-white"
                />
                <details className="border-t border-line px-4 py-3">
                  <summary className="cursor-pointer text-[13px] font-medium text-ink-2">{t('plainText')}</summary>
                  <pre className="mt-2 overflow-x-auto font-mono text-[12px] whitespace-pre-wrap text-ink-2">{selected.text}</pre>
                </details>
              </article>
            ) : null}
          </div>
        ) : (
          <div className="mt-5 rounded-lg border border-line bg-surface">
            <EmptyState icon={<Mail />} title={t('emptyTitle')} description={t('emptyBody')} />
          </div>
        )}
      </main>
    </div>
  );
}
