import { getTranslations } from 'next-intl/server';
import { Logo } from '@/components/brand';
import { PreferenceSwitcher } from '@/components/preference-switcher';

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations('auth.aside');
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
      <div className="flex flex-col px-6 py-6 sm:px-10">
        <div className="flex items-center justify-between">
          <Logo />
          <PreferenceSwitcher />
        </div>
        <main id="main" className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-12">
          {children}
        </main>
      </div>
      <aside className="relative hidden overflow-hidden border-l border-line bg-surface-2 lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="absolute -top-24 -right-24 size-[420px] rounded-full border border-line-strong/60" aria-hidden />
        <div className="absolute top-40 -right-40 size-[520px] rounded-full border border-line-strong/40" aria-hidden />
        <p className="relative text-[12px] tracking-[0.14em] text-ink-3 uppercase">{t('eyebrow')}</p>
        <div className="relative max-w-md">
          <p className="font-serif text-[40px] leading-[1.1] text-ink">{t('quote')}</p>
          <ul className="mt-8 space-y-3 text-[14px] text-ink-2">
            <li className="flex gap-3"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" />{t('point1')}</li>
            <li className="flex gap-3"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" />{t('point2')}</li>
            <li className="flex gap-3"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" />{t('point3')}</li>
          </ul>
        </div>
        <p className="relative text-[12px] text-ink-3">{t('footer')}</p>
      </aside>
    </div>
  );
}
