export type ContentSection = 'home' | 'onboarding' | 'faq' | 'legal' | 'about' | 'news' | 'general' | 'banner';
export type ContentStatus = 'draft' | 'published' | 'archived';

/** `GET /api/v1/admin/content` item (normalised) */
export interface ContentItem {
  id: string;
  referenceId: string;
  slug: string;
  section: ContentSection | string;
  title: string;
  excerpt: string;
  body: string;
  category: string;
  status: ContentStatus | string;
  imageUrl: string | null;
  ctaLabel: string;
  ctaTarget: string;
  tags: string[];
  order: number;
  metadata: Record<string, unknown>;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** POST / PATCH /api/v1/admin/content body (createValidator / updateValidator fields). */
export interface ContentPayload {
  slug?: string;
  section?: ContentSection;
  title?: string;
  excerpt?: string | null;
  body?: string | null;
  category?: string | null;
  status?: ContentStatus;
  imageUrl?: string | null;
  cta?: { label?: string | null; target?: string | null } | null;
  tags?: string[];
  order?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Slugs of the CMS records the Tools pages keep their configuration in
 * (same records the previous dashboard used, so existing data is preserved).
 */
export const CONTENT_SLUGS = {
  homeLayout: 'home-screen-layout-config',
  homeBanners: 'home-screen-banners-config',
  curation: 'featured-upcoming-property-order',
  onboarding: 'onboarding-slides-config',
  typeVisibility: 'property-type-visibility-config',
  forceUpdate: 'app-force-update-config',
  toolsConfig: 'tools-operational-config',
  terms: 'terms-of-service',
  privacy: 'privacy-policy',
  about: 'about-builtglory',
} as const;
