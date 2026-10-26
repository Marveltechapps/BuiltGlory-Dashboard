import { apiRequest } from '../../lib/apiClient';
import { fetchAllPages } from '../../lib/paging';
import { arr, asRaw, idOf, iso, num, str, strOrNull, type Raw } from '../../lib/raw';
import type { ChatMessage, ChatThread } from '../../types/enquiries';

function mapMessage(raw: Raw): ChatMessage {
  const type = str(raw.type, 'text');
  return {
    id: idOf(raw),
    sender: str(raw.sender ?? raw.senderType, 'buyer'),
    type: type === 'counter_offer' ? 'offer' : type,
    text: str(raw.text ?? raw.offerMessage),
    offerAmount: num(raw.offerAmount ?? raw.amount),
    offerStatus: strOrNull(raw.offerStatus ?? raw.status),
    at: iso(raw.createdAt) ?? new Date().toISOString(),
  };
}

export function mapChatThread(raw: Raw): ChatThread {
  const buyer = asRaw(raw.buyerSnapshot ?? raw.buyerId);
  const property = asRaw(raw.propertySnapshot ?? raw.propertyId);
  const neg = asRaw(raw.negotiation);
  const messages = arr(raw.messages).map((m) => mapMessage(asRaw(m)));
  const last = messages[messages.length - 1];
  return {
    id: idOf(raw),
    buyerId: idOf(raw.buyerId),
    buyerName: str(buyer.name, 'Buyer'),
    phone: str(buyer.phone),
    email: strOrNull(buyer.email),
    propertyId: idOf(raw.propertyId),
    propertyTitle: str(property.title, 'Property'),
    listedPrice: num(neg.listedPrice ?? property.price) ?? 0,
    status: str(raw.status, 'active'),
    agreedPrice: num(neg.agreedPrice),
    deadline: strOrNull(neg.deadline),
    dealId: raw.dealId ? idOf(raw.dealId) : raw.salesDealId ? idOf(raw.salesDealId) : null,
    lastMessageAt: iso(raw.lastMessageAt ?? last?.at ?? raw.updatedAt) ?? new Date().toISOString(),
    messages,
  };
}

/** GET /api/v1/admin/negotiations/chats (all pages) */
export const listChatThreads = (signal?: AbortSignal) => fetchAllPages('/v1/admin/negotiations/chats', mapChatThread, { sort: 'newest' }, signal);

/** GET /api/v1/admin/negotiations/chats/:threadId */
export async function getChatThread(id: string, signal?: AbortSignal) {
  return mapChatThread(asRaw(await apiRequest<Raw>(`/v1/admin/negotiations/chats/${id}`, { signal })));
}

/** POST /api/v1/admin/negotiations/chats/:threadId/messages — { text, type?, offerAmount? } (shape per the original admin client) */
export function sendChatMessage(id: string, body: { text: string; type?: 'text' | 'offer' | 'deal_agreed'; offerAmount?: number }) {
  return apiRequest<Raw>(`/v1/admin/negotiations/chats/${id}/messages`, { method: 'POST', body });
}
