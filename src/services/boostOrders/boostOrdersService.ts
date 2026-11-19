import { apiRequest } from '../../lib/apiClient';
import { fetchAllPages } from '../../lib/paging';
import { asRaw, idOf, iso, num, str, strArr, type Raw } from '../../lib/raw';

export type BoostOrderStatus = 'scheduled' | 'active' | 'expired' | 'cancelled';

export interface BoostOrderRecord {
  id: string;
  referenceId: string;
  propertyId: string;
  propertyTitle: string;
  planId: string;
  planName: string;
  priceLabel: string;
  amount: number;
  status: BoostOrderStatus;
  startsAt: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface BoostOrderCreate {
  propertyId: string;
  planId: string;
  startsAt: string;
  expiresAt: string;
  status?: BoostOrderStatus;
  amount?: number;
  sellRequestId?: string;
}

export function mapBoostOrder(raw: Raw): BoostOrderRecord {
  const snap = asRaw(raw.planSnapshot);
  const property = asRaw(raw.propertyId);
  const propertyId = idOf(raw.propertyId) || idOf(property);
  return {
    id: idOf(raw),
    referenceId: str(raw.referenceId, idOf(raw)),
    propertyId,
    propertyTitle: str(raw.propertyTitle, str(property.title, propertyId || 'Property')),
    planId: str(raw.planId),
    planName: str(snap.name, str(raw.planId)),
    priceLabel: str(snap.priceLabel),
    amount: num(raw.amount) ?? 0,
    status: str(raw.status, 'scheduled') as BoostOrderStatus,
    startsAt: iso(raw.startsAt) ?? '',
    expiresAt: iso(raw.expiresAt) ?? '',
    createdAt: iso(raw.createdAt) ?? '',
    updatedAt: iso(raw.updatedAt) ?? '',
  };
}

/** GET /api/v1/admin/boost-orders */
export function listBoostOrders(query: { propertyId?: string; status?: BoostOrderStatus } = {}, signal?: AbortSignal) {
  return fetchAllPages('/v1/admin/boost-orders', mapBoostOrder, { sort: 'newest', ...query }, signal);
}

/** POST /api/v1/admin/boost-orders */
export async function createBoostOrder(body: BoostOrderCreate) {
  return mapBoostOrder(asRaw(await apiRequest<Raw>('/v1/admin/boost-orders', { method: 'POST', body })));
}

/** PATCH /api/v1/admin/boost-orders/:boostOrderId */
export async function updateBoostOrder(id: string, body: Partial<{ status: BoostOrderStatus; startsAt: string; expiresAt: string; amount: number }>) {
  return mapBoostOrder(asRaw(await apiRequest<Raw>(`/v1/admin/boost-orders/${id}`, { method: 'PATCH', body })));
}

export function planBenefits(raw: Raw) {
  return strArr(asRaw(raw.planSnapshot).benefits);
}
