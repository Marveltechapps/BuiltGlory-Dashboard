import { useQuery } from '@tanstack/react-query';
import { useRefreshingMutation } from '../../../hooks/useRefreshingMutation';
import { arr, asRaw } from '../../../lib/raw';
import { listContent, upsertConfig } from '../../../services/content';
import { getSettings, updateSettings } from '../../../services/settings';
import type { ContentSection } from '../../../types/content';
import type { AdminSettingsPatch } from '../../../types/settings';

export interface ConfigRecord {
  slug: string;
  section: ContentSection;
  title: string;
  excerpt: string;
  category: string;
}

/** All CMS content (GET /admin/content) plus helpers for the slug-keyed Tools configuration records. */
export function useToolsContent() {
  const q = useQuery({ queryKey: ['content', 'all'], queryFn: ({ signal }) => listContent(undefined, signal) });
  const items = q.data?.items ?? [];
  const bySlug = (slug: string) => items.find((i) => i.slug === slug);
  const meta = (slug: string) => bySlug(slug)?.metadata ?? {};
  /** Array stored under metadata[key] of the record with `slug` (null when the record does not exist yet). */
  function list<T>(slug: string, key: string): T[] | null {
    const rec = bySlug(slug);
    if (!rec) return null;
    return arr(rec.metadata[key]).map((x) => asRaw(x) as unknown as T);
  }
  const save = useRefreshingMutation(
    (v: { rec: ConfigRecord; metadata: Record<string, unknown> }) => upsertConfig(bySlug(v.rec.slug), { ...v.rec, metadata: v.metadata }),
    [['content']],
  );
  return { q, items, bySlug, meta, list, save, ofSection: (s: string) => items.filter((i) => i.section === s) };
}

/** Admin settings (GET/PATCH /admin/settings). */
export function useAdminSettings(enabled = true) {
  const q = useQuery({ queryKey: ['admin-settings'], queryFn: ({ signal }) => getSettings(signal), enabled, retry: false });
  const save = useRefreshingMutation((body: AdminSettingsPatch) => updateSettings(body), [['admin-settings']]);
  return { q, settings: q.data, save };
}

export const CONFIG_RECORDS: Record<string, ConfigRecord> = {
  homeLayout: { slug: 'home-screen-layout-config', section: 'home', title: 'Home Screen Layout', excerpt: 'App home screen section order and visibility', category: 'home-layout' },
  homeBanners: { slug: 'home-screen-banners-config', section: 'banner', title: 'Home Screen Banners', excerpt: 'App home carousel banner configuration', category: 'home-banners' },
  curation: { slug: 'featured-upcoming-property-order', section: 'home', title: 'Featured and Upcoming Property Order', excerpt: 'Curated property ordering for home screen sections', category: 'property-curation' },
  onboarding: { slug: 'onboarding-slides-config', section: 'onboarding', title: 'Onboarding Slides', excerpt: 'Customer app onboarding slide sequence', category: 'onboarding' },
  typeVisibility: { slug: 'property-type-visibility-config', section: 'general', title: 'Property Type Visibility', excerpt: 'Property types shown on the Buy and Sell screens', category: 'property-types' },
  forceUpdate: { slug: 'app-force-update-config', section: 'general', title: 'App Force Update Settings', excerpt: 'Minimum supported app version and force-update toggle', category: 'app-config' },
  toolsConfig: { slug: 'tools-operational-config', section: 'general', title: 'Tools Operational Configuration', excerpt: 'Admin-managed locations, map zones and boost orders for Tools', category: 'tools-config' },
};
