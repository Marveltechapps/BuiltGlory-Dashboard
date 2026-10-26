import { apiRequest } from '../../lib/apiClient';
import { fetchAllPages } from '../../lib/paging';
import { isoDay } from '../../lib/format';
import { arr, asRaw, idOf, iso, nameOf, num, str, strArr, strOrNull, type Raw } from '../../lib/raw';
import type { Visit } from '../../types/enquiries';

export function mapVisit(raw: Raw): Visit {
  const buyer = asRaw(raw.buyerSnapshot ?? raw.buyerId);
  const property = asRaw(raw.propertySnapshot ?? raw.propertyId);
  const fb = asRaw(raw.feedback);
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
    propertyPrice: num(property.price),
    propertyAddress: str(property.location ?? property.address),
    propertyImage: str(property.image),
    visitDate: isoDay(str(raw.visitDate)),
    visitTime: str(raw.visitTime, '10:00'),
    visitType: str(raw.visitType, 'physical'),
    status: str(raw.status, 'scheduled'),
    meetingLink: strOrNull(raw.meetingLink),
    virtualPlatform: strOrNull(raw.virtualPlatform),
    recordingUrl: strOrNull(raw.virtualRecordingUrl),
    callDuration: num(raw.callDuration),
    callNotes: str(raw.callNotes),
    assignedTo: raw.assignedAdmin ? idOf(raw.assignedAdmin) : null,
    assignedName: raw.assignedAdmin && typeof raw.assignedAdmin === 'object' ? nameOf(raw.assignedAdmin) : null,
    feedback: fb.buyerInterest ? { buyerInterest: str(fb.buyerInterest), notes: str(fb.notes), nextAction: str(fb.nextAction), completedAt: iso(fb.completedAt) } : null,
    callLogs: arr(raw.callLogs).map((l, i) => {
      const x = asRaw(l);
      return { id: idOf(x) || String(i), outcome: str(x.outcome), notes: str(x.notes), duration: num(x.duration) ?? 0, at: iso(x.calledAt ?? x.createdAt) ?? '' };
    }),
    notes: arr(raw.notes ?? raw.visitNotes).map((n, i) => {
      const x = asRaw(n);
      return { id: idOf(x) || String(i), text: str(x.text), at: iso(x.createdAt) ?? '' };
    }),
    nriChecklist: Object.fromEntries(Object.entries(asRaw(raw.nriChecklist)).map(([k, v]) => [k, v === true])),
    nriAssistanceNotes: str(raw.nriAssistanceNotes),
    documentsShared: strArr(raw.documentsShared),
    followUpAction: str(raw.followUpAction),
    followUpDate: iso(raw.followUpDate),
    rescheduleHistory: arr(raw.rescheduleHistory).map((e) => {
      const x = asRaw(e);
      return { previousDate: isoDay(str(x.previousDate)), previousTime: str(x.previousTime), newDate: isoDay(str(x.newDate)), newTime: str(x.newTime), reason: str(x.reason), at: iso(x.changedAt) ?? '' };
    }),
    cancelReason: str(raw.cancelReason),
    reminderSent: raw.reminderSent === true,
    createdAt: iso(raw.createdAt) ?? new Date().toISOString(),
  };
}

/** GET /api/v1/admin/visits (all pages) */
export const listVisits = (signal?: AbortSignal) => fetchAllPages('/v1/admin/visits', mapVisit, { sort: 'newest' }, signal);

/** GET /api/v1/admin/visits/:visitId */
export async function getVisit(id: string, signal?: AbortSignal) {
  return mapVisit(asRaw(await apiRequest<Raw>(`/v1/admin/visits/${id}`, { signal })));
}

export interface VisitStatusBody {
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'missed' | 'rescheduled';
  visitDate?: string;
  visitTime?: string;
  notes?: string;
  reason?: string;
  cancelReason?: string;
  meetingLink?: string | null;
  virtualPlatform?: 'zoom' | 'google_meet' | 'teams' | 'whatsapp_video' | null;
  assignedAdmin?: string;
  feedback?: { buyerInterest: string; notes: string; nextAction: string };
  virtualRecordingUrl?: string | null;
  callDuration?: number | null;
  callNotes?: string | null;
  documentsShared?: string[];
  followUpAction?: string | null;
  followUpDate?: string | null;
  completedAt?: string | null;
  nriChecklist?: Record<string, boolean>;
  nriAssistanceNotes?: string | null;
  reminderSent?: boolean;
  callLog?: { outcome?: string; notes?: string; duration?: number; calledAt?: string };
  note?: { text: string };
}

export interface AdminVisitBody {
  buyerId: string;
  propertyId: string;
  enquiryId?: string;
  visitDate: string;
  visitTime: string;
  visitType: 'physical' | 'virtual';
  meetingLink?: string;
  virtualPlatform?: VisitStatusBody['virtualPlatform'];
  assignedAdmin?: string;
}

/** POST /api/v1/admin/visits */
export async function createAdminVisit(body: AdminVisitBody) {
  return mapVisit(asRaw(await apiRequest<Raw>('/v1/admin/visits', { method: 'POST', body })));
}

/** PATCH /api/v1/admin/visits/:visitId/status */
export async function updateVisitStatus(id: string, body: VisitStatusBody) {
  return mapVisit(asRaw(await apiRequest<Raw>(`/v1/admin/visits/${id}/status`, { method: 'PATCH', body })));
}

/** POST /api/v1/admin/visits/:visitId/feedback */
export async function submitVisitFeedback(id: string, body: { feedback: { buyerInterest: string; notes: string; nextAction: string }; notes?: string; outcome?: string }) {
  return mapVisit(asRaw(await apiRequest<Raw>(`/v1/admin/visits/${id}/feedback`, { method: 'POST', body })));
}

/** POST /api/v1/admin/visits/:visitId/call-logs — { outcome?, notes? } */
export async function addVisitCallLog(id: string, body: { outcome?: string; notes?: string }) {
  return mapVisit(asRaw(await apiRequest<Raw>(`/v1/admin/visits/${id}/call-logs`, { method: 'POST', body })));
}
