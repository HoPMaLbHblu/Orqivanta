import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Logo } from '@/components/brand';
import { LinkButton } from '@/components/marketing/link-button';
import { Container } from '@/components/marketing/typography';
import { homePathFor } from '@/lib/routes';
import { getSession } from '@/lib/session';

export async function generateMetadata() {
  const t = await getTranslations('errors.notFound');
  return { title: t('metaTitle'), robots: { index: false } };
}

/**
 * Global 404. It never says whether an address exists, because workspace pages return
 * this page when the viewer has no access to them.
 */
export default async function NotFound() {
  const [t, session] = await Promise.all([getTranslations('errors.notFound'), getSession()]);
  const workspaceHref = session ? await homePathFor(session.user) : null;
  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      <div className="border-b border-line">
        <Container className="flex h-16 items-center">
          <Logo />
        </Container>
      </div>
      <main id="main" className="flex flex-1 items-center">
        <Container narrow className="py-20">
          <p className="font-mono text-[13px] tracking-[0.12em] text-ink-3 uppercase">{t('eyebrow')}</p>
          <h1 className="mt-5 font-serif text-[44px] leading-[1.05] tracking-[-0.015em] text-ink sm:text-[60px]">{t('title')}</h1>
          <p className="mt-6 max-w-[52ch] text-[16.5px] leading-[1.7] text-ink-2">{t('body')}</p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <LinkButton href="/" size="lg" variant="primary">
              {t('home')}
            </LinkButton>
            {workspaceHref ? (
              <LinkButton href={workspaceHref} size="lg" variant="secondary">
                {t('workspace')}
              </LinkButton>
            ) : null}
          </div>
          <p className="mt-8 text-[14px] text-ink-3">
            <Link href="/contact" className="text-accent underline-offset-4 hover:underline">
              {t('contact')}
            </Link>
          </p>
        </Container>
      </main>
    </div>
  );
}
