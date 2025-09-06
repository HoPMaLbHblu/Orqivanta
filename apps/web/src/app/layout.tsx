import type { Metadata, Viewport } from 'next';
import { Inter, Instrument_Serif, JetBrains_Mono } from 'next/font/google';
import { cookies } from 'next/headers';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages, getTimeZone } from 'next-intl/server';
import { Toaster } from 'sonner';
import { ServerMessagesProvider } from '@/components/providers/server-messages';
import { TooltipProvider } from '@/components/ui/tooltip';
import { THEME_COOKIE, type Locale } from '@/i18n/config';
import { loadServerMessages } from '@/i18n/server-messages';
import { getSession } from '@/lib/session';
import './globals.css';

const inter = Inter({ subsets: ['latin', 'cyrillic'], variable: '--font-inter', display: 'swap' });
const instrument = Instrument_Serif({ subsets: ['latin'], weight: '400', style: ['normal', 'italic'], variable: '--font-instrument', display: 'swap' });
const jetbrains = JetBrains_Mono({ subsets: ['latin', 'cyrillic'], variable: '--font-jetbrains', display: 'swap' });

const APP_URL = process.env.APP_URL ?? 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: { default: 'Orqivanta', template: '%s · Orqivanta' },
  description: 'One calm place for agency projects, client requests, approvals and reporting.',
  openGraph: { siteName: 'Orqivanta', type: 'website' },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#faf8f5' },
    { media: '(prefers-color-scheme: dark)', color: '#161412' },
  ],
};

// Applies the system theme before first paint, so dark-mode users never see a white flash.
const themeScript = `(function(){try{var d=document.documentElement;if(d.dataset.themePref==='system'){d.dataset.theme=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}}catch(e){}})();`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [locale, messages, timeZone, session] = await Promise.all([getLocale(), getMessages(), getTimeZone(), getSession()]);
  const pref = session?.user.theme ?? (await cookies()).get(THEME_COOKIE)?.value ?? 'system';
  const themePref = pref === 'light' || pref === 'dark' ? pref : 'system';
  const serverMessages = await loadServerMessages(locale as Locale);
  return (
    <html lang={locale} data-theme={themePref === 'system' ? 'light' : themePref} data-theme-pref={themePref} className={`${inter.variable} ${instrument.variable} ${jetbrains.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages} timeZone={timeZone}>
          <ServerMessagesProvider messages={serverMessages}>
            <TooltipProvider>
              {children}
              <Toaster position="bottom-right" closeButton toastOptions={{ className: '!bg-surface !text-ink !border-line !shadow-pop !text-[13px]' }} />
            </TooltipProvider>
          </ServerMessagesProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
