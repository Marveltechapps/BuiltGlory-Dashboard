import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useAuthStore } from '../store/authStore';
import type { Raw } from './raw';
import { socketOrigin } from './runtimeConfig';

type Ack = { ok?: boolean; ticket?: Raw; error?: string };

let socket: Socket | null = null;
let socketToken: string | null = null;

/**
 * `/chat` Socket.IO namespace.
 * Default: same-origin (Vite proxies `/socket.io` in dev; reverse proxy in prod).
 * Split host: set `VITE_SOCKET_URL` or `VITE_API_URL` to an HTTPS API origin.
 */
export function chatSocket(): Socket | null {
  const token = useAuthStore.getState().session?.accessToken ?? null;
  if (!token) {
    socket?.disconnect();
    socket = null;
    socketToken = null;
    return null;
  }
  if (socket && socketToken === token) return socket;
  socket?.disconnect();
  socketToken = token;
  const origin = socketOrigin();
  socket = io(origin ? `${origin}/chat` : '/chat', {
    auth: { token },
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    autoConnect: true,
    withCredentials: true,
  });
  return socket;
}

function ticketOf(payload: { ticket?: Raw } | undefined): Raw | null {
  return payload?.ticket ?? null;
}

/** Live support inbox and the open ticket room. */
export function useSupportRealtime(ticketId: string | undefined, onTicket: (ticket: Raw) => void) {
  const cb = useRef(onTicket);
  cb.current = onTicket;
  const token = useAuthStore((s) => s.session?.accessToken);

  useEffect(() => {
    const live = chatSocket();
    if (!live) return undefined;
    const apply = (payload: { ticket?: Raw }) => {
      const ticket = ticketOf(payload);
      if (ticket) cb.current(ticket);
    };
    live.on('support:inbox', apply);
    live.on('support:ticket_updated', apply);
    live.on('support:message:new', apply);
    if (ticketId) live.emit('support:join', { ticketId });
    return () => {
      live.off('support:inbox', apply);
      live.off('support:ticket_updated', apply);
      live.off('support:message:new', apply);
      if (ticketId) live.emit('support:leave', { ticketId });
    };
  }, [ticketId, token]);
}

/** Send a live-chat reply. Rejects when the socket is down so the caller can use REST. */
export function sendSupportMessage(ticketId: string, message: string): Promise<Raw> {
  const live = chatSocket();
  if (!live) return Promise.reject(new Error('Live chat is not connected.'));
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error('Live chat timed out.')), 8000);
    live.emit('support:send', { ticketId, message, clientMessageId: crypto.randomUUID() }, (ack: Ack) => {
      window.clearTimeout(timer);
      if (!ack?.ok || !ack.ticket) reject(new Error(ack?.error || 'Message not sent.'));
      else resolve(ack.ticket);
    });
  });
}
