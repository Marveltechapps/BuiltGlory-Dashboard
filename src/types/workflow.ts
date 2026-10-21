export type EntityType =
  | 'buy_enquiry' | 'sell_request' | 'acquisition' | 'sales_deal' | 'visit' | 'callback'
  | 'interior_lead' | 'support_ticket' | 'user' | 'property';

export type LogChannel = 'call' | 'note' | 'message' | 'push' | 'email' | 'whatsapp' | 'proof_upload';

export interface LogAttachment {
  fileName: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
}

/** Communication / workflow log entry (`/admin/workflow/:entityType/:entityId/logs`, `/admin/communication-logs`). */
export interface WorkflowLog {
  id: string;
  entityType: EntityType;
  entityId: string;
  channel: LogChannel;
  direction: 'inbound' | 'outbound' | 'internal';
  summary: string;
  body: string;
  outcome: string;
  durationMinutes: number | null;
  occurredAt: string;
  actorName: string;
  attachments: LogAttachment[];
}

export interface CreateLogBody {
  channel: LogChannel;
  direction?: 'inbound' | 'outbound' | 'internal';
  summary: string;
  body?: string | null;
  outcome?: string | null;
  durationMinutes?: number;
  followUpAt?: string | null;
  occurredAt?: string;
}

export interface EditLock {
  id: string;
  adminId: string;
  adminName: string;
  lockedAt: string;
  expiresAt: string;
  isMine: boolean;
}
