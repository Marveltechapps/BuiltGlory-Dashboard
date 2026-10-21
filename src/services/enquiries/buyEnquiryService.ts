import { apiRequest } from '../../lib/apiClient';
import { fetchAllPages } from '../../lib/paging';
import { asRaw, idOf, iso, nameOf, num, str, strArr, strOrNull, type Raw } from '../../lib/raw';
import type { BuyEnquiry } from '../../types/enquiries';

const refName = (v: unknown) => (v && typeof v === 'object' ? nameOf(v) || null : null);

export function mapBuyEnquiry(raw: Raw): BuyEnquiry {
  const buyer = asRaw(raw.buyerSnapshot ?? raw.buyerId);
  const property = asRaw(raw.propertySnapshot ?? raw.propertyId);
  return {
    id: idOf(raw),
    referenceId: str(raw.referenceId, idOf(raw)),
    buyerId: idOf(raw.buyerId),
    buyerName: str(buyer.name, 'Buyer'),
    phone: str(buyer.phone),
    email: strOrNull(buyer.email),
    userType: str(buyer.userType, 'resident').toLowerCase(),
    propertyId: idOf(raw.propertyId),
    propertyTitle: str(property.title, 'Property'),
    propertyType: str(property.type),
    propertyPrice: num(property.price) ?? 0,
    propertyLocation: str(property.location),
    enquiryTypes: strArr(raw.enquiryTypes),
    interest: str(raw.interestType, 'more_details'),
    preferredContact: str(raw.preferredContact, 'phone'),
    preferredVisitTime: strOrNull(raw.preferredVisitTime),
    preferredVisitDate: iso(raw.preferredVisitDate),
    preferredVisitTimeSlot: strOrNull(raw.preferredVisitTimeSlot),
    message: str(raw.additionalMessage),
    status: str(raw.status, 'new'),
    assignedTo: raw.assignedTo ? idOf(raw.assignedTo) : null,
    assignedName: refName(raw.assignedTo),
    duplicateOf: raw.duplicateOf ? idOf(raw.duplicateOf) : null,
    dealId: raw.dealId || raw.salesDealId || raw.convertedDealId ? idOf(raw.dealId ?? raw.salesDealId ?? raw.convertedDealId) : null,
    source: str(raw.source, 'app'),
    notes: str(raw.notes),
    createdAt: iso(raw.submittedAt ?? raw.createdAt) ?? new Date().toISOString(),
  };
}

/** GET /api/v1/admin/buy-enquiries (all pages, newest first) */
export const listBuyEnquiries = (signal?: AbortSignal, query: Record<string, string | undefined> = {}) =>
  fetchAllPages('/v1/admin/buy-enquiries', mapBuyEnquiry, { sort: 'newest', ...query }, signal);

/** GET /api/v1/admin/buy-enquiries/:enquiryId */
export async function getBuyEnquiry(id: string, signal?: AbortSignal) {
  return mapBuyEnquiry(asRaw(await apiRequest<Raw>(`/v1/admin/buy-enquiries/${id}`, { signal })));
}

/** PATCH /api/v1/admin/buy-enquiries/:enquiryId — { status?, assignedTo?, preferredContact?, notes? } */
export async function updateBuyEnquiry(id: string, body: { status?: string; assignedTo?: string; preferredContact?: string; notes?: string | null }) {
  return mapBuyEnquiry(asRaw(await apiRequest<Raw>(`/v1/admin/buy-enquiries/${id}`, { method: 'PATCH', body })));
}

/** POST /api/v1/admin/buy-enquiries/:enquiryId/convert-to-deal → created sales deal */
export async function convertEnquiryToDeal(id: string): Promise<{ id: string }> {
  const raw = asRaw(await apiRequest<Raw>(`/v1/admin/buy-enquiries/${id}/convert-to-deal`, { method: 'POST' }));
  const deal = asRaw(raw.deal ?? raw);
  return { id: idOf(deal) };
}
