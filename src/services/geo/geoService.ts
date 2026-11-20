import { apiRequest } from '../../lib/apiClient';

export interface MapPoint {
  latitude: number;
  longitude: number;
  city?: string;
  state?: string;
  locality?: string;
  label?: string;
}

/** GET /api/v1/geo/forward?q= — address text to a map coordinate. */
export async function forwardGeocode(query: string): Promise<MapPoint | null> {
  const q = query.trim();
  if (q.length < 3) return null;
  const place = await apiRequest<MapPoint>('/v1/geo/forward', { query: { q } });
  if (typeof place?.latitude !== 'number' || typeof place?.longitude !== 'number') return null;
  return place;
}
