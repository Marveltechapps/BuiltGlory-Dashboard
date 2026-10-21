import { apiRequest } from '../../lib/apiClient';
import { fetchAllPages } from '../../lib/paging';
import { arr, asRaw, bool, idOf, iso, nameOf, num, str, strArr, strOrNull, type Raw } from '../../lib/raw';
import type { SellRequest } from '../../types/enquiries';

function photosOf(raw: Raw): string[] {
  const photos = strArr(raw.photos);
  if (photos.length) return photos;
  return arr(raw.documents)
    .map((d) => asRaw(d))
    .filter((d) => d.fileUrl && !['rejected', 'missing'].includes(str(d.status)) && /\.(png|jpe?g|webp|gif)(\?|$)/i.test(str(d.fileUrl)))
    .map((d) => str(d.fileUrl));
}

export function mapSellRequest(raw: Raw): SellRequest {
  const seller = asRaw(raw.sellerSnapshot ?? raw.sellerId);
  const address = asRaw(raw.address);
  const metrics = asRaw(raw.metrics);
  const sale = asRaw(raw.sale);
  const specsRaw = asRaw(raw.specifications);
  const specifications = Object.fromEntries(Object.entries(specsRaw).filter(([, v]) => v !== null && v !== undefined && v !== '').map(([k, v]) => [k, String(v)]));
  const photos = photosOf(raw);
  const documents = arr(raw.documents).map((d) => {
    const x = asRaw(d);
    return { name: str(x.name, 'Document'), status: str(x.status, 'uploaded'), fileUrl: str(x.fileUrl) };
  });
  const askingPrice = num(raw.askingPrice) ?? 0;
  const description = str(raw.description);
  const amenities = strArr(raw.amenities);
  const locality = str(address.locality);
  const city = str(address.city);
  const pincode = str(address.pincode);
  const street = str(address.street);
  const docCount = Math.max(num(raw.documentsCount) ?? 0, documents.filter((d) => d.status === 'uploaded' || d.fileUrl).length);
  const checks = [
    Object.keys(specifications).length > 0,
    Math.max(num(raw.photosCount) ?? 0, photos.length) > 0,
    askingPrice > 0,
    docCount > 0,
    !!description.trim(),
    !!(city && pincode && (locality || street)),
    amenities.length > 0,
  ];
  const computed = Math.round((checks.filter(Boolean).length / checks.length) * 100);
  const status = bool(raw.isDraft) ? 'draft' : str(raw.status, 'new');
  return {
    id: idOf(raw),
    referenceId: str(raw.referenceId, idOf(raw)),
    sellerId: idOf(raw.sellerId),
    sellerName: str(seller.name, 'Seller'),
    phone: str(seller.phone),
    email: strOrNull(seller.email),
    kycStatus: str(seller.kycStatus, 'pending'),
    userType: str(seller.userType, 'resident').toLowerCase(),
    title: str(raw.propertyTitle, 'Seller property'),
    type: str(raw.propertyType, 'property'),
    askingPrice,
    negotiable: bool(raw.negotiable),
    street,
    locality,
    city,
    state: str(address.state),
    pincode,
    landmark: str(address.landmark),
    ownershipType: str(raw.ownershipType),
    possessionStatus: str(raw.possessionStatus),
    loanOnProperty: bool(raw.loanOnProperty),
    description,
    amenities,
    specifications,
    photos,
    documents,
    completeness: num(raw.completenessPercent ?? raw.completeness) ?? computed,
    status,
    assignedTo: raw.assignedTo ? idOf(raw.assignedTo) : null,
    assignedName: raw.assignedTo && typeof raw.assignedTo === 'object' ? nameOf(raw.assignedTo) : null,
    rejectionReason: str(raw.rejectionReason),
    pauseReason: str(raw.pauseReason),
    changeRequests: strArr(raw.changeRequests),
    acquisitionId: raw.acquisitionId ? idOf(raw.acquisitionId) : null,
    duplicateOf: raw.duplicateOf ? idOf(raw.duplicateOf) : null,
    metrics: { views: num(metrics.views) ?? 0, enquiryCount: num(metrics.enquiryCount) ?? 0, visitCount: num(metrics.visitCount) ?? 0, saveCount: num(metrics.saveCount) ?? 0 },
    sale: { salePrice: num(sale.salePrice), saleDate: iso(sale.saleDate), buyerName: strOrNull(sale.buyerName) },
    createdAt: iso(raw.submittedAt ?? raw.createdAt) ?? new Date().toISOString(),
    updatedAt: iso(raw.updatedAt ?? raw.createdAt) ?? new Date().toISOString(),
  };
}

/** GET /api/v1/admin/sell-requests (all pages, newest first) */
export const listSellRequests = (signal?: AbortSignal, query: Record<string, string | undefined> = {}) =>
  fetchAllPages('/v1/admin/sell-requests', mapSellRequest, { sort: 'newest', ...query }, signal);

/** GET /api/v1/admin/sell-requests/:sellRequestId */
export async function getSellRequest(id: string, signal?: AbortSignal) {
  return mapSellRequest(asRaw(await apiRequest<Raw>(`/v1/admin/sell-requests/${id}`, { signal })));
}

/** PATCH /api/v1/admin/sell-requests/:sellRequestId — { assignedTo } */
export async function assignSellRequest(id: string, assignedTo: string | null) {
  return mapSellRequest(asRaw(await apiRequest<Raw>(`/v1/admin/sell-requests/${id}`, { method: 'PATCH', body: { assignedTo } })));
}

export interface SellReviewBody {
  decision: 'under_review' | 'changes_requested' | 'rejected' | 'accepted' | 'approved' | 'active' | 'negotiating' | 'paused' | 'sold';
  notes?: string;
  reason?: string;
  rejectionReason?: string;
  pauseReason?: string;
  changeRequests?: string[];
  salePrice?: number;
  saleDate?: string;
  saleBuyerName?: string;
}

/** PATCH /api/v1/admin/sell-requests/:sellRequestId/review */
export async function reviewSellRequest(id: string, body: SellReviewBody) {
  return mapSellRequest(asRaw(await apiRequest<Raw>(`/v1/admin/sell-requests/${id}/review`, { method: 'PATCH', body })));
}

/** POST /api/v1/admin/sell-requests/:sellRequestId/create-acquisition → acquisition */
export async function createAcquisitionFromSell(id: string): Promise<{ id: string; referenceId: string }> {
  const raw = asRaw(await apiRequest<Raw>(`/v1/admin/sell-requests/${id}/create-acquisition`, { method: 'POST' }));
  const acq = asRaw(raw.acquisition ?? raw);
  return { id: idOf(acq), referenceId: str(acq.referenceId, idOf(acq)) };
}
