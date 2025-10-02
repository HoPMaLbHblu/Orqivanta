import { expect, test } from '@playwright/test';
import { expectAccessible } from './helpers';

const pages = ['/', '/product', '/client-portal', '/agencies', '/pricing', '/changelog', '/about', '/contact', '/legal/privacy', '/legal/terms', '/accessibility', '/sign-in', '/sign-up', '/demo'];

for (const path of pages) {
  test(`public page ${path} renders and passes axe`, async ({ page }) => {
    const res = await page.goto(path);
    expect(res?.status()).toBe(200);
    await expect(page.locator('h1').first()).toBeVisible();
    await expectAccessible(page);
  });
}

test('unknown pages show the 404 page', async ({ page }) => {
  await page.goto('/legal/does-not-exist');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('contact form saves a message', async ({ page }) => {
  await page.goto('/contact');
  await page.getByLabel('Your name').fill('E2E Tester');
  await page.getByLabel('Email').fill('e2e@example.com');
  await page.getByLabel('Message').fill('Checking the contact form end to end.');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.getByText('Thanks — your message is in.')).toBeVisible();
});
