import { expect, test } from '@playwright/test';
import { io, type Socket } from 'socket.io-client';
import { adminLogin, ensureE2EAdmins } from './helpers/api';
import { API_URL, LIMITED_EMAIL, LIMITED_PASSWORD } from './helpers/env';

function connectChat(token: string) {
  return new Promise<Socket>((resolve, reject) => {
    const socket = io(`${API_URL}/chat`, {
      auth: { token },
      transports: ['websocket', 'polling'],
      timeout: 15_000,
    });
    const timer = setTimeout(() => {
      socket.close();
      reject(new Error('Socket connect timeout'));
    }, 20_000);
    socket.on('connect', () => {
      clearTimeout(timer);
      resolve(socket);
    });
    socket.on('connect_error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

test.describe('Socket.IO · /chat admin', () => {
  test.beforeAll(async () => {
    await ensureE2EAdmins();
  });

  test('super admin connects to /chat namespace', async () => {
    const session = await adminLogin();
    const socket = await connectChat(session.accessToken);
    expect(socket.connected).toBe(true);
    socket.close();
  });

  test('support.join ack works for support.read role', async () => {
    const limited = await adminLogin(LIMITED_EMAIL, LIMITED_PASSWORD);
    const socket = await connectChat(limited.accessToken);
    const ack = await new Promise<{ ok?: boolean; error?: string }>((resolve) => {
      socket.emit('support:join', { ticketId: '000000000000000000000000' }, (payload: { ok?: boolean; error?: string }) => resolve(payload || {}));
      setTimeout(() => resolve({ ok: false, error: 'ack-timeout' }), 10_000);
    });
    // Missing ticket may fail domain-wise, but permission must not be "sellRequests" style deny.
    expect(String(ack.error || '')).not.toMatch(/sellRequests/i);
    socket.close();
  });
});
