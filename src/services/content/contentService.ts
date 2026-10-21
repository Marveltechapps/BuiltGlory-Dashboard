import { apiRequest } from '../../lib/apiClient';
import { fetchAllPages } from '../../lib/paging';
import { asRaw, idOf, iso, num, str, strArr, type Raw } from '../../lib/raw';
import type { ContentItem, ContentPayload, ContentSection } from '../../types/content';

export function mapContent(raw: Raw): ContentItem {
  const cta = asRaw(raw.cta);
  let metadata = asRaw(raw.metadata);
  // Config records written by the previous dashboard also mirror metadata as JSON in `body`.
  if (!Object.keys(metadata).length && typeof raw.body === 'string' && raw.body.trim().startsWith('{')) {
    try {
      metadata = asRaw(JSON.parse(raw.body));
    } catch {
      /* plain body */
    }
  }
  return {
    id: idOf(raw),
    referenceId: str(raw.referenceId, idOf(raw)),
    slug: str(raw.slug),
    section: str(raw.section, 'general'),
    title: str(raw.title),
    excerpt: str(raw.excerpt),
    body: str(raw.body),
    category: str(raw.category),
    status: str(raw.status, 'draft'),
    imageUrl: str(raw.imageUrl) || null,
    ctaLabel: str(cta.label),
    ctaTarget: str(cta.target),
    tags: strArr(raw.tags),
    order: num(raw.order) ?? 0,
    metadata,
    publishedAt: iso(raw.publishedAt),
    createdAt: iso(raw.createdAt) ?? '',
    updatedAt: iso(raw.updatedAt ?? raw.createdAt) ?? '',
  };
}

/** GET /api/v1/admin/content (all pages; optional section filter) */
export const listContent = (section?: ContentSection, signal?: AbortSignal) =>
  fetchAllPages('/v1/admin/content', mapContent, { sort: 'newest', ...(section ? { section } : {}) }, signal, 5);

/** POST /api/v1/admin/content */
export async function createContent(body: ContentPayload & { section: ContentSection; title: string }) {
  return mapContent(asRaw(await apiRequest<Raw>('/v1/admin/content', { method: 'POST', body })));
}

/** PATCH /api/v1/admin/content/:contentId */
export async function updateContent(id: string, body: ContentPayload) {
  return mapContent(asRaw(await apiRequest<Raw>(`/v1/admin/content/${id}`, { method: 'PATCH', body })));
}

/** DELETE /api/v1/admin/content/:contentId */
export const deleteContent = (id: string) => apiRequest<unknown>(`/v1/admin/content/${id}`, { method: 'DELETE' });

/** PATCH /api/v1/admin/content/reorder — { items: [{ id, order }] } */
export const reorderContent = (items: Array<{ id: string; order: number }>) => apiRequest<unknown>('/v1/admin/content/reorder', { method: 'PATCH', body: { items } });

/**
 * Creates or updates the published CMS record identified by `slug` whose `metadata` holds a
 * Tools configuration (home layout, banners, onboarding slides, locations, pricing, …).
 */
export async function upsertConfig(
  existing: ContentItem | undefined,
  rec: { slug: string; section: ContentSection; title: string; excerpt: string; category: string; metadata: Record<string, unknown> },
) {
  const body: ContentPayload = { ...rec, body: JSON.stringify(rec.metadata), status: 'published' };
  return existing ? updateContent(existing.id, body) : createContent({ ...body, section: rec.section, title: rec.title });
}
