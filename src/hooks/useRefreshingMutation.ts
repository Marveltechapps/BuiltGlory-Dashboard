import { useMutation, useQueryClient } from '@tanstack/react-query';
import { formatApiError } from '../lib/apiClient';
import { toast } from '../store/uiStore';

/**
 * Mutation that invalidates the given query keys (and the overview / nav badges) after success
 * and toasts the API error message on failure.
 */
export function useRefreshingMutation<TVars, TData = unknown>(fn: (v: TVars) => Promise<TData>, keys: string[][]) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      keys.forEach((k) => void qc.invalidateQueries({ queryKey: k }));
      void qc.invalidateQueries({ queryKey: ['overview'] });
    },
    onError: (e) => toast('⚠️ ' + formatApiError(e)),
  });
}
