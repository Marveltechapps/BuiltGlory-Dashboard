import { API_URL, ADMIN_EMAIL, ADMIN_PASSWORD, LIMITED_EMAIL, LIMITED_PASSWORD } from './env';

export type LoginResult = {
  accessToken: string;
  refreshToken: string;
  admin: { id: string; email: string; role: string; permissions: string[] };
};

async function parseJson(res: Response) {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { raw: text };
  }
}

export async function api(path: string, init: RequestInit & { token?: string } = {}) {
  const headers = new Headers(init.headers || {});
  if (!headers.has('Content-Type') && init.body && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  if (init.token) headers.set('Authorization', `Bearer ${init.token}`);
  const res = await fetch(`${API_URL}${path.startsWith('/') ? path : '/' + path}`, { ...init, headers });
  const body = await parseJson(res);
  return { res, body, status: res.status };
}

export async function adminLogin(email = ADMIN_EMAIL, password = ADMIN_PASSWORD): Promise<LoginResult> {
  const { body, status } = await api('/api/v1/auth/admin/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  if (status !== 200) {
    throw new Error(`Admin login failed (${status}): ${JSON.stringify(body)}`);
  }
  const data = body.data || body;
  return {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    admin: data.admin,
  };
}

async function findAdminByEmail(token: string, email: string) {
  const list = await api('/api/v1/admin/admins', { token });
  const admins = Array.isArray(list.body.data) ? list.body.data : [];
  return admins.find((a: { email?: string; _id?: string; id?: string }) => String(a.email || '').toLowerCase() === email.toLowerCase());
}

/** Ensure seed + limited ops admin exist (idempotent). */
export async function ensureE2EAdmins() {
  let session: LoginResult;
  try {
    session = await adminLogin();
  } catch {
    throw new Error(
      `Cannot login as ${ADMIN_EMAIL}. Run \`npm run seed\` in BG-Service first (SEED_ADMIN_EMAIL/PASSWORD).`,
    );
  }

  let limited = await findAdminByEmail(session.accessToken, LIMITED_EMAIL);
  if (!limited) {
    const invite = await api('/api/v1/admin/admins/invite', {
      method: 'POST',
      token: session.accessToken,
      body: JSON.stringify({
        name: 'E2E Operations',
        email: LIMITED_EMAIL,
        phone: '+91 9000000099',
        role: 'operations',
        permissions: ['enquiries.read', 'visits.read', 'support.read'],
      }),
    });
    if (![200, 201].includes(invite.status)) {
      throw new Error(`Failed to invite limited admin: ${JSON.stringify(invite.body)}`);
    }
    limited = invite.body.data || (await findAdminByEmail(session.accessToken, LIMITED_EMAIL));
  }

  const limitedId = String(limited?._id || limited?.id || '');
  if (!limitedId) throw new Error('Limited admin id missing after invite');

  // Keep password deterministic for E2E.
  const reset = await api(`/api/v1/admin/admins/${limitedId}/reset-password`, {
    method: 'POST',
    token: session.accessToken,
    body: JSON.stringify({ password: LIMITED_PASSWORD }),
  });
  if (![200, 201].includes(reset.status)) {
    throw new Error(`Failed to reset limited admin password: ${JSON.stringify(reset.body)}`);
  }

  // Narrow permissions for RBAC assertions (role defaults may be broader).
  await api(`/api/v1/admin/admins/${limitedId}/permissions`, {
    method: 'PATCH',
    token: session.accessToken,
    body: JSON.stringify({ permissions: ['enquiries.read', 'visits.read', 'support.read'] }),
  });

  // Verify limited login works.
  await adminLogin(LIMITED_EMAIL, LIMITED_PASSWORD);
  return session;
}

export async function refreshAccess(refreshToken: string) {
  return api('/api/v1/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  });
}
