import { expect, test } from '@playwright/test';
import { adminLogin, api, ensureE2EAdmins } from './helpers/api';
import { loginViaUi } from './helpers/ui';

/**
 * Documents API assessment:
 * - Backend exposes GET /admin/documents (properties.read) plus customer upload/read-url routes.
 * - Dashboard embeds documents inside Acquisition / Sales / Sell / User KYC detail flows.
 * - There is no dedicated Documents vault page under /admin/*.
 */
test.describe('Documents API · presence and UI gap', () => {
  let token = '';

  test.beforeAll(async () => {
    await ensureE2EAdmins();
    token = (await adminLogin()).accessToken;
  });

  test('GET /admin/documents is live and authorized', async () => {
    const { status, body } = await api('/api/v1/admin/documents?limit=20', { token });
    expect(status).toBe(200);
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('unauthenticated documents list is rejected', async () => {
    const { status } = await api('/api/v1/admin/documents?limit=5');
    expect(status).toBe(401);
  });

  test('Dashboard has no dedicated Documents nav route', async ({ page }) => {
    await loginViaUi(page);
    await page.goto('/admin/documents');
    // Unknown admin paths redirect to overview.
    await expect(page).toHaveURL(/\/admin\/overview/);
  });
});
