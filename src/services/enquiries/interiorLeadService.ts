import { apiRequest } from '../../lib/apiClient';
import { fetchAllPages } from '../../lib/paging';
import { asRaw, idOf, iso, nameOf, num, str, strArr, strOrNull, type Raw } from '../../lib/raw';
import type { InteriorLead } from '../../types/enquiries';

export function mapInteriorLead(raw: Raw): InteriorLead {
  const buyer = asRaw(raw.buyerSnapshot ?? raw.buyerId);
  const property = asRaw(raw.propertySnapshot ?? raw.propertyId);
  const q = raw.quote ? asRaw(raw.quote) : null;
  return {
    id: idOf(raw),
    referenceId: str(raw.referenceId, idOf(raw)),
    buyerId: idOf(raw.buyerId),
    buyerName: str(buyer.name, 'Customer'),
    phone: str(buyer.phone),
    email: strOrNull(buyer.email),
    userType: str(raw.userType ?? buyer.userType, 'resident').toLowerCase(),
    propertyId: idOf(raw.propertyId),
    propertyTitle: str(property.title, 'Property'),
    propertyLocation: str(property.location),
    rooms: strArr(raw.selectedRooms),
    style: str(raw.designStyle, 'modern'),
    budget: str(raw.budgetRange, 'standard'),
    specialNotes: str(raw.notes),
    status: str(raw.status, 'new'),
    assignedDesigner: raw.assignedDesigner ? idOf(raw.assignedDesigner) : null,
    designerName: raw.assignedDesigner && typeof raw.assignedDesigner === 'object' ? nameOf(raw.assignedDesigner) : null,
    slaDeadline: iso(raw.slaDeadline),
    quote: q
      ? { amount: num(q.amount ?? q.totalPrice), packageName: str(q.packageName), timeline: str(q.timeline), inclusions: strArr(q.inclusions), validUntil: iso(q.validUntil) }
      : null,
    createdAt: iso(raw.createdAt) ?? new Date().toISOString(),
    updatedAt: iso(raw.updatedAt ?? raw.createdAt) ?? new Date().toISOString(),
  };
}

/** GET /api/v1/admin/interior/leads (all pages) */
export const listInteriorLeads = (signal?: AbortSignal) => fetchAllPages('/v1/admin/interior/leads', mapInteriorLead, { sort: 'newest' }, signal);

/** GET /api/v1/admin/interior/leads/:leadId */
export async function getInteriorLead(id: string, signal?: AbortSignal) {
  return mapInteriorLead(asRaw(await apiRequest<Raw>(`/v1/admin/interior/leads/${id}`, { signal })));
}

export interface UpdateInteriorLeadBody {
  status?: string;
  assignedDesigner?: string | null;
  notes?: string | null;
  quote?: { amount: number; packageName: string; timeline: string; inclusions: string[]; validUntil: string };
  customerAcceptedAt?: string;
  completionNote?: string;
}

/** PATCH /api/v1/admin/interior/leads/:leadId (body shape per the original admin client) */
export async function updateInteriorLead(id: string, body: UpdateInteriorLeadBody) {
  return mapInteriorLead(asRaw(await apiRequest<Raw>(`/v1/admin/interior/leads/${id}`, { method: 'PATCH', body })));
}
