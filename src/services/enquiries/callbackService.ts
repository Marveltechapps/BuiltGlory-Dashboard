import { apiRequest } from '../../lib/apiClient';
import { fetchAllPages } from '../../lib/paging';
import { arr, asRaw, idOf, iso, nameOf, num, str, strOrNull, type Raw } from '../../lib/raw';
import type { Callback } from '../../types/enquiries';

export function mapCallback(raw: Raw): Callback {
  const user = asRaw(raw.userSnapshot ?? raw.userId);
  const property = asRaw(raw.propertySnapshot ?? raw.propertyId);
  const attempts = arr(raw.attempts);
  return {
    id: idOf(raw),
    referenceId: str(raw.referenceId, idOf(raw)),
    callerId: idOf(raw.userId),
    callerName: str(user.name, 'Customer'),
    phone: str(user.phone),
    email: strOrNull(user.email),
    userType: str(raw.userType, 'buyer'),
    source: str(raw.source, 'help_support'),
    sourceScreen: str(raw.sourceScreen),
    category: str(raw.category, 'general'),
    propertyId: raw.propertyId ? idOf(raw.propertyId) : null,
    propertyTitle: str(property.title),
    reason: str(raw.reason, 'Callback requested'),
    preferredTime: strOrNull(raw.preferredTime),
    bestTimePreference: str(raw.bestTimePreference),
    status: str(raw.status, 'pending'),
    attemptCount: num(raw.attemptsCount) ?? attempts.length,
    attempts: attempts.map((a, i) => {
      const x = asRaw(a);
      return { id: idOf(x) || String(i), outcome: str(x.outcome, 'no_answer'), notes: str(x.notes), at: iso(x.attemptedAt ?? x.createdAt) ?? '' };
    }),
    resolutionNotes: str(raw.resolutionNotes),
    assignedTo: raw.assignedTo ? idOf(raw.assignedTo) : null,
    assignedName: raw.assignedTo && typeof raw.assignedTo === 'object' ? nameOf(raw.assignedTo) : null,
    slaDeadline: iso(raw.slaDeadline),
    createdAt: iso(raw.createdAt) ?? new Date().toISOString(),
    updatedAt: iso(raw.updatedAt ?? raw.createdAt) ?? new Date().toISOString(),
  };
}

/** GET /api/v1/admin/callbacks (all pages) */
export const listCallbacks = (signal?: AbortSignal) => fetchAllPages('/v1/admin/callbacks', mapCallback, { sort: 'newest' }, signal);

/** GET /api/v1/admin/callbacks/:callbackId */
export async function getCallback(id: string, signal?: AbortSignal) {
  return mapCallback(asRaw(await apiRequest<Raw>(`/v1/admin/callbacks/${id}`, { signal })));
}

export type AttemptOutcome = 'answered' | 'no_answer' | 'busy' | 'wrong_number' | 'callback_later';

/** POST /api/v1/admin/callbacks/:callbackId/attempts — { outcome?, notes?, assignedTo? } */
export async function addCallbackAttempt(id: string, body: { outcome?: AttemptOutcome; notes?: string; assignedTo?: string }) {
  return mapCallback(asRaw(await apiRequest<Raw>(`/v1/admin/callbacks/${id}/attempts`, { method: 'POST', body })));
}

/** PATCH /api/v1/admin/callbacks/:callbackId/resolve — { resolutionNotes, notes } */
export async function resolveCallback(id: string, notes: string) {
  return mapCallback(asRaw(await apiRequest<Raw>(`/v1/admin/callbacks/${id}/resolve`, { method: 'PATCH', body: { notes, resolutionNotes: notes } })));
}

/** PATCH /api/v1/admin/callbacks/:callbackId/reschedule — { preferredTime, reason, notes? } */
export async function rescheduleCallback(id: string, body: { preferredTime: string; reason: string; notes?: string }) {
  return mapCallback(asRaw(await apiRequest<Raw>(`/v1/admin/callbacks/${id}/reschedule`, { method: 'PATCH', body })));
}
