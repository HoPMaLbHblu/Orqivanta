import 'server-only';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Locale } from './config';
import { lookupServerMessage } from './server-message-lookup';

const cache = new Map<string, Record<string, string>>();

/** Translations of domain error messages, keyed by the English sentence. */
export async function loadServerMessages(locale: Locale): Promise<Record<string, string>> {
  if (locale === 'en') return {};
  const hit = cache.get(locale);
  if (hit && process.env.NODE_ENV === 'production') return hit;
  try {
    const map = JSON.parse(await readFile(path.join(process.cwd(), 'messages', `${locale}.server.json`), 'utf8')) as Record<string, string>;
    cache.set(locale, map);
    return map;
  } catch {
    return {};
  }
}

/** For server components: translates English domain text (errors, notification titles, definitions). */
export async function getServerMessageTranslator() {
  const { getLocale } = await import('next-intl/server');
  const map = await loadServerMessages((await getLocale()) as Locale);
  return (message: string | null | undefined) => (message ? lookupServerMessage(map, message) : '');
}
