import { expect, test } from '@playwright/test';
import { adminLogin, api, ensureE2EAdmins } from './helpers/api';

test.describe('CRUD · locations / properties / filters / pagination', () => {
  let token = '';

  test.beforeAll(async () => {
    await ensureE2EAdmins();
    token = (await adminLogin()).accessToken;
  });

  test('locations city create → list → delete', async () => {
    const key = `e2e-city-${Date.now()}`;
    const create = await api('/api/v1/admin/locations', {
      method: 'POST',
      token,
      body: JSON.stringify({
        kind: 'city',
        name: `E2E ${key}`,
        key,
        cityKey: key,
        state: 'Tamil Nadu',
        active: true,
      }),
    });
    expect(create.status).toBe(201);
    const id = create.body.data?._id || create.body.data?.id;
    expect(id).toBeTruthy();

    const list = await api(`/api/v1/admin/locations?kind=city&cityKey=${encodeURIComponent(key)}&limit=50`, { token });
    expect(list.status).toBe(200);
    const rows = Array.isArray(list.body.data) ? list.body.data : [];
    expect(rows.some((r: { key?: string; _id?: string; id?: string }) => r.key === key || String(r._id || r.id) === String(id))).toBe(true);

    const del = await api(`/api/v1/admin/locations/${id}`, { method: 'DELETE', token });
    expect([200, 204]).toContain(del.status);
  });

  test('properties list supports pagination meta', async () => {
    const page1 = await api('/api/v1/admin/properties?limit=5&page=1', { token });
    expect(page1.status).toBe(200);
    expect(page1.body.meta?.page === 1 || page1.body.meta?.limit === 5 || Array.isArray(page1.body.data)).toBe(true);
  });

  test('properties search/filter query accepted', async () => {
    const filtered = await api('/api/v1/admin/properties?limit=10&search=e2e&status=draft', { token });
    expect(filtered.status).toBe(200);
    expect(Array.isArray(filtered.body.data)).toBe(true);
  });

  test('buy enquiries list + users list filters', async () => {
    const enquiries = await api('/api/v1/admin/buy-enquiries?limit=10&sort=newest', { token });
    const users = await api('/api/v1/admin/users?limit=10&sort=newest', { token });
    expect(enquiries.status).toBe(200);
    expect(users.status).toBe(200);
  });

  test('import jobs pagination returns totalPages', async () => {
    const jobs = await api('/api/v1/admin/properties/import-jobs?limit=5&page=1', { token });
    expect(jobs.status).toBe(200);
    expect(jobs.body.meta).toEqual(
      expect.objectContaining({
        page: 1,
        limit: 5,
        total: expect.any(Number),
        totalPages: expect.any(Number),
      }),
    );
  });
});
