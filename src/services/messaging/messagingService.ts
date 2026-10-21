import { apiRequest, apiRequestEnvelope } from '../../lib/apiClient';
import { arr, asRaw, idOf, iso, num, str, type Raw } from '../../lib/raw';
import type { WorkflowLog } from '../../types/workflow';
import { mapLog } from '../workflow/workflowService';

/** `GET /api/v1/admin/message-templates` item */
export interface MessageTemplate {
  id: string;
  referenceId: string;
  name: string;
  channel: 'whatsapp' | 'email' | 'sms' | string;
  category: string;
  subject: string;
  body: string;
}

/** Template payload (no validator in the contract; fields the previous dashboard sent). */
export interface TemplatePayload {
  name: string;
  channel: 'whatsapp' | 'email' | 'sms';
  category: string;
  subject?: string;
  body: string;
}

/** `GET /api/v1/admin/bulk-messages` item */
export interface BulkMessage {
  id: string;
  referenceId: string;
  message: string;
  channel: string;
  audience: string;
  recipients: number;
  sentBy: string;
  date: string;
  scheduledAt: string | null;
  status: string;
}

/** Bulk message payload (no validator in the contract; fields the previous dashboard sent). */
export interface BulkPayload {
  audience: string;
  channel: 'whatsapp' | 'email' | 'sms';
  title?: string;
  message: string;
  recipients?: string[];
  templateId?: string;
  scheduledAt?: string;
}

function mapTemplate(raw: Raw): MessageTemplate {
  return {
    id: idOf(raw),
    referenceId: str(raw.referenceId, idOf(raw)),
    name: str(raw.name, 'Untitled template'),
    channel: str(raw.channel, 'whatsapp'),
    category: str(raw.category, 'General'),
    subject: str(raw.subject),
    body: str(raw.body),
  };
}

function mapBulk(raw: Raw): BulkMessage {
  const by = asRaw(raw.requestedBy);
  return {
    id: idOf(raw),
    referenceId: str(raw.referenceId, idOf(raw)),
    message: str(raw.message),
    channel: str(raw.channel, 'whatsapp'),
    audience: str(raw.audience),
    recipients: Array.isArray(raw.recipients) ? raw.recipients.length : num(raw.queuedCount ?? raw.recipientCount) ?? 0,
    sentBy: str(by.name, 'Admin'),
    date: iso(raw.sentAt ?? raw.createdAt) ?? '',
    scheduledAt: iso(raw.scheduledAt),
    status: str(raw.status, 'queued'),
  };
}

/** GET /api/v1/admin/message-templates */
export async function listTemplates(signal?: AbortSignal) {
  const r = await apiRequestEnvelope<Raw[]>('/v1/admin/message-templates', { signal });
  return arr(r.data).map((x) => mapTemplate(asRaw(x)));
}

/** POST /api/v1/admin/message-templates */
export async function createTemplate(body: TemplatePayload) {
  return mapTemplate(asRaw(await apiRequest<Raw>('/v1/admin/message-templates', { method: 'POST', body })));
}

/** PATCH /api/v1/admin/message-templates/:id */
export async function updateTemplate(id: string, body: Partial<TemplatePayload>) {
  return mapTemplate(asRaw(await apiRequest<Raw>(`/v1/admin/message-templates/${id}`, { method: 'PATCH', body })));
}

/** DELETE /api/v1/admin/message-templates/:id */
export const deleteTemplate = (id: string) => apiRequest<unknown>(`/v1/admin/message-templates/${id}`, { method: 'DELETE' });

/** GET /api/v1/admin/bulk-messages */
export async function listBulkMessages(signal?: AbortSignal) {
  const r = await apiRequestEnvelope<Raw[]>('/v1/admin/bulk-messages', { query: { limit: 20 }, signal });
  return arr(r.data).map((x) => mapBulk(asRaw(x)));
}

/** POST /api/v1/admin/bulk-messages */
export async function sendBulkMessage(body: BulkPayload) {
  return mapBulk(asRaw(await apiRequest<Raw>('/v1/admin/bulk-messages', { method: 'POST', body })));
}

/** GET /api/v1/admin/communication-logs — outgoing WhatsApp / email / SMS messages across records. */
export async function listMessageHistory(search: string, signal?: AbortSignal): Promise<WorkflowLog[]> {
  const r = await apiRequestEnvelope<Raw[]>('/v1/admin/communication-logs', {
    query: { limit: 100, channel: ['whatsapp', 'email', 'message'], direction: 'outbound', search: search.trim() || undefined },
    signal,
  });
  return arr(r.data).map((x) => mapLog(asRaw(x)));
}
