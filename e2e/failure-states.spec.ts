import { expect, test } from '@playwright/test';
import { ensureE2EAdmins } from './helpers/api';
import { loginViaUi } from './helpers/ui';

test.describe('Failure / empty / network states', () => {
  test.beforeAll(async () => {
    await ensureE2EAdmins();
  });

  test('overview shows recoverable error when API is aborted', async ({ page }) => {
    await loginViaUi(page);
    await page.route('**/api/v1/admin/overview**', (route) => route.abort());
    await page.goto('/admin/overview');
    // Either error UI or empty/loading-without-crash is acceptable; must not show success KPIs from mocks.
    await page.waitForTimeout(2000);
    const body = await page.locator('body').innerText();
    expect(body.toLowerCase()).not.toContain('unexpected application error');
    // No hardcoded marketing stats when overview fails.
    expect(body).not.toMatch(/99999 properties/i);
  });

  test('properties empty/search does not inject fake rows', async ({ page }) => {
    await loginViaUi(page);
    await page.goto('/admin/properties/all');
    // Use the list filter, not the global header search.
    const search = page.getByPlaceholder(/search title, locality, city/i);
    await expect(search).toBeVisible();
    await search.fill('___no_such_property_e2e___');
    await expect(page.getByText(/no properties match your filters/i)).toBeVisible({ timeout: 10_000 });
    // Ensure the data table is in empty state (no property rows rendered).
    await expect(page.locator('table tbody tr')).toHaveCount(0);
  });
});
