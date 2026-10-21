import { apiRequest, apiRequestEnvelope } from '../../lib/apiClient';
import { asRaw, arr, idOf, iso, num, str, type Raw } from '../../lib/raw';
import type { CreateLogBody, EditLock, EntityType, LogChannel, WorkflowLog } from '../../types/workflow';

export function mapLog(raw: Raw): WorkflowLog {
  const actor = asRaw(raw.actorId);
  return {
    id: idOf(raw),
    entityType: str(raw.entityType) as EntityType,
    entityId: idOf(raw.entityId),
    channel: str(raw.channel, 'note') as LogChannel,
    direction: str(raw.direction, 'internal') as WorkflowLog['direction'],
    summary: str(raw.summary),
    body: str(raw.body),
    outcome: str(raw.outcome),
    durationMinutes: num(raw.durationMinutes),
    occurredAt: iso(raw.occurredAt ?? raw.createdAt) ?? new Date().toISOString(),
    actorName: str(raw.actorName ?? actor.name ?? actor.email, 'Admin'),
    attachments: arr(raw.attachments).map((a) => {
      const x = asRaw(a);
      return { fileName: str(x.fileName, 'Attachment'), url: str(x.url), mimeType: str(x.mimeType), sizeBytes: Number(x.sizeBytes) || 0 };
    }),
  };
}

const base = (type: EntityType, id: string) => `/v1/admin/workflow/${type}/${id}`;

/** GET /api/v1/admin/workflow/:entityType/:entityId/logs */
export async function listLogs(type: EntityType, id: string, channel?: LogChannel, signal?: AbortSignal): Promise<WorkflowLog[]> {
  const res = await apiRequestEnvelope<Raw[]>(`${base(type, id)}/logs`, { query: { channel, limit: 100 }, signal });
  return arr(res.data).map((r) => mapLog(asRaw(r)));
}

/** GET /api/v1/admin/:entityType/:entityId/timeline */
export async function getTimeline(type: EntityType, id: string, signal?: AbortSignal): Promise<WorkflowLog[]> {
  const res = await apiRequestEnvelope<Raw[]>(`/v1/admin/${type}/${id}/timeline`, { query: { limit: 50 }, signal });
  return arr(res.data).map((r) => mapLog(asRaw(r)));
}

/** POST /api/v1/admin/workflow/:entityType/:entityId/logs */
export async function createLog(type: EntityType, id: string, body: CreateLogBody): Promise<WorkflowLog> {
  return mapLog(asRaw(await apiRequest<Raw>(`${base(type, id)}/logs`, { method: 'POST', body })));
}

/** DELETE /api/v1/admin/workflow/logs/:logId */
export function deleteLog(logId: string) {
  return apiRequest<unknown>(`/v1/admin/workflow/logs/${logId}`, { method: 'DELETE' });
}

/** POST /api/v1/admin/workflow/:entityType/:entityId/email */
export async function sendEmail(type: EntityType, id: string, body: { to: string; subject: string; body: string; summary?: string }) {
  return mapLog(asRaw(await apiRequest<Raw>(`${base(type, id)}/email`, { method: 'POST', body })));
}

/** POST /api/v1/admin/workflow/:entityType/:entityId/push */
export async function sendPush(
  type: EntityType,
  id: string,
  body: { userId?: string | null; recipient?: string | null; notificationId: string; audience?: 'buyer' | 'seller'; template: { title: string; body: string; deepLink?: string } },
) {
  return mapLog(asRaw(await apiRequest<Raw>(`${base(type, id)}/push`, { method: 'POST', body })));
}

/** POST /api/v1/admin/workflow/:entityType/:entityId/proofs (multipart, field `file`) */
export async function uploadProof(type: EntityType, id: string, file: File, meta: { summary?: string; notes?: string } = {}) {
  const fd = new FormData();
  fd.append('file', file);
  if (meta.summary) fd.append('summary', meta.summary);
  if (meta.notes) fd.append('notes', meta.notes);
  return mapLog(asRaw(await apiRequest<Raw>(`${base(type, id)}/proofs`, { method: 'POST', formData: fd })));
}

/** GET / POST / DELETE /api/v1/admin/workflow/:entityType/:entityId/lock */
export const getLock = (type: EntityType, id: string, signal?: AbortSignal) => apiRequest<EditLock | null>(`${base(type, id)}/lock`, { signal });
export const claimLock = (type: EntityType, id: string, ttlSeconds = 1800) => apiRequest<EditLock | null>(`${base(type, id)}/lock`, { method: 'POST', body: { ttlSeconds } });
export const releaseLock = (type: EntityType, id: string) => apiRequest<{ released: boolean }>(`${base(type, id)}/lock`, { method: 'DELETE' });
