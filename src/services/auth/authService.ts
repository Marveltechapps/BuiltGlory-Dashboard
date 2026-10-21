import { apiRequest } from '../../lib/apiClient';
import type { AdminDeviceSession, AdminLoginStats, AdminSession } from '../../types/auth';

/** POST /api/v1/auth/admin/login — body { email, password (min 8) } */
export function loginAdmin(email: string, password: string): Promise<AdminSession> {
  return apiRequest<AdminSession>('/v1/auth/admin/login', { method: 'POST', body: { email, password }, anonymous: true });
}

/** POST /api/v1/auth/logout — body { refreshToken } */
export function logoutAdmin(refreshToken: string) {
  return apiRequest<{ revoked: boolean }>('/v1/auth/logout', { method: 'POST', body: { refreshToken } });
}

/** GET /api/v1/public/admin-login-stats */
export function getLoginStats(signal?: AbortSignal): Promise<AdminLoginStats> {
  return apiRequest<AdminLoginStats>('/v1/public/admin-login-stats', { anonymous: true, signal });
}

/** GET /api/v1/admin/sessions */
export const listDeviceSessions = (signal?: AbortSignal) => apiRequest<AdminDeviceSession[]>('/v1/admin/sessions', { signal });

/** DELETE /api/v1/admin/sessions/:sid */
export const revokeDeviceSession = (sid: string) => apiRequest<{ revoked: boolean; sid: string }>(`/v1/admin/sessions/${sid}`, { method: 'DELETE' });

/** DELETE /api/v1/admin/sessions */
export const revokeOtherSessions = () => apiRequest<{ revoked: number }>('/v1/admin/sessions', { method: 'DELETE' });
