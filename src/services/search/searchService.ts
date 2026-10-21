import { apiRequest } from '../../lib/apiClient';
import type { SearchResult } from '../../types/overview';

const EMOJI: Record<SearchResult['type'], string> = { property: '🏠', user: '👤', enquiry: '💬', acquisition: '🏗️', deal: '🤝' };

/** GET /api/v1/admin/search?q=&limit= (q: min 2, max 100; limit ≤ 20) */
export async function searchDashboard(q: string, signal?: AbortSignal): Promise<SearchResult[]> {
  const results = await apiRequest<SearchResult[]>('/v1/admin/search', { query: { q, limit: 12 }, signal });
  return (results ?? []).map((r) => ({ ...r, emoji: EMOJI[r.type] ?? r.emoji }));
}
