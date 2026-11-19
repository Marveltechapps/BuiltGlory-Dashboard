import { expect, test } from '@playwright/test';
import { adminLogin, ensureE2EAdmins, refreshAccess } from './helpers/api';
import { ADMIN_EMAIL, LIMITED_EMAIL, LIMITED_PASSWORD } from './helpers/env';
import { loginViaUi } from './helpers/ui';

test.describe('Auth · Login / JWT / RBAC', () => {
  test.beforeAll(async () => {
    await ensureE2EAdmins();
  });

  test('API admin login returns access + refresh tokens', async () => {
    const session = await adminLogin();
    expect(session.accessToken).toBeTruthy();
    expect(session.refreshToken).toBeTruthy();
    expect(session.admin.email.toLowerCase()).toBe(ADMIN_EMAIL.toLowerCase());
  });

  test('API refresh rotates tokens', async () => {
    const session = await adminLogin();
    const refreshed = await refreshAccess(session.refreshToken);
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.data?.accessToken || refreshed.body.accessToken).toBeTruthy();
  });

  test('UI login lands on overview', async ({ page }) => {
    await loginViaUi(page);
    await expect(page).toHaveURL(/\/admin\/overview/);
  });

  test('UI rejects bad password', async ({ page }) => {
    await page.goto('/login');
    await page.locator('#email').fill(ADMIN_EMAIL);
    await page.locator('#password').fill('WrongPassword!!!');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page.getByText(/could not sign in/i)).toBeVisible({ timeout: 15_000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test('limited ops role cannot open Access Control', async ({ page }) => {
    await loginViaUi(page, LIMITED_EMAIL, LIMITED_PASSWORD);
    await page.goto('/admin/settings/access');
    // Guard redirects unauthorized paths to first allowed module.
    await expect(page).not.toHaveURL(/\/admin\/settings\/access/);
  });
});
