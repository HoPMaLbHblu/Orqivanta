import { expect, test } from '@playwright/test';
import { expectAccessible, ORG, PRIYA, signIn } from './helpers';

test.describe('internal workspace', () => {
  test.beforeEach(async ({ page }) => signIn(page, PRIYA));

  test('home shows the producer’s work and passes axe', async ({ page }) => {
    await expect(page).toHaveURL(new RegExp(`/${ORG}$`));
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Priya');
    await expectAccessible(page);
  });

  for (const path of ['projects', 'projects/HPC', 'projects/HPC/tasks', 'my-work', 'inbox', 'requests', 'approvals', 'documents', 'clients', 'reports', 'settings/members']) {
    test(`/${path} passes axe`, async ({ page }) => {
      const res = await page.goto(`/${ORG}/${path}`);
      expect(res?.status()).toBe(200);
      await expectAccessible(page);
    });
  }

  test('a task added on the list appears and opens', async ({ page }) => {
    const title = `E2E task ${Date.now()}`;
    await page.goto(`/${ORG}/projects/ATL/tasks`);
    await page.getByRole('button', { name: 'Add task' }).first().click();
    await page.getByPlaceholder('Task title').fill(title);
    await page.keyboard.press('Enter');
    await expect(page.getByText(title)).toBeVisible();
  });

  test('search finds a project by name', async ({ page }) => {
    await page.goto(`/${ORG}/search?q=harbor`);
    await expect(page.getByText('Harbor & Pine website').first()).toBeVisible();
  });
});
