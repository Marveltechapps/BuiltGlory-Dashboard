import { apiRequest } from '../../lib/apiClient';
import { fetchAllPages } from '../../lib/paging';
import { asRaw, bool, idOf, iso, num, str, type Raw } from '../../lib/raw';

export type LocationKind = 'city' | 'locality' | 'zone';

export interface LocationRecord {
  id: string;
  referenceId: string;
  kind: LocationKind;
  name: string;
  key: string;
  cityKey: string;
  state: string;
  parentId: string | null;
  active: boolean;
  order: number | null;
  propertyCount: number;
  center: { type: 'Point'; coordinates: [number, number] } | null;
  boundary: { type: 'Polygon'; coordinates: number[][][] } | null;
  createdAt: string;
  updatedAt: string;
}

export interface LocationPayload {
  kind: LocationKind;
  name: string;
  key: string;
  cityKey: string;
  state?: string;
  parentId?: string;
  center?: { type: 'Point'; coordinates: [number, number] };
  boundary?: { type: 'Polygon'; coordinates: number[][][] };
  active?: boolean;
  order?: number;
}

export function mapLocation(raw: Raw): LocationRecord {
  const center = asRaw(raw.center);
  const boundary = asRaw(raw.boundary);
  const centerCoords = Array.isArray(center.coordinates) ? (center.coordinates as number[]) : null;
  return {
    id: idOf(raw),
    referenceId: str(raw.referenceId, idOf(raw)),
    kind: str(raw.kind, 'city') as LocationKind,
    name: str(raw.name),
    key: str(raw.key),
    cityKey: str(raw.cityKey),
    state: str(raw.state),
    parentId: raw.parentId ? idOf(raw.parentId) : null,
    active: raw.active !== false,
    order: num(raw.order),
    propertyCount: num(raw.propertyCount) ?? 0,
    center: centerCoords && centerCoords.length === 2
      ? { type: 'Point', coordinates: [Number(centerCoords[0]), Number(centerCoords[1])] }
      : null,
    boundary: str(boundary.type) === 'Polygon' && Array.isArray(boundary.coordinates)
      ? { type: 'Polygon', coordinates: boundary.coordinates as number[][][] }
      : null,
    createdAt: iso(raw.createdAt) ?? '',
    updatedAt: iso(raw.updatedAt) ?? '',
  };
}

/** Lowercase slug for location keys (`chennai`, `anna-nagar`). */
export function slugifyLocationKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

/** GET /api/v1/admin/locations */
export function listLocations(query: { kind?: LocationKind; cityKey?: string; active?: boolean; search?: string } = {}, signal?: AbortSignal) {
  return fetchAllPages('/v1/admin/locations', mapLocation, { sort: 'newest', ...query }, signal);
}

/** POST /api/v1/admin/locations */
export async function createLocation(body: LocationPayload) {
  return mapLocation(asRaw(await apiRequest<Raw>('/v1/admin/locations', { method: 'POST', body })));
}

/** PATCH /api/v1/admin/locations/:locationId */
export async function updateLocation(id: string, body: Partial<Omit<LocationPayload, 'kind'>> & { active?: boolean }) {
  return mapLocation(asRaw(await apiRequest<Raw>(`/v1/admin/locations/${id}`, { method: 'PATCH', body })));
}

/** DELETE /api/v1/admin/locations/:locationId */
export const deleteLocation = (id: string) => apiRequest<unknown>(`/v1/admin/locations/${id}`, { method: 'DELETE' });

/** Parse "lat,lng" UI input into GeoJSON Point (lng, lat). */
export function parseLatLng(input: string): { type: 'Point'; coordinates: [number, number] } | null {
  const m = input.trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { type: 'Point', coordinates: [lng, lat] };
}

/** Build a tiny closed square polygon around a center point for zone boundary. */
export function squareBoundaryAround(center: { coordinates: [number, number] }, delta = 0.01): { type: 'Polygon'; coordinates: number[][][] } {
  const [lng, lat] = center.coordinates;
  const ring = [
    [lng - delta, lat - delta],
    [lng + delta, lat - delta],
    [lng + delta, lat + delta],
    [lng - delta, lat + delta],
    [lng - delta, lat - delta],
  ];
  return { type: 'Polygon', coordinates: [ring] };
}

export function formatCenter(loc: LocationRecord) {
  if (!loc.center) return '';
  const [lng, lat] = loc.center.coordinates;
  return `${lat},${lng}`;
}

export function isActiveLocation(loc: LocationRecord) {
  return bool(loc.active);
}
