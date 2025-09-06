import 'server-only';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Locale } from './config';

const cache = new Map<string, Record<string, unknown>>();

/**
 * Messages live in messages/<locale>/<namespace>.json, one file per area of the product,
 * and are merged into one object keyed by namespace. Russian falls back to English for
 * any key that is missing, so a half-translated screen never shows raw keys.
 */
export async function loadMessages(locale: Locale): Promise<Record<string, unknown>> {
  const hit = cache.get(locale);
  if (hit && process.env.NODE_ENV === 'production') return hit;
  const en = await readLocale('en');
  const merged = locale === 'en' ? en : deepMerge(en, await readLocale(locale));
  cache.set(locale, merged);
  return merged;
}

async function readLocale(locale: string) {
  const dir = path.join(process.cwd(), 'messages', locale);
  const out: Record<string, unknown> = {};
  let files: string[] = [];
  try {
    files = (await readdir(dir)).filter((f) => f.endsWith('.json'));
  } catch {
    return out;
  }
  for (const f of files) {
    out[f.replace(/\.json$/, '')] = JSON.parse(await readFile(path.join(dir, f), 'utf8'));
  }
  return out;
}

function deepMerge(base: Record<string, unknown>, over: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(over)) {
    const b = out[k];
    out[k] = v && typeof v === 'object' && !Array.isArray(v) && b && typeof b === 'object' ? deepMerge(b as Record<string, unknown>, v as Record<string, unknown>) : v;
  }
  return out;
}
