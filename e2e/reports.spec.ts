import { expect, test } from '@playwright/test';
import { adminLogin, api, ensureE2EAdmins } from './helpers/api';
import { ADMIN_EMAIL } from './helpers/env';

test.describe('Reports · analytics / export / schedules', () => {
  let token = '';

  test.beforeAll(async () => {
    await ensureE2EAdmins();
    token = (await adminLogin()).accessToken;
  });

  test('sales / acquisition / revenue analytics respond', async () => {
    const sales = await api('/api/v1/admin/reports/sales/analytics', { token });
    const acq = await api('/api/v1/admin/reports/acquisition/analytics', { token });
    const rev = await api('/api/v1/admin/reports/revenue/analytics', { token });
    expect(sales.status).toBe(200);
    expect(acq.status).toBe(200);
    expect(rev.status).toBe(200);
  });

  test('list and create report schedules', async () => {
    const list = await api('/api/v1/admin/reports/schedules?limit=20', { token });
    expect(list.status).toBe(200);

    const created = await api('/api/v1/admin/reports/schedules', {
      method: 'POST',
      token,
      body: JSON.stringify({
        name: `E2E Schedule ${Date.now()}`,
        reportType: 'sales',
        format: 'xlsx',
        frequency: 'weekly',
        recipients: [ADMIN_EMAIL],
      }),
    });
    expect([200, 201]).toContain(created.status);
    expect(created.body.data?.referenceId || created.body.referenceId).toBeTruthy();
  });

  test('queue export job', async () => {
    const job = await api('/api/v1/admin/reports/export', {
      method: 'POST',
      token,
      body: JSON.stringify({
        filters: {
          reportType: 'properties',
          format: 'csv',
          fields: ['id', 'title', 'status'],
          deliveryEmail: ADMIN_EMAIL,
        },
      }),
    });
    expect([200, 201]).toContain(job.status);
  });
});
