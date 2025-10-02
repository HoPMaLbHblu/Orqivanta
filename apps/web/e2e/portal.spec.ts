import { expect, test } from '@playwright/test';
import { expectAccessible, HANNAH, ORG, signIn } from './helpers';

test.describe('client portal', () => {
  test.beforeEach(async ({ page }) => signIn(page, HANNAH));

  test('a client lands in the portal and sees their pending review', async ({ page }) => {
    await expect(page).toHaveURL(new RegExp(`/portal/${ORG}`));
    await expect(page.getByText('Homepage concept').first()).toBeVisible();
    await expectAccessible(page);
  });

  test('a client is sent away from the internal workspace', async ({ page }) => {
    await page.goto(`/${ORG}/projects`);
    await expect(page).toHaveURL(new RegExp(`/portal/${ORG}`));
  });

  test('another client’s project is not found', async ({ page }) => {
    await page.goto(`/portal/${ORG}/projects/LUM`);
    await expect(page.getByText(/not found/i).first()).toBeVisible();
    await expect(page.getByText('Lumen Health brand refresh')).toHaveCount(0);
  });

  for (const path of ['requests', 'requests/new', 'approvals', 'deliverables', 'updates', 'projects/HPC']) {
    test(`/portal/${path} passes axe`, async ({ page }) => {
      await page.goto(`/portal/${ORG}/${path}`);
      await expectAccessible(page);
    });
  }
});
