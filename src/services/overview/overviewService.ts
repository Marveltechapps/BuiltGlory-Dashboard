import { apiRequest } from '../../lib/apiClient';
import type { AdminOverview } from '../../types/overview';

/** GET /api/v1/admin/overview — KPIs, charts, queues, schedule, SLA queues and sidebar nav badges. */
export function getOverview(signal?: AbortSignal): Promise<AdminOverview> {
  return apiRequest<AdminOverview>('/v1/admin/overview', { signal });
}
