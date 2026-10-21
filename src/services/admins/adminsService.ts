import { apiRequest, apiRequestEnvelope } from '../../lib/apiClient';
import { arr, asRaw, idOf, iso, str, strArr, type Raw } from '../../lib/raw';

/** `GET /api/v1/admin/admins` item (normalised) */
export interface AdminOperator {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  department: string;
  permissions: string[];
  assignedArea: string[];
  status: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string | null;
}

export function mapAdmin(raw: Raw): AdminOperator {
  const isActive = raw.isActive !== false && str(raw.status) !== 'suspended';
  return {
    id: idOf(raw),
    name: str(raw.name, 'Unnamed admin'),
    email: str(raw.email),
    phone: str(raw.phone),
    role: str(raw.role, 'admin'),
    department: str(raw.department),
    permissions: strArr(raw.permissions),
    assignedArea: strArr(raw.assignedArea),
    status: str(raw.status) || (isActive ? 'active' : 'suspended'),
    isActive,
    lastLoginAt: iso(raw.lastLoginAt),
    createdAt: iso(raw.createdAt),
  };
}

/**
 * Admin account payload. The admins endpoints declare no validator in the API contract;
 * these are the fields the previous dashboard sent.
 */
export interface AdminPayload {
  name?: string;
  email?: string;
  phone?: string;
  photoUrl?: string;
  password?: string;
  role?: string;
  department?: string;
  assignedArea?: string[];
  specialization?: string[];
  isAvailable?: boolean;
  status?: 'active' | 'suspended';
  permissions?: string[];
}

/** GET /api/v1/admin/admins */
export async function listAdmins(signal?: AbortSignal) {
  const r = await apiRequestEnvelope<Raw[]>('/v1/admin/admins', { signal });
  return arr(r.data).map((x) => mapAdmin(asRaw(x)));
}

/** POST /api/v1/admin/admins/invite */
export async function inviteAdmin(body: AdminPayload) {
  return mapAdmin(asRaw(await apiRequest<Raw>('/v1/admin/admins/invite', { method: 'POST', body })));
}

/** PATCH /api/v1/admin/admins/:id */
export async function updateAdmin(id: string, body: AdminPayload) {
  return mapAdmin(asRaw(await apiRequest<Raw>(`/v1/admin/admins/${id}`, { method: 'PATCH', body })));
}

/** PATCH /api/v1/admin/admins/:id/permissions — { permissions } */
export async function updateAdminPermissions(id: string, permissions: string[]) {
  return mapAdmin(asRaw(await apiRequest<Raw>(`/v1/admin/admins/${id}/permissions`, { method: 'PATCH', body: { permissions } })));
}

/** POST /api/v1/admin/admins/:id/reset-password — { password } */
export const resetAdminPassword = (id: string, password: string) => apiRequest<Raw>(`/v1/admin/admins/${id}/reset-password`, { method: 'POST', body: { password } });

/** POST /api/v1/admin/admins/:id/suspend — { suspended } */
export async function setAdminSuspended(id: string, suspended: boolean) {
  return mapAdmin(asRaw(await apiRequest<Raw>(`/v1/admin/admins/${id}/suspend`, { method: 'POST', body: { suspended } })));
}

/** DELETE /api/v1/admin/admins/:id */
export const removeAdmin = (id: string) => apiRequest<Raw>(`/v1/admin/admins/${id}`, { method: 'DELETE' });
