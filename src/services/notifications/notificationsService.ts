import { apiRequest, apiRequestEnvelope } from '../../lib/apiClient';
import { asRaw, arr, bool, idOf, iso, str, type Raw } from '../../lib/raw';
import type { AdminNotification } from '../../types/overview';

const EVENT_META: Record<string, { title: string; icon: string; route: string }> = {
  enquiry_created: { title: 'New enquiry received', icon: '💬', route: '/admin/enquiries/buy' },
  sell_request_submitted: { title: 'New sell request', icon: '🏠', route: '/admin/enquiries/sell' },
  visit_scheduled: { title: 'Visit scheduled', icon: '📅', route: '/admin/enquiries/visits' },
  callback_overdue: { title: 'Callback overdue', icon: '📞', route: '/admin/enquiries/callbacks' },
  support_ticket_created: { title: 'Support ticket created', icon: '🎫', route: '/admin/settings/support' },
  token_payment_created: { title: 'Payment update', icon: '💳', route: '/admin/sales/token' },
  bulk_message: { title: 'Bulk message queued', icon: '📣', route: '/admin/tools/bulkmessage' },
};

const titleFromEvent = (e: string) => e.split('_').filter(Boolean).map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');

function mapNotification(raw: Raw): AdminNotification {
  const event = str(raw.event, 'notification');
  const payload = asRaw(raw.payload);
  const meta = EVENT_META[event] ?? { title: titleFromEvent(event), icon: '🔔', route: '/admin/settings/audit' };
  const parts = [str(payload.referenceId), str(payload.status ?? raw.status)].filter(Boolean);
  return {
    id: idOf(raw),
    type: event,
    title: str(payload.title, meta.title),
    message: str(payload.message, parts.length ? parts.join(' • ') : meta.title + ' via ' + str(raw.channel, 'in-app')),
    createdAt: iso(raw.createdAt ?? raw.updatedAt) ?? new Date().toISOString(),
    read: bool(raw.isRead) || !!raw.readAt,
    route: str(payload.route, meta.route),
    icon: str(payload.icon, meta.icon),
  };
}

/** GET /api/v1/admin/notifications?limit=20&sort=newest */
export async function listNotifications(signal?: AbortSignal): Promise<AdminNotification[]> {
  const res = await apiRequestEnvelope<Raw[]>('/v1/admin/notifications', { query: { limit: 20, sort: 'newest' }, signal });
  return arr(res.data).map((r) => mapNotification(asRaw(r)));
}

/** PATCH /api/v1/admin/notifications/:id — body { isRead: true } */
export function markNotificationRead(id: string) {
  return apiRequest<Raw>(`/v1/admin/notifications/${id}`, { method: 'PATCH', body: { isRead: true } });
}

export interface SendPushBody {
  userId: string;
  audience?: 'buyer' | 'seller';
  notificationType?: string;
  title: string;
  message: string;
  screen?: string;
  propertyId?: string | null;
  dealId?: string | null;
  enquiryId?: string | null;
  entityId?: string | null;
  entityType?: string;
  dedupeKey?: string;
}

/** POST /api/v1/admin/notifications/push — one user per call (userId required). */
export function sendAdminPush(body: SendPushBody) {
  return apiRequest<Raw>('/v1/admin/notifications/push', { method: 'POST', body });
}

/** POST /api/v1/admin/notifications/:id/retry */
export function retryNotification(id: string) {
  return apiRequest<Raw>(`/v1/admin/notifications/${id}/retry`, { method: 'POST', body: {} });
}

/** Push delivery record from `GET /api/v1/admin/notifications` (channel "push"). */
export interface PushRecord {
  id: string;
  userId: string;
  userName: string;
  title: string;
  message: string;
  notificationType: string;
  audience: string;
  status: string;
  opened: boolean;
  createdAt: string;
  failureReason: string | null;
}

function mapPush(raw: Raw): PushRecord {
  const p = asRaw(raw.payload);
  const user = asRaw(raw.userId);
  return {
    id: idOf(raw),
    userId: idOf(raw.userId),
    userName: str(user.name ?? p.userName),
    title: str(raw.title ?? p.title, 'Notification'),
    message: str(raw.message ?? p.message ?? p.body),
    notificationType: str(raw.notificationType ?? p.notificationType ?? p.type, 'Manual'),
    audience: str(raw.audience ?? p.audience),
    status: str(raw.status, 'queued'),
    opened: bool(raw.isRead) || !!raw.readAt || !!raw.openedAt,
    createdAt: iso(raw.sentAt ?? raw.createdAt) ?? '',
    failureReason: str(raw.failureReason) || null,
  };
}

/**
 * GET /api/v1/admin/notifications?limit=100&sort=newest — the list validator has no channel
 * filter, so push records are selected client-side by `channel`.
 */
export async function listPushHistory(signal?: AbortSignal): Promise<PushRecord[]> {
  const res = await apiRequestEnvelope<Raw[]>('/v1/admin/notifications', { query: { limit: 100, sort: 'newest', channel: 'push' }, signal });
  return arr(res.data).map((r) => asRaw(r)).filter((r) => str(r.channel) === 'push').map(mapPush);
}
