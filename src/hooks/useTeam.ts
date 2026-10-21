import { useQuery } from '@tanstack/react-query';
import { listDesigners, listSalesTeam } from '../services/team';
import type { TeamMember } from '../types/team';

/** Sales team (GET /admin/sales-team) with an id → name resolver for assignment columns. */
export function useSalesTeam(enabled = true) {
  const q = useQuery({ queryKey: ['sales-team'], queryFn: ({ signal }) => listSalesTeam(signal), staleTime: 5 * 60_000, retry: false, enabled });
  const team: TeamMember[] = q.data ?? [];
  const nameOf = (id: string | null | undefined, fallback?: string | null) => (id ? team.find((m) => m.id === id)?.name ?? fallback ?? null : null);
  return { ...q, team, nameOf };
}

/** Interior designers (GET /admin/designers). */
export function useDesigners(enabled = true) {
  const q = useQuery({ queryKey: ['designers'], queryFn: ({ signal }) => listDesigners(signal), staleTime: 5 * 60_000, retry: false, enabled });
  const designers: TeamMember[] = q.data ?? [];
  const nameOf = (id: string | null | undefined, fallback?: string | null) => (id ? designers.find((m) => m.id === id)?.name ?? fallback ?? null : null);
  return { ...q, designers, nameOf };
}
