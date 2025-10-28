import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Logo } from '@/components/brand';
import { PreferenceSwitcher } from '@/components/preference-switcher';
import { AuthorLinks } from './author-links';
import { Container } from './typography';

/** Every public page, the preference switcher, and an honest note about what this is. */
export async function SiteFooter({ demoEnabled }: { demoEnabled: boolean }) {
  const t = await getTranslations('marketing');
  const columns: { title: string; links: { href: string; label: string }[] }[] = [
    {
      title: t('footer.productTitle'),
      links: [
        { href: '/product', label: t('nav.product') },
        { href: '/client-portal', label: t('nav.clientPortal') },
        { href: '/agencies', label: t('nav.agencies') },
        { href: '/pricing', label: t('nav.pricing') },
        { href: '/changelog', label: t('nav.changelog') },
      ],
    },
    {
      title: t('footer.companyTitle'),
      links: [
        { href: '/about', label: t('footer.about') },
        { href: '/contact', label: t('footer.contact') },
        { href: '/accessibility', label: t('footer.accessibility') },
      ],
    },
    {
      title: t('footer.legalTitle'),
      links: [
        { href: '/legal/privacy', label: t('footer.privacy') },
        { href: '/legal/terms', label: t('footer.terms') },
      ],
    },
    {
      title: t('footer.startTitle'),
      links: [
        { href: '/sign-up', label: t('nav.getStarted') },
        { href: '/sign-in', label: t('nav.signIn') },
        ...(demoEnabled ? [{ href: '/demo', label: t('nav.tryDemo') }] : []),
      ],
    },
  ];
  return (
    <footer className="border-t border-line bg-surface">
      <Container className="py-14">
        <div className="grid gap-10 md:grid-cols-[minmax(0,1.3fr)_minmax(0,2fr)]">
          <div>
            <Logo />
            <p className="mt-4 max-w-[34ch] text-[14px] leading-relaxed text-ink-2">{t('footer.tagline')}</p>
            <AuthorLinks className="mt-5" />
          </div>
          <nav aria-label={t('footer.productTitle')} className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-4">
            {columns.map((col) => (
              <div key={col.title}>
                <h2 className="text-[12px] font-medium tracking-[0.12em] text-ink-3 uppercase">{col.title}</h2>
                <ul className="mt-3 flex flex-col gap-2">
                  {col.links.map((l) => (
                    <li key={l.href}>
                      <Link href={l.href} className="text-[14px] text-ink-2 underline-offset-2 hover:text-ink hover:underline">
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>
        <p className="mt-12 max-w-[72ch] border-t border-line pt-6 text-[13px] leading-relaxed text-ink-3">{t('footer.portfolioNote')}</p>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[13px] text-ink-3">{t('footer.copyright', { year: new Date().getFullYear() })}</p>
          <PreferenceSwitcher />
        </div>
      </Container>
    </footer>
  );
}
