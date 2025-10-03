import AxeBuilder from '@axe-core/playwright';
import { expect, type BrowserContext, type Page } from '@playwright/test';

export const DEMO_PASSWORD = 'orqivanta-demo';
export const ORG = 'northwind';
export const PRIYA = 'priya@northwind.example';
export const LEO = 'leo@northwind.example';
export const HANNAH = 'hannah@harborpine.example';

/**
 * Signs in once per account and reuses the session cookie afterwards, so the suite doesn't
 * trip the sign-in rate limit (which is real and applies to tests too).
 */
const sessions = new Map<string, Awaited<ReturnType<BrowserContext['cookies']>>>();

export async function signIn(page: Page, email: string) {
  const saved = sessions.get(email);
  if (saved) {
    await page.context().addCookies(saved);
    await page.goto('/');
    await page.goto(email === HANNAH ? `/portal/${ORG}` : `/${ORG}`);
    return;
  }
  await page.goto('/sign-in');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/sign-in'));
  sessions.set(email, await page.context().cookies());
}

/** Fails on any WCAG 2.2 A/AA violation axe can detect. */
export async function expectAccessible(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  const summary = results.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} × ${v.help}`);
  expect(summary, summary.join('\n')).toEqual([]);
}
