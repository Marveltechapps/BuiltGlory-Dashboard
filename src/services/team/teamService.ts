import { apiRequest } from '../../lib/apiClient';
import { arr, asRaw, idOf, num, str, strArr, type Raw } from '../../lib/raw';
import type { TeamMember } from '../../types/team';

export function mapTeamMember(raw: Raw): TeamMember {
  return {
    id: idOf(raw),
    name: str(raw.name, 'Unassigned admin'),
    phone: str(raw.phone),
    email: str(raw.email),
    role: str(raw.role),
    assignedArea: strArr(raw.assignedArea),
    activeWorkload: num(raw.activeWorkload) ?? 0,
    isAvailable: raw.isAvailable !== false && raw.isActive !== false,
    specialization: strArr(raw.specialization),
  };
}

/** GET /api/v1/admin/sales-team */
export async function listSalesTeam(signal?: AbortSignal): Promise<TeamMember[]> {
  return arr(await apiRequest<Raw[]>('/v1/admin/sales-team', { signal })).map((r) => mapTeamMember(asRaw(r)));
}

/** POST /api/v1/admin/sales-team */
export async function createSalesTeamMember(body: { name: string; phone: string; email: string; role: string; assignedArea: string[] }) {
  return mapTeamMember(asRaw(await apiRequest<Raw>('/v1/admin/sales-team', { method: 'POST', body })));
}

/** PATCH /api/v1/admin/sales-team/:id */
export async function updateSalesTeamMember(id: string, body: Partial<{ name: string; phone: string; email: string; role: string; assignedArea: string[]; isAvailable: boolean }>) {
  return mapTeamMember(asRaw(await apiRequest<Raw>(`/v1/admin/sales-team/${id}`, { method: 'PATCH', body })));
}

/** DELETE /api/v1/admin/sales-team/:id */
export const removeSalesTeamMember = (id: string) => apiRequest<Raw>(`/v1/admin/sales-team/${id}`, { method: 'DELETE' });

/** GET /api/v1/admin/designers */
export async function listDesigners(signal?: AbortSignal): Promise<TeamMember[]> {
  return arr(await apiRequest<Raw[]>('/v1/admin/designers', { signal })).map((r) => mapTeamMember(asRaw(r)));
}
