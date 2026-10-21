import { useMutation, useQuery } from '@tanstack/react-query';
import { getLoginStats, loginAdmin } from '../../../services/auth';
import { useAuthStore } from '../../../store/authStore';

export function useLoginStats() {
  return useQuery({ queryKey: ['login-stats'], queryFn: ({ signal }) => getLoginStats(signal), retry: false, staleTime: 5 * 60_000 });
}

export function useLogin() {
  const signIn = useAuthStore((s) => s.signIn);
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) => loginAdmin(email, password),
    onSuccess: (session) => signIn(session),
  });
}
