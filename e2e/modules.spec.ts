import { expect, test } from '@playwright/test';
import { ensureE2EAdmins } from './helpers/api';
import { expectNoCrash, loginViaUi, MODULE_PATHS } from './helpers/ui';

test.describe('Dashboard modules · live navigation', () => {
  test.beforeAll(async () => {
    await ensureE2EAdmins();
  });

  test.beforeEach(async ({ page }) => {
    await loginViaUi(page);
  });

  for (const mod of MODULE_PATHS) {
    test(`opens ${mod.name} (${mod.path}) against live API`, async ({ page }) => {
      const failures: string[] = [];
      page.on('response', (res) => {
        const url = res.url();
        if (!url.includes('/api/v1/')) return;
        if (res.status() >= 500) failures.push(`${res.status()} ${url}`);
      });
      await page.goto(mod.path);
      await expect(page).toHaveURL(new RegExp(mod.path.replace(/\//g, '\\/')));
      await expectNoCrash(page);
      // Allow queries to settle.
      await page.waitForTimeout(1500);
      expect(failures, failures.join('\n')).toEqual([]);
    });
  }

  test('Tools › Locations loads without CMS mock banner', async ({ page }) => {
    await page.goto('/admin/tools/locations');
    await expect(page.getByText(/cities/i).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/derived from property addresses/i)).toHaveCount(0);
  });

  test('Reports › Export shows scheduled exports panel', async ({ page }) => {
    await page.goto('/admin/reports/export');
    await expect(page.getByText(/scheduled exports/i)).toBeVisible({ timeout: 20_000 });
  });

  test('Properties templates empty mode has no SAMPLE mock id', async ({ page }) => {
    await page.goto('/admin/properties/templates');
    await page.getByRole('button', { name: /empty template/i }).click();
    await page.waitForTimeout(1000);
    await expect(page.getByText('SAMPLE-1')).toHaveCount(0);
  });
});
