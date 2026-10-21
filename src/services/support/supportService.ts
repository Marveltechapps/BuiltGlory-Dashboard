import { apiRequest, apiRequestEnvelope } from '../../lib/apiClient';
import { fetchAllPages } from '../../lib/paging';
import { arr, asRaw, idOf, iso, str, type Raw } from '../../lib/raw';

export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface TicketResponse {
  id: string;
  author: string;
  message: string;
  at: string;
  responderType: string;
}

/** `GET /api/v1/admin/support/tickets[/:ticketId]` (normalised) */
export interface SupportTicket {
  id: string;
  referenceId: string;
  userId: string;
  userName: string;
  phone: string;
  email: string;
  category: string;
  subject: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  channel: 'ticket' | 'live_chat' | string;
  createdAt: string;
  updatedAt: string;
  assignedTo: string | null;
  assignedToName: string;
  responses: TicketResponse[];
}

/** `GET /api/v1/admin/feedback` item */
export interface AppFeedback {
  id: string;
  referenceId: string;
  userId: string;
  userName: string;
  message: string;
  source: string;
  sourceScreen: string;
  status: 'new' | 'reviewed' | 'archived' | string;
  createdAt: string;
}

/** `GET /api/v1/admin/audit-logs` item */
export interface AuditEntry {
  id: string;
  action: string;
  description: string;
  admin: string;
  section: string;
  resourceType: string;
  resourceId: string | null;
  before: string | null;
  after: string | null;
  ip: string;
  device: string;
  at: string;
}

const entityName = (v: unknown) => (v && typeof v === 'object' ? str(asRaw(v).name || asRaw(v).email || asRaw(v).referenceId) || null : null);
const oneOf = <T extends string>(v: unknown, list: readonly T[], d: T): T => (list.includes(String(v ?? '') as T) ? (String(v) as T) : d);
const humanize = (v: string) => v.replace(/[_:.-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).trim();
const diff = (v: unknown) => (v == null ? null : typeof v === 'string' ? v : JSON.stringify(v));

export function mapTicket(raw: Raw): SupportTicket {
  const user = asRaw(raw.userId);
  const createdAt = iso(raw.createdAt) ?? '';
  return {
    id: idOf(raw),
    referenceId: str(raw.referenceId, idOf(raw)),
    userId: idOf(raw.userId),
    userName: entityName(user) ?? str(raw.userName, 'Unknown customer'),
    phone: str(user.phone ?? user.mobileNumber ?? user.phoneNormalized ?? raw.phone),
    email: str(user.email ?? raw.email),
    category: str(raw.category, 'general'),
    subject: str(raw.subject, 'Support ticket'),
    description: str(raw.message ?? raw.description),
    status: oneOf<TicketStatus>(raw.status, ['open', 'in_progress', 'resolved', 'closed'], 'open'),
    priority: oneOf<TicketPriority>(raw.priority, ['low', 'medium', 'high', 'urgent'], 'medium'),
    channel: str(raw.channel, 'ticket'),
    createdAt,
    updatedAt: iso(raw.updatedAt ?? raw.createdAt) ?? createdAt,
    assignedTo: raw.assignedTo ? idOf(raw.assignedTo) : null,
    assignedToName: entityName(raw.assignedTo) ?? '',
    responses: arr(raw.responses).map((r, i) => {
      const x = asRaw(r);
      const type = str(x.responderType, 'admin');
      return {
        id: idOf(x) || idOf(raw) + '-r' + i,
        author: entityName(x.responderId) ?? (type === 'customer' ? entityName(user) ?? 'Customer' : type === 'system' ? 'System' : 'Admin'),
        message: str(x.message),
        at: iso(x.createdAt ?? x.at) ?? createdAt,
        responderType: type,
      };
    }),
  };
}

function mapFeedback(raw: Raw): AppFeedback {
  const user = asRaw(raw.userId);
  return {
    id: idOf(raw),
    referenceId: str(raw.referenceId, idOf(raw)),
    userId: idOf(raw.userId),
    userName: entityName(user) ?? str(raw.userName, 'Unknown customer'),
    message: str(raw.message),
    source: str(raw.source, 'customer_app'),
    sourceScreen: str(raw.sourceScreen),
    status: str(raw.status, 'new'),
    createdAt: iso(raw.createdAt) ?? '',
  };
}

function mapAudit(raw: Raw): AuditEntry {
  const action = str(raw.action, 'updated');
  const resourceType = str(raw.resourceType, 'admin');
  return {
    id: idOf(raw),
    action,
    description: str(raw.description) || humanize(action) + (raw.resourceId ? ' · ' + humanize(resourceType) : ''),
    admin: entityName(raw.actorId) ?? humanize(str(raw.actorType, 'system')),
    section: humanize(resourceType),
    resourceType,
    resourceId: raw.resourceId ? idOf(raw.resourceId) : null,
    before: diff(raw.before),
    after: diff(raw.after),
    ip: str(raw.ipAddress, '-'),
    device: str(raw.userAgent, '-'),
    at: iso(raw.createdAt) ?? '',
  };
}

/** GET /api/v1/admin/support/tickets (all pages, newest first) */
export const listTickets = (signal?: AbortSignal) => fetchAllPages('/v1/admin/support/tickets', mapTicket, { sort: 'newest' }, signal, 5);

/** GET /api/v1/admin/support/tickets/:ticketId */
export async function getTicket(id: string, signal?: AbortSignal) {
  return mapTicket(asRaw(await apiRequest<Raw>(`/v1/admin/support/tickets/${id}`, { signal })));
}

export interface TicketUpdate {
  message?: string;
  resolve?: boolean;
  status?: TicketStatus;
  priority?: TicketPriority;
  assignedTo?: string | null;
  escalation?: { targetAssignee: string; reason: string };
}

/** POST /api/v1/admin/support/tickets/:ticketId/responses */
export async function respondToTicket(id: string, body: TicketUpdate) {
  return mapTicket(asRaw(await apiRequest<Raw>(`/v1/admin/support/tickets/${id}/responses`, { method: 'POST', body })));
}

/** PATCH /api/v1/admin/support/tickets/:ticketId */
export async function updateTicket(id: string, body: TicketUpdate) {
  return mapTicket(asRaw(await apiRequest<Raw>(`/v1/admin/support/tickets/${id}`, { method: 'PATCH', body })));
}

/** POST /api/v1/admin/support/tickets/:ticketId/read */
export const markTicketRead = (id: string) => apiRequest<Raw>(`/v1/admin/support/tickets/${id}/read`, { method: 'POST' });
/** POST /api/v1/admin/support/tickets/:ticketId/close */
export const closeTicket = (id: string) => apiRequest<Raw>(`/v1/admin/support/tickets/${id}/close`, { method: 'POST' });
/** POST /api/v1/admin/support/tickets/:ticketId/reopen */
export const reopenTicket = (id: string) => apiRequest<Raw>(`/v1/admin/support/tickets/${id}/reopen`, { method: 'POST' });

/** GET /api/v1/admin/feedback (all pages, newest first) */
export const listFeedback = (signal?: AbortSignal) => fetchAllPages('/v1/admin/feedback', mapFeedback, { sort: 'newest' }, signal, 5);

/** PATCH /api/v1/admin/feedback/:id — { status } */
export const updateFeedbackStatus = (id: string, status: 'new' | 'reviewed' | 'archived') => apiRequest<Raw>(`/v1/admin/feedback/${id}`, { method: 'PATCH', body: { status } });

/** GET /api/v1/admin/audit-logs (limit 100 per page, newest first) */
export async function listAuditLogs(search: string, signal?: AbortSignal) {
  const r = await apiRequestEnvelope<Raw[]>('/v1/admin/audit-logs', { query: { limit: 100, sort: 'newest', search: search.trim() || undefined }, signal });
  return { items: arr(r.data).map((x) => mapAudit(asRaw(x))), total: Number(r.meta?.total) || arr(r.data).length };
}
