import { create } from 'zustand';
import type { AdminSession, AdminUser } from '../types/auth';

const STORAGE_KEY = 'builtglory-admin-auth';

export interface StoredSession extends AdminSession {
  loggedInAt: string;
  accessTokenExpiresAt: number;
}

function read(): StoredSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredSession>;
    if (!parsed.accessToken || !parsed.refreshToken || !parsed.admin?.email) return null;
    return parsed as StoredSession;
  } catch {
    return null;
  }
}

function write(session: StoredSession | null) {
  try {
    if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage unavailable */
  }
}

interface AuthState {
  session: StoredSession | null;
  /** Set when a 401 could not be refreshed; the login screen shows the timeout notice. */
  expired: boolean;
  signIn: (session: AdminSession) => void;
  updateTokens: (t: { accessToken: string; refreshToken: string; expiresInSeconds: number }) => void;
  signOut: () => void;
  expire: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: read(),
  expired: false,
  signIn: (s) => {
    const { passwordHash: _omit, ...admin } = s.admin as AdminUser & { passwordHash?: string };
    void _omit;
    const stored: StoredSession = { ...s, admin, loggedInAt: new Date().toISOString(), accessTokenExpiresAt: Date.now() + s.expiresInSeconds * 1000 };
    write(stored);
    set({ session: stored, expired: false });
  },
  updateTokens: (t) => {
    const cur = get().session;
    if (!cur) return;
    const next: StoredSession = { ...cur, ...t, accessTokenExpiresAt: Date.now() + t.expiresInSeconds * 1000 };
    write(next);
    set({ session: next });
  },
  signOut: () => {
    write(null);
    set({ session: null, expired: false });
  },
  expire: () => {
    write(null);
    set({ session: null, expired: true });
  },
}));
