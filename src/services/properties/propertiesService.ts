import { apiRequest, apiRequestEnvelope } from '../../lib/apiClient';
import { fetchAllPages } from '../../lib/paging';
import { arr, asRaw, bool, idOf, iso, num, str, strArr, type Raw } from '../../lib/raw';
import type { ImportJob, Property, PropertyPayload, TemplateResult } from '../../types/properties';

export function mapProperty(raw: Raw): Property {
  const a = asRaw(raw.address);
  const media = asRaw(raw.media);
  const m = asRaw(raw.metrics);
  const specs = asRaw(raw.specs);
  return {
    id: idOf(raw),
    referenceId: str(raw.referenceId, idOf(raw)),
    title: str(raw.title, 'Untitled property'),
    description: str(raw.description),
    type: str(raw.type, 'plot'),
    status: str(raw.status, 'draft'),
    source: str(raw.source, 'manual'),
    isFeatured: bool(raw.isFeatured),
    isUpcoming: bool(raw.isUpcoming),
    isVisibleOnApp: raw.isVisibleOnApp === undefined ? str(raw.status) === 'available' : bool(raw.isVisibleOnApp),
    addressLine: [a.line1, a.line2, a.landmark].map((v) => str(v)).filter(Boolean).join(', '),
    line1: str(a.line1),
    line2: str(a.line2),
    landmark: str(a.landmark),
    locality: str(a.locality),
    city: str(a.city),
    state: str(a.state),
    pincode: str(a.pincode),
    latitude: num(a.latitude),
    longitude: num(a.longitude),
    price: num(raw.price) ?? 0,
    isNegotiable: bool(raw.isNegotiable),
    specs,
    amenities: strArr(raw.amenities),
    photos: strArr(media.photos),
    coverPhoto: str(media.coverPhoto) || null,
    videoUrl: str(media.videoUrl) || null,
    tour3dUrl: str(media.tour3dUrl) || null,
    floorPlanUrl: str(media.floorPlanUrl) || null,
    droneImageUrl: str(media.droneImageUrl) || null,
    droneVideoUrl: str(media.droneVideoUrl) || null,
    media,
    highlights: strArr(raw.highlights),
    advantages: raw.advantages && typeof raw.advantages === 'object'
      ? { investment: strArr(asRaw(raw.advantages).investment), location: strArr(asRaw(raw.advantages).location), connectivity: strArr(asRaw(raw.advantages).connectivity) }
      : null,
    nearbyPlaces: arr(raw.nearbyPlaces).map((n) => {
      const x = asRaw(n);
      return { name: str(x.name), type: str(x.type ?? x.category), distance: str(x.distance) };
    }),
    savedByUsers: arr(raw.savedByUsers).map((u) => idOf(u)).filter(Boolean),
    sourceSheet: str(raw.sourceSheet) || null,
    views: num(m.views) ?? 0,
    enquiries: num(m.enquiries) ?? 0,
    visits: num(m.visits) ?? 0,
    saves: num(m.savedCount) ?? 0,
    compareCount: num(m.compareCount) ?? 0,
    assignedTo: raw.assignedTo ? idOf(raw.assignedTo) : null,
    acquisitionId: raw.acquisitionId ? idOf(raw.acquisitionId) : null,
    isDeleted: bool(raw.isDeleted),
    deletedAt: iso(raw.deletedAt),
    launchDate: iso(raw.launchDate),
    possessionDate: iso(raw.possessionDate) ?? (str(specs.possession) || null),
    soldAt: iso(raw.soldAt),
    createdAt: iso(raw.createdAt ?? raw.addedAt) ?? new Date().toISOString(),
    updatedAt: iso(raw.updatedAt) ?? new Date().toISOString(),
  };
}

function mapImportJob(raw: Raw): ImportJob {
  return {
    id: idOf(raw),
    referenceId: str(raw.referenceId, idOf(raw)),
    fileName: str(raw.fileName, 'upload'),
    status: str(raw.status, 'validated'),
    rowsTotal: num(raw.rowsTotal) ?? 0,
    rowsAccepted: num(raw.rowsAccepted) ?? 0,
    rowsRejected: num(raw.rowsRejected) ?? 0,
    errors: arr(raw.errors).map((e) => {
      const x = asRaw(e);
      return { row: num(x.row) ?? 0, field: str(x.field), message: str(x.message) };
    }),
    importedProperties: arr(raw.importedProperties).map((p) => {
      const x = asRaw(p);
      return { id: idOf(x), referenceId: str(x.referenceId, idOf(x)), title: str(x.title, 'Imported property'), status: str(x.status, 'available'), isDeleted: bool(x.isDeleted) };
    }),
    createdAt: iso(raw.createdAt) ?? '',
    completedAt: iso(raw.completedAt),
    revertedAt: iso(raw.revertedAt),
  };
}

/** GET /api/v1/admin/properties (all pages; includeDeleted for the Deleted tab) */
export const listProperties = (signal?: AbortSignal, query: Record<string, string | boolean | undefined> = {}) =>
  fetchAllPages('/v1/admin/properties', mapProperty, { sort: 'newest', includeDeleted: true, ...query }, signal);

/** GET /api/v1/admin/properties — single filtered page (e.g. similar properties in a locality). */
export async function findProperties(query: Record<string, string | number | boolean | undefined>, signal?: AbortSignal) {
  const res = await apiRequestEnvelope<Raw[]>('/v1/admin/properties', { query: { limit: 6, ...query }, signal });
  return arr(res.data).map((r) => mapProperty(asRaw(r)));
}

/** GET /api/v1/admin/properties/:propertyId */
export async function getProperty(id: string, signal?: AbortSignal) {
  return mapProperty(asRaw(await apiRequest<Raw>(`/v1/admin/properties/${id}`, { signal })));
}

/** POST /api/v1/admin/properties */
export async function createProperty(body: PropertyPayload & { title: string; type: string; price: number }) {
  return mapProperty(asRaw(await apiRequest<Raw>('/v1/admin/properties', { method: 'POST', body })));
}

/** PATCH /api/v1/admin/properties/:propertyId */
export async function updateProperty(id: string, body: PropertyPayload) {
  return mapProperty(asRaw(await apiRequest<Raw>(`/v1/admin/properties/${id}`, { method: 'PATCH', body })));
}

/** DELETE /api/v1/admin/properties/:propertyId (soft delete) */
export const deleteProperty = (id: string) => apiRequest<Raw>(`/v1/admin/properties/${id}`, { method: 'DELETE' });
/** PATCH /api/v1/admin/properties/:propertyId/restore */
export const restoreProperty = (id: string) => apiRequest<Raw>(`/v1/admin/properties/${id}/restore`, { method: 'PATCH' });
/** DELETE /api/v1/admin/properties/:propertyId/permanent */
export const deletePropertyPermanently = (id: string) => apiRequest<Raw>(`/v1/admin/properties/${id}/permanent`, { method: 'DELETE' });

/** PATCH /api/v1/admin/properties/:propertyId/status — { status, reason?, notes?, override? } */
export async function updatePropertyStatus(id: string, body: { status: 'available' | 'sold' | 'reserved' | 'under_construction' | 'draft'; reason?: string; notes?: string; override?: boolean }) {
  return mapProperty(asRaw(await apiRequest<Raw>(`/v1/admin/properties/${id}/status`, { method: 'PATCH', body })));
}

/** POST /api/v1/admin/properties/:propertyId/media (multipart `files`, up to 20) */
export async function uploadPropertyMedia(id: string, files: File[], documentType = 'photo') {
  const fd = new FormData();
  files.forEach((f) => fd.append('files', f));
  fd.append('documentType', documentType);
  const data = asRaw(await apiRequest<Raw>(`/v1/admin/properties/${id}/media`, { method: 'POST', formData: fd }));
  return mapProperty(asRaw(data.property ?? data));
}

/** POST /api/v1/admin/properties/bulk-upload (multipart `file`) */
export async function bulkUploadProperties(file: File) {
  const fd = new FormData();
  fd.append('file', file);
  const r = asRaw(await apiRequest<Raw>('/v1/admin/properties/bulk-upload', { method: 'POST', formData: fd }));
  return {
    valid: bool(r.valid),
    rowsAccepted: num(r.rowsAccepted) ?? 0,
    rowsRejected: num(r.rowsRejected) ?? 0,
    errors: arr(r.errors).map((e) => {
      const x = asRaw(e);
      return { row: num(x.row) ?? 0, field: str(x.field), message: str(x.message) };
    }),
    job: r.job ? mapImportJob(asRaw(r.job)) : null,
  };
}

/** GET /api/v1/admin/properties/bulk-template?mode=empty|valued */
export async function getBulkTemplate(mode: 'empty' | 'valued', limit = 100): Promise<TemplateResult> {
  const r = await apiRequestEnvelope<Raw>('/v1/admin/properties/bulk-template', { query: { mode, limit } });
  const d = asRaw(r.data);
  return {
    mode: (str(d.mode, mode) as TemplateResult['mode']),
    fields: arr(d.fields).map((f) => {
      const x = asRaw(f);
      return { key: str(x.key), label: str(x.label, str(x.key)), required: bool(x.required), editable: x.editable !== false, type: str(x.type, 'text') };
    }),
    rows: arr(d.rows).map((row) => asRaw(row) as Record<string, string | number | boolean>),
  };
}

/** GET /api/v1/admin/properties/import-jobs (all pages; backend max 50/page) */
export async function listImportJobs(signal?: AbortSignal): Promise<ImportJob[]> {
  const result = await fetchAllPages('/v1/admin/properties/import-jobs', mapImportJob, { sort: 'newest' }, signal, 20);
  return result.items;
}

/** POST /api/v1/admin/import-jobs/:id/undo */
export async function undoImportJob(id: string) {
  const r = asRaw(await apiRequest<Raw>(`/v1/admin/import-jobs/${id}/undo`, { method: 'POST' }));
  return { job: r.job ? mapImportJob(asRaw(r.job)) : null, revertedCount: num(r.revertedCount) ?? 0 };
}
