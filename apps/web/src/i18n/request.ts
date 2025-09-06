import { cookies, headers } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { getSession } from '@/lib/session';
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, type Locale } from './config';
import { loadMessages } from './messages';

/** Signed-in users get their saved language; visitors get their cookie or browser language. */
export async function resolveLocale(): Promise<Locale> {
  const session = await getSession().catch(() => null);
  if (session && isLocale(session.user.locale)) return session.user.locale;
  const fromCookie = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(fromCookie)) return fromCookie;
  const accept = (await headers()).get('accept-language') ?? '';
  return /^\s*ru\b/i.test(accept) ? 'ru' : DEFAULT_LOCALE;
}

export default getRequestConfig(async () => {
  const locale = await resolveLocale();
  const session = await getSession().catch(() => null);
  return {
    locale,
    messages: await loadMessages(locale),
    timeZone: session?.user.timeZone ?? 'UTC',
    onError(error) {
      if (process.env.NODE_ENV !== 'production') console.warn(`[i18n] ${error.message}`);
    },
    getMessageFallback({ namespace, key }) {
      return `${namespace ? `${namespace}.` : ''}${key}`;
    },
  };
});
