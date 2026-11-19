import { expect, test } from '@playwright/test';
import { adminLogin, api, ensureE2EAdmins } from './helpers/api';
import { LIMITED_EMAIL, LIMITED_PASSWORD } from './helpers/env';

test.describe('Security · unauthorized / expired / concurrent', () => {
  test.beforeAll(async () => {
    await ensureE2EAdmins();
  });

  test('public login-stats is reachable without auth', async () => {
    const { status, body } = await api('/api/v1/public/admin-login-stats');
    expect(status).toBe(200);
    expect(body.data).toEqual(
      expect.objectContaining({
        properties: expect.any(Number),
        users: expect.any(Number),
        deals: expect.any(Number),
      }),
    );
  });

  test('overview rejects missing token', async () => {
    const { status, body } = await api('/api/v1/admin/overview');
    expect(status).toBe(401);
    expect(body.error?.code || body.error).toBeTruthy();
  });

  test('overview rejects garbage token', async () => {
    const { status } = await api('/api/v1/admin/overview', { token: 'not.a.jwt' });
    expect([401, 403]).toContain(status);
  });

  test('limited role gets 403 on access-control list', async () => {
    const limited = await adminLogin(LIMITED_EMAIL, LIMITED_PASSWORD);
    const { status } = await api('/api/v1/admin/admins', { token: limited.accessToken });
    expect(status).toBe(403);
  });

  test('limited role can read support tickets', async () => {
    const limited = await adminLogin(LIMITED_EMAIL, LIMITED_PASSWORD);
    const { status } = await api('/api/v1/admin/support/tickets?limit=5', { token: limited.accessToken });
    expect(status).toBe(200);
  });

  test('concurrent authenticated list calls succeed', async () => {
    const session = await adminLogin();
    const paths = [
      '/api/v1/admin/properties?limit=5',
      '/api/v1/admin/users?limit=5',
      '/api/v1/admin/buy-enquiries?limit=5',
      '/api/v1/admin/sales/deals?limit=5',
      '/api/v1/admin/acquisitions?limit=5',
    ];
    const results = await Promise.all(paths.map((p) => api(p, { token: session.accessToken })));
    for (const r of results) expect(r.status).toBe(200);
  });

  test('refresh rejects invalid refresh token', async () => {
    const { status } = await api('/api/v1/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: 'invalid-refresh' }),
    });
    expect([400, 401]).toContain(status);
  });
});
