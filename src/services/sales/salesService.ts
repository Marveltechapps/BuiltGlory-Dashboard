import { apiRequest, apiRequestEnvelope } from '../../lib/apiClient';
import { fetchAllPages } from '../../lib/paging';
import { arr, asRaw, bool, idOf, iso, nameOf, num, str, strArr, type Raw } from '../../lib/raw';
import type { AdminPayment, DealRecommendation, Milestone, SalesDeal } from '../../types/sales';

const D = 864e5;

function mapMilestones(stage: Raw): Milestone[] {
  return arr(stage.milestones ?? stage.stages ?? stage.installments).map((m, i) => {
    const x = asRaw(m);
    return {
      id: idOf(x) || str(x.key, 'MS-' + (i + 1)),
      name: str(x.name ?? x.title ?? x.label, 'Milestone ' + (i + 1)),
      amount: num(x.amount) ?? 0,
      dueDate: iso(x.dueDate),
      status: str(x.status, 'pending'),
      proofUrl: str(x.proofUrl),
      proofSubmittedAt: iso(x.proofSubmittedAt ?? x.proofUploadedAt),
      paidAt: iso(x.paidAt ?? x.verifiedAt),
    };
  });
}

export function mapSalesDeal(raw: Raw): SalesDeal {
  const buyer = asRaw(raw.buyerSnapshot ?? raw.buyerId);
  const property = asRaw(raw.propertySnapshot ?? raw.propertyId);
  const fin = asRaw(raw.financials);
  const re = asRaw(raw.reengagement);
  const createdAt = iso(raw.createdAt) ?? new Date().toISOString();
  const lastActivityAt = iso(raw.lastActivityAt ?? raw.updatedAt) ?? createdAt;
  const history = arr(raw.stageHistory).map((h) => {
    const x = asRaw(h);
    return { from: str(x.from), to: str(x.to ?? x.stage), changedAt: iso(x.changedAt ?? x.enteredAt) ?? '', notes: str(x.notes) };
  });
  const latest = [...history].reverse().find((h) => h.to === raw.stage);
  const stageEnteredAt = latest?.changedAt || lastActivityAt;
  const stagePayment = asRaw(fin.stagePayment ?? raw.stagePayment);
  return {
    id: idOf(raw),
    referenceId: str(raw.referenceId, idOf(raw)),
    stage: str(raw.stage, 'active_leads'),
    priority: str(raw.priority, 'normal'),
    buyerId: idOf(raw.buyerId),
    buyerName: str(buyer.name ?? buyer.fullName, 'Unknown buyer'),
    buyerPhone: str(buyer.phone ?? buyer.mobile),
    buyerEmail: str(buyer.email),
    buyerType: str(buyer.userType, 'resident').toLowerCase(),
    propertyId: idOf(raw.propertyId),
    propertyTitle: str(property.title ?? raw.propertyTitle, 'Untitled property'),
    propertyType: str(property.type ?? raw.propertyType, 'property'),
    propertyLocation: str(property.location ?? raw.propertyLocation),
    listedPrice: num(property.price ?? raw.propertyPrice) ?? 0,
    offeredPrice: num(fin.offeredPrice ?? raw.offeredPrice),
    agreedPrice: num(fin.agreedPrice ?? raw.agreedPrice),
    tokenAmount: num(fin.tokenAmount ?? raw.tokenAmount),
    tokenPaid: bool(fin.tokenPaid ?? raw.tokenPaid),
    tokenPayment: asRaw(fin.tokenPayment ?? raw.tokenPayment),
    paymentType: (() => {
      const v = fin.paymentType ?? raw.paymentType;
      return v === 'full' || v === 'stage' ? v : null;
    })(),
    totalPaid: num(fin.totalPaid ?? raw.totalPaid) ?? 0,
    fullPayment: asRaw(fin.fullPayment ?? raw.fullPayment),
    stagePayment,
    milestones: mapMilestones(stagePayment),
    interiorDesign: asRaw(fin.interiorDesign ?? raw.interiorDesign),
    documentation: asRaw(raw.documentation),
    assignedTo: raw.assignedTo ? idOf(raw.assignedTo) : null,
    assignedName: raw.assignedTo && typeof raw.assignedTo === 'object' ? nameOf(raw.assignedTo) || null : null,
    sourceEnquiryId: raw.sourceEnquiryId ? idOf(raw.sourceEnquiryId) : null,
    lostReason: str(raw.lostReason),
    lostAtStage: str(raw.lostAtStage ?? raw.lostStage),
    closedAt: iso(raw.closedAt),
    reengagement: { followUpAt: iso(re.followUpAt), lastContactAt: iso(re.lastContactAt), attempts: num(re.attempts) ?? 0 },
    stageEnteredAt,
    daysInStage: num(raw.daysInStage) ?? Math.max(0, Math.floor((Date.now() - Date.parse(stageEnteredAt)) / D)),
    lastActivityAt,
    createdAt,
    photos: strArr(raw.photos ?? property.photos ?? (property.image ? [property.image] : [])),
    stageHistory: history,
  };
}

/** GET /api/v1/admin/sales/deals (all pages) */
export const listSalesDeals = (signal?: AbortSignal) => fetchAllPages('/v1/admin/sales/deals', mapSalesDeal, { sort: 'newest' }, signal);

/** GET /api/v1/admin/sales/deals/:dealId */
export async function getSalesDeal(id: string, signal?: AbortSignal) {
  return mapSalesDeal(asRaw(await apiRequest<Raw>(`/v1/admin/sales/deals/${id}`, { signal })));
}

export interface CreateDealBody {
  buyerId: string;
  propertyId: string;
  sourceEnquiryId?: string;
  stage?: string;
  priority?: 'normal' | 'high' | 'urgent';
  assignedTo?: string;
  buyerSnapshot?: { name?: string; phone?: string; email?: string; userType?: 'resident' | 'nri' | 'pio' };
  propertySnapshot?: { title?: string; type?: string; location?: string; price?: number };
  financials?: { offeredPrice?: number | null; agreedPrice?: number | null };
}

/** POST /api/v1/admin/sales/deals */
export async function createSalesDeal(body: CreateDealBody) {
  return mapSalesDeal(asRaw(await apiRequest<Raw>('/v1/admin/sales/deals', { method: 'POST', body })));
}

/** GET /api/v1/admin/sales/deals/:dealId/recommendations */
export async function listDealRecommendations(id: string, signal?: AbortSignal): Promise<DealRecommendation[]> {
  const res = await apiRequestEnvelope<Raw[]>(`/v1/admin/sales/deals/${id}/recommendations`, { query: { limit: 6 }, signal });
  return arr(res.data).map((r) => {
    const x = asRaw(r);
    return { id: idOf(x), title: str(x.title, 'Untitled property'), price: num(x.price) ?? 0, type: str(x.type), location: str(x.location) || [str(x.locality), str(x.city)].filter(Boolean).join(', '), coverPhoto: str(x.coverPhoto), score: num(x.score) ?? 0, reason: str(x.reason, 'Recommended alternate property') };
  });
}

export type DealUpdateBody = Record<string, unknown>;

const patch = (id: string, suffix: string, body: DealUpdateBody) => apiRequest<Raw>(`/v1/admin/sales/deals/${id}${suffix}`, { method: 'PATCH', body }).then((r) => mapSalesDeal(asRaw(r)));

/** PATCH /api/v1/admin/sales/deals/:dealId (updateValidator fields: assignedTo, priority, offeredPrice, agreedPrice, notes, reengagement, …) */
export const updateSalesDeal = (id: string, body: DealUpdateBody) => patch(id, '', body);
/** PATCH /api/v1/admin/sales/deals/:dealId/stage — { stage, notes?, reason?, lostReason?, … } */
export const updateDealStage = (id: string, stage: string, body: DealUpdateBody = {}) => patch(id, '/stage', { ...body, stage });
/** PATCH /api/v1/admin/sales/deals/:dealId/offer — { offeredPrice?, agreedPrice? } */
export const updateDealOffer = (id: string, body: { offeredPrice?: number | null; agreedPrice?: number | null; notes?: string }) => patch(id, '/offer', body);
/** PATCH /api/v1/admin/sales/deals/:dealId/token-payment — { tokenAmount?, tokenPaid?, tokenPayment? } */
export const updateDealTokenPayment = (id: string, body: { tokenAmount?: number | null; tokenPaid?: boolean; tokenPayment?: Record<string, unknown> | null }) => patch(id, '/token-payment', body);
/** PATCH /api/v1/admin/sales/deals/:dealId/payment-plan — { paymentType?, totalPaid?, fullPayment?, stagePayment?, interiorDesign? } */
export const updateDealPaymentPlan = (id: string, body: DealUpdateBody) => patch(id, '/payment-plan', body);
/** PATCH /api/v1/admin/sales/deals/:dealId/documentation — { documentation } */
export const updateDealDocumentation = (id: string, body: DealUpdateBody) => patch(id, '/documentation', body);
/** PATCH /api/v1/admin/sales/deals/:dealId/close */
export const closeDeal = (id: string, body: DealUpdateBody = {}) => patch(id, '/close', body);
/** PATCH /api/v1/admin/sales/deals/:dealId/lost — { lostReason, notes? } */
export const markDealLost = (id: string, body: { lostReason: string; notes?: string }) => patch(id, '/lost', body);

function mapPayment(raw: Raw): AdminPayment {
  return {
    id: idOf(raw),
    referenceId: str(raw.referenceId),
    dealId: idOf(raw.dealId),
    propertyId: idOf(raw.propertyId),
    type: str(raw.type, 'token'),
    amount: num(raw.amount) ?? 0,
    status: str(raw.status),
    method: str(raw.method, 'bank'),
    transactionReference: str(raw.transactionReference),
    proofUrl: str(raw.proofUrl),
    notes: str(raw.notes),
    verifiedAt: iso(raw.verifiedAt),
    paidAt: iso(raw.paidAt),
    createdAt: iso(raw.createdAt) ?? '',
  };
}

/** GET /api/v1/admin/payments?dealId= */
export async function listPayments(query: { dealId?: string; status?: string; type?: string } = {}, signal?: AbortSignal): Promise<AdminPayment[]> {
  const res = await apiRequestEnvelope<Raw[]>('/v1/admin/payments', { query: { limit: 50, sort: 'newest', ...query }, signal });
  return arr(res.data).map((r) => mapPayment(asRaw(r)));
}

/** PATCH /api/v1/admin/payments/:paymentId/verify — { decision: 'paid' | 'rejected', notes? } */
export async function verifyPayment(id: string, body: { decision: 'paid' | 'rejected'; notes?: string }) {
  return mapPayment(asRaw(await apiRequest<Raw>(`/v1/admin/payments/${id}/verify`, { method: 'PATCH', body })));
}

/** POST /api/v1/admin/payments/:paymentId/refund — records one verified return transfer. */
export async function recordVerifiedRefund(id: string, body: { transactionReference: string; notes?: string }) {
  return mapPayment(asRaw(await apiRequest<Raw>(`/v1/admin/payments/${id}/refund`, { method: 'POST', body })));
}
