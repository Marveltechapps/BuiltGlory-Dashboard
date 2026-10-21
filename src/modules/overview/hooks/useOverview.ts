import { useQuery } from '@tanstack/react-query';
import { getOverview } from '../../../services/overview';

/** Shares the ['overview'] cache with the sidebar nav badges. */
export function useOverview() {
  return useQuery({ queryKey: ['overview'], queryFn: ({ signal }) => getOverview(signal), retry: false, refetchInterval: 60_000 });
}
