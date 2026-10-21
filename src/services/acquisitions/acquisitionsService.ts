import { apiRequest } from '../../lib/apiClient';
import { fetchAllPages } from '../../lib/paging';
import { arr, asRaw, idOf, iso, nameOf, num, str, strArr, type Raw } from '../../lib/raw';
import type { Acquisition } from '../../types/acquisitions';

const D = 864e5;

export function mapAcquisition(raw: Raw): Acquisition {
  const seller = asRaw(raw.sellerSnapshot ?? raw.sellerId);
  const details = asRaw(raw.propertyDetails);
  const address = asRaw(details.address);
  const createdAt = iso(raw.createdAt) ?? new Date().toISOString();
  const lastActivityAt = iso(raw.lastActivityAt ?? raw.updatedAt) ?? createdAt;
  const history = arr(raw.stageHistory).map((h) => {
    const x = asRaw(h);
    return { from: str(x.from), to: str(x.to ?? x.stage), changedAt: iso(x.changedAt ?? x.enteredAt) ?? '', notes: str(x.notes) };
  });
  const latest = [...history].reverse().find((h) => h.to === raw.stage);
  const stageEnteredAt = latest?.changedAt || lastActivityAt;
  return {
    id: idOf(raw),
    referenceId: str(raw.referenceId, idOf(raw)),
    stage: str(raw.stage, 'pending_review'),
    priority: str(raw.priority, 'normal'),
    createdFrom: raw.createdFrom === 'manual' ? 'manual' : 'sell_request',
    sellRequestId: raw.sellRequestId ? idOf(raw.sellRequestId) : null,
    sellerId: idOf(raw.sellerId),
    sellerName: str(seller.name ?? seller.fullName, 'Unknown seller'),
    sellerPhone: str(seller.phone ?? seller.mobile),
    sellerEmail: str(seller.email),
    sellerKycStatus: str(seller.kycStatus, 'pending'),
    sellerType: str(seller.userType, 'resident').toLowerCase(),
    title: str(raw.propertyTitle, 'Untitled property'),
    type: str(raw.propertyType, 'property'),
    location: str(raw.propertyLocation) || [str(address.locality ?? details.locality), str(address.city ?? details.city)].filter(Boolean).join(', '),
    city: str(raw.propertyCity ?? address.city ?? details.city),
    askingPrice: num(raw.askingPrice) ?? 0,
    builtgloryOffer: num(raw.builtgloryOffer),
    agreedPrice: num(raw.agreedPrice),
    finalPurchasePrice: num(raw.finalPurchasePrice),
    assignedTo: raw.assignedTo ? idOf(raw.assignedTo) : null,
    assignedName: raw.assignedTo && typeof raw.assignedTo === 'object' ? nameOf(raw.assignedTo) || null : null,
    stageEnteredAt,
    daysInStage: num(raw.daysInStage) ?? Math.max(0, Math.floor((Date.now() - Date.parse(stageEnteredAt)) / D)),
    lastActivityAt,
    createdAt,
    photos: strArr(raw.photos ?? asRaw(raw.media).photos),
    rejectionReason: str(raw.rejectionReason),
    onHoldReason: str(raw.onHoldReason),
    notes: str(raw.notes),
    propertyDetails: details,
    valuation: asRaw(raw.valuation),
    negotiation: asRaw(raw.negotiation),
    token: asRaw(raw.token),
    documentation: asRaw(raw.documentation),
    payout: asRaw(raw.payout),
    propertyId: raw.propertyId || raw.convertedPropertyId ? idOf(raw.propertyId ?? raw.convertedPropertyId) : null,
    stageHistory: history,
  };
}

/** GET /api/v1/admin/acquisitions (all pages) */
export const listAcquisitions = (signal?: AbortSignal) => fetchAllPages('/v1/admin/acquisitions', mapAcquisition, { sort: 'newest' }, signal);

/** GET /api/v1/admin/acquisitions/:acquisitionId */
export async function getAcquisition(id: string, signal?: AbortSignal) {
  return mapAcquisition(asRaw(await apiRequest<Raw>(`/v1/admin/acquisitions/${id}`, { signal })));
}

export type AcquisitionBody = Record<string, unknown>;

/** PATCH /api/v1/admin/acquisitions/:acquisitionId — { assignedTo, priority, builtgloryOffer, agreedPrice, finalPurchasePrice, notes, … } */
export async function updateAcquisition(id: string, body: AcquisitionBody) {
  return mapAcquisition(asRaw(await apiRequest<Raw>(`/v1/admin/acquisitions/${id}`, { method: 'PATCH', body })));
}

/** PATCH /api/v1/admin/acquisitions/:acquisitionId/stage — { stage, notes?, reason?, rejectionReason?, onHoldReason?, … } */
export async function updateAcquisitionStage(id: string, stage: string, body: AcquisitionBody = {}) {
  return mapAcquisition(asRaw(await apiRequest<Raw>(`/v1/admin/acquisitions/${id}/stage`, { method: 'PATCH', body: { ...body, stage } })));
}

export type AcquisitionSection = 'valuation' | 'negotiation' | 'token' | 'documentation' | 'payout';

/** PATCH /api/v1/admin/acquisitions/:acquisitionId/{valuation|negotiation|token|documentation|payout} — body wrapped in the section key */
export async function updateAcquisitionSection(id: string, section: AcquisitionSection, data: AcquisitionBody, extra: AcquisitionBody = {}) {
  return mapAcquisition(asRaw(await apiRequest<Raw>(`/v1/admin/acquisitions/${id}/${section}`, { method: 'PATCH', body: { [section]: data, ...extra } })));
}

/** POST /api/v1/admin/acquisitions/:acquisitionId/convert-to-property → created property */
export async function convertAcquisitionToProperty(id: string): Promise<{ propertyId: string }> {
  const r = asRaw(await apiRequest<Raw>(`/v1/admin/acquisitions/${id}/convert-to-property`, { method: 'POST' }));
  return { propertyId: idOf(r.property ?? r) };
}
