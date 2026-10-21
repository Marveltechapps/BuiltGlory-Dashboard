import { useQuery } from '@tanstack/react-query';
import { btn } from '../../../components/detail/sections';
import { useFormModal } from '../../../components/ui/FormModal';
import { RecordDetailView } from '../../../components/ui/RecordDetailView';
import { useRefreshingMutation } from '../../../hooks/useRefreshingMutation';
import { relativeLong, statusBadge, statusLabel } from '../../../lib/format';
import { createContent, deleteContent, listContent, updateContent } from '../../../services/content';
import { askConfirm, toast } from '../../../store/uiStore';
import type { ContentItem, ContentStatus } from '../../../types/content';

const CATS: Array<[string, string]> = [['terms', 'Terms'], ['privacy', 'Privacy'], ['legal', 'Legal']];
const catLabel = (c: string) => CATS.find(([k]) => k === c.toLowerCase())?.[1] || statusLabel(c) || 'Legal';

/** Admin › Legal Content — CMS records with section "legal" (GET/POST/PATCH/DELETE /admin/content). */
export function LegalContentTab() {
  const modal = useFormModal();
  const q = useQuery({ queryKey: ['content', 'legal'], queryFn: ({ signal }) => listContent('legal', signal) });
  const mut = useRefreshingMutation((fn: () => Promise<unknown>) => fn(), [['content']]);
  const items = q.data?.items ?? [];

  const editor = (doc: ContentItem | null, preset?: { title: string; slug: string; cat: string }) =>
    modal.open({
      title: doc ? 'Edit ' + doc.title : 'New legal page',
      wide: true,
      formCols: 2,
      fields: [
        { key: 'title', label: 'Title', required: true, default: doc?.title ?? preset?.title, placeholder: 'Terms of Use' },
        { key: 'slug', label: 'Slug', required: true, default: doc?.slug ?? preset?.slug, placeholder: 'terms-of-service' },
        { key: 'cat', label: 'Category', type: 'select', options: CATS.map(([value, label]) => ({ value, label })), default: doc ? doc.category.toLowerCase() || 'legal' : preset?.cat || 'legal' },
        { key: 'status', label: 'Status', type: 'select', options: ['draft', 'published', 'archived'], default: doc?.status || 'draft' },
        { key: 'sum', label: 'Summary', placeholder: 'Short description shown in dashboards', default: doc?.excerpt ?? '' },
        { key: 'content', label: 'Content', type: 'textarea', placeholder: 'Write the legal copy users will see...', default: doc?.body ?? '', required: true, full: true },
      ],
      validate: (v) => {
        const slug = String(v.slug || '').trim();
        return {
          slug: /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ? (items.some((x) => x.slug === slug && (!doc || x.id !== doc.id)) ? 'Slug already in use' : '') : 'Lowercase letters, numbers and dashes only',
        };
      },
      submit: 'Save',
      onSubmit: async (v) => {
        const payload = {
          slug: String(v.slug).trim(),
          section: 'legal' as const,
          title: String(v.title).trim(),
          category: String(v.cat),
          status: String(v.status) as ContentStatus,
          excerpt: String(v.sum || '') || null,
          body: String(v.content),
          metadata: { ...(doc?.metadata ?? {}), lastUpdatedLabel: new Date().toLocaleDateString('en-IN') },
        };
        await mut.mutateAsync(() => (doc ? updateContent(doc.id, payload) : createContent(payload)));
        toast('✅ Saved');
      },
    });

  return (
    <RecordDetailView
      state={q.isPending ? 'loading' : q.isError ? 'error' : 'ok'}
      isPage
      onRetry={() => void q.refetch()}
      errorTitle="Could not load legal content"
      title="Terms & Privacy Content"
      meta="Create and manage legal copy shown in the app for Terms of Use, Privacy Policy, and related screens."
      single
      hActions={[
        btn('New Terms', () => editor(null, { title: 'Terms of Use', slug: items.some((x) => x.slug === 'terms-of-service') ? 'terms-of-service-v2' : 'terms-of-service', cat: 'terms' })),
        btn('New Privacy Policy', () => editor(null, { title: 'Privacy Policy', slug: items.some((x) => x.slug === 'privacy-policy') ? 'privacy-policy-v2' : 'privacy-policy', cat: 'privacy' })),
        btn('Add Legal Page', () => editor(null), 'primary'),
      ]}
      main={[
        {
          title: 'Legal pages',
          rows: items.map((d) => ({
            key: d.id,
            title: d.title,
            sub: '/' + d.slug + ' · ' + catLabel(d.category) + ' · Updated ' + relativeLong(d.updatedAt),
            badges: [statusBadge(d.status)],
            actions: [
              { label: 'Edit', onClick: () => editor(d) },
              { label: 'Delete', variant: 'red' as const, onClick: () => askConfirm({ title: 'Delete ' + d.title + '?', confirmLabel: 'Delete', tone: 'destructive', onConfirm: () => mut.mutateAsync(() => deleteContent(d.id)).then(() => toast('Legal content deleted')) }) },
            ],
          })),
          empty: items.length ? '' : 'No legal content has been created yet — Start with Terms of Use or Privacy Policy.',
        },
      ]}
    >
      {modal.element}
    </RecordDetailView>
  );
}
