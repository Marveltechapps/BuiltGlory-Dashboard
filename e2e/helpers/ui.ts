import { expect, type Page } from '@playwright/test';
import { ADMIN_EMAIL, ADMIN_PASSWORD } from './env';

export async function loginViaUi(page: Page, email = ADMIN_EMAIL, password = ADMIN_PASSWORD) {
  await page.goto('/login');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/admin\//, { timeout: 30_000 });
}

export async function expectNoCrash(page: Page) {
  // Page should render a main landmark or known shell; avoid blank error walls.
  const body = page.locator('body');
  await expect(body).toBeVisible();
  const text = await body.innerText();
  expect(text.toLowerCase()).not.toContain('unexpected application error');
}

export const MODULE_PATHS: Array<{ name: string; path: string }> = [
  { name: 'Overview', path: '/admin/overview' },
  { name: 'Enquiries', path: '/admin/enquiries/buy' },
  { name: 'Acquisition', path: '/admin/acquisition/all' },
  { name: 'Sales', path: '/admin/sales/all' },
  { name: 'Properties', path: '/admin/properties/all' },
  { name: 'Users', path: '/admin/users/all' },
  { name: 'Reports', path: '/admin/reports/sales' },
  { name: 'Tools', path: '/admin/tools/locations' },
  { name: 'Admin', path: '/admin/settings/support' },
];
