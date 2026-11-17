import { useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { getLoginStats, getLoginStatsSignedIn, loginAdmin } from '../../../services/auth';
import { useAuthStore } from '../../../store/authStore';
import type { AdminLoginStats } from '../../../types/auth';

const STATS_CACHE_KEY = 'builtglory-admin-login-stats';

function readCachedStats(): AdminLoginStats | null {
  try {
    const raw = localStorage.getItem(STATS_CACHE_KEY);
    const v = raw ? (JSON.parse(raw) as Partial<AdminLoginStats>) : null;
    return v && typeof v.properties === 'number' && typeof v.users === 'number' && typeof v.deals === 'number' ? (v as AdminLoginStats) : null;
  } catch {
    return null;
  }
}

/**
 * Counts shown on the sign-in screen. The API only answers this for a signed-in admin, so a signed-out
 * request falls back to the last counts cached by `useCacheLoginStats` while an admin was signed in.
 */
export function useLoginStats() {
  return useQuery({
    queryKey: ['login-stats'],
    queryFn: async ({ signal }) => {
      try {
        return await getLoginStats(signal);
      } catch (err) {
        const cached = readCachedStats();
        if (cached) return cached;
        throw err;
      }
    },
    retry: false,
    staleTime: 5 * 60_000,
  });
}

/** Keeps the sign-in screen counts fresh while an admin is signed in. */
export function useCacheLoginStats(enabled: boolean) {
  const q = useQuery({ queryKey: ['login-stats', 'signed-in'], queryFn: ({ signal }) => getLoginStatsSignedIn(signal), enabled, retry: false, staleTime: 5 * 60_000 });
  useEffect(() => {
    if (!q.data) return;
    try {
      localStorage.setItem(STATS_CACHE_KEY, JSON.stringify({ properties: q.data.properties, users: q.data.users, deals: q.data.deals }));
    } catch {
      /* storage unavailable */
    }
  }, [q.data]);
}

export function useLogin() {
  const signIn = useAuthStore((s) => s.signIn);
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) => loginAdmin(email, password),
    onSuccess: (session) => signIn(session),
  });
}
