import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import type { ListResult } from '../lib/paging';
import { asRaw, type Raw } from '../lib/raw';
import { useSupportRealtime } from '../lib/realtime';
import { mapTicket, type SupportTicket } from '../services/support';

function mergeTicket(prev: SupportTicket | undefined, next: SupportTicket): SupportTicket {
  if (!prev) return next;
  return {
    ...next,
    userName: next.userName === 'Unknown customer' ? prev.userName : next.userName,
    phone: next.phone || prev.phone,
    email: next.email || prev.email,
    assignedToName: next.assignedToName || prev.assignedToName,
  };
}

/** Applies support socket events onto the open ticket and the ticket list. */
export function useLiveSupport(ticketId?: string) {
  const qc = useQueryClient();
  const onTicket = useCallback((raw: Raw) => {
    const next = mapTicket(asRaw(raw));
    if (!next.id) return;
    qc.setQueryData<SupportTicket>(['support-ticket', next.id], (prev) => mergeTicket(prev, next));
    qc.setQueryData<ListResult<SupportTicket>>(['support-tickets'], (prev) => {
      if (!prev) return prev;
      const idx = prev.items.findIndex((item) => item.id === next.id);
      const merged = mergeTicket(idx >= 0 ? prev.items[idx] : undefined, next);
      const items = idx === -1 ? [merged, ...prev.items] : prev.items.map((item) => (item.id === next.id ? merged : item));
      return { ...prev, items, total: idx === -1 ? prev.total + 1 : prev.total };
    });
  }, [qc]);
  useSupportRealtime(ticketId, onTicket);
}
