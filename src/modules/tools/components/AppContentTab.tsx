import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { btn } from '../../../components/detail/sections';
import { useFormModal } from '../../../components/ui/FormModal';
import { RecordDetailView } from '../../../components/ui/RecordDetailView';
import { useFormFields } from '../../../hooks/useFormFields';
import { useRefreshingMutation } from '../../../hooks/useRefreshingMutation';
import { formatApiError } from '../../../lib/apiClient';
import { badge, date, price, todayIso } from '../../../lib/format';
import { createContent, deleteContent, reorderContent, updateContent } from '../../../services/content';
import { listProperties, updateProperty, updatePropertyStatus } from '../../../services/properties';
import { askConfirm, toast } from '../../../store/uiStore';
import type { ContentItem } from '../../../types/content';
import type { SectionSpec } from '../../../types/detail';
import { CONFIG_RECORDS, useToolsContent } from '../hooks/useToolsContent';
import { isHttps, move, uid } from './toolsShared';

interface HomeSection { id: string; label: string; description: string; isActive: boolean; canDisable: boolean; order: number }
interface Banner { id: string; title: string; subtitle: string; ctaText: string; bgColor: string; imageUrl: string; navigateTo: string; externalUrl: string; startDate: string; expiryDate: string; isActive: boolean; order: number }
interface Slide { id: string; order: number; title: string; description: string; imageUrl: string; isActive: boolean }
interface TypeVis { id: string; slug: string; typeName: string; displayName: string; showOnBuy: boolean; showOnSell: boolean; order: number }

const D = 864e5;
const SUB_TABS: Array<[string, string]> = [['home', '🏠 Home Screen'], ['onboarding', '👋 Onboarding'], ['faq', '❓ FAQ'], ['terms', '📜 Terms & Conditions'], ['privacy', '🔒 Privacy Policy'], ['about', 'ℹ️ About App'], ['push', '🔔 Push Notifications']];

/** App home screen structure used until a layout is saved (the sections the customer app renders). */
const DEFAULT_SECTIONS: HomeSection[] = [
  { id: 'search_bar', label: 'Search Bar', description: 'Property search at top', isActive: true, canDisable: false, order: 1 },
  { id: 'buy_sell_tiles', label: 'Buy & Sell Tiles', description: 'Quick access to buy/sell', isActive: true, canDisable: false, order: 2 },
  { id: 'promotional_banners', label: 'Promotional Banners', description: 'Home screen carousel banners', isActive: true, canDisable: true, order: 3 },
  { id: 'featured_properties', label: 'Featured Properties', description: 'Curated featured listings carousel', isActive: true, canDisable: true, order: 4 },
  { id: 'upcoming_properties', label: 'Upcoming Properties', description: 'Pre-launch and upcoming projects', isActive: true, canDisable: true, order: 5 },
  { id: 'property_type_grid', label: 'Property Type Grid', description: '13 property type cards on Buy screen', isActive: true, canDisable: true, order: 6 },
  { id: 'news_insights', label: 'News & Insights', description: 'Market news and investment articles', isActive: true, canDisable: true, order: 7 },
];
const DEFAULT_TYPES: TypeVis[] = [
  ['plot', 'Plot'], ['apartment', 'Apartment'], ['residential', 'Residential'], ['commercial', 'Commercial'], ['organic_home', 'Organic Home'], ['3d_printing', '3D Printing Home'],
  ['fractional', 'Fractional Ownership'], ['ceo_mansion', 'CEO Mansion'], ['holiday_home', 'Holiday Home'], ['land', 'Land & Landbank'], ['farmhouse', 'Farm House'], ['nri', 'NRI Services'], ['interior', 'Interior'],
].map(([slug, name], i) => ({ id: 'pt' + (i + 1), slug: slug!, typeName: name!, displayName: name!, showOnBuy: true, showOnSell: true, order: i + 1 }));
const NAV_OPTIONS = ['A property', 'Scroll to section on Home (H-01)', 'Open full Featured list', 'Open full Upcoming list', 'Buy type pre-filter', 'Sell Screen', 'External URL', 'No action'];
const bool = (v: unknown, d = false) => (typeof v === 'boolean' ? v : d);
const s = (v: unknown) => (v == null ? '' : String(v));

export function AppContentTab() {
  const navigate = useNavigate();
  const f = useFormFields();
  const modal = useFormModal();
  const tc = useToolsContent();
  const propsQ = useQuery({ queryKey: ['properties'], queryFn: ({ signal }) => listProperties(signal) });
  const propMut = useRefreshingMutation((v: { id: string; body: Parameters<typeof updateProperty>[1]; status?: 'available' }) =>
    updateProperty(v.id, v.body).then((r) => (v.status ? updatePropertyStatus(v.id, { status: v.status }) : r)), [['properties'], ['content']]);
  const contentMut = useRefreshingMutation((fn: () => Promise<unknown>) => fn(), [['content']]);
  const cur = f.str('sec', 'home');
  const today = todayIso();

  const state = tc.q.isPending ? 'loading' : tc.q.isError ? 'error' : 'ok';
  if (state !== 'ok') return <RecordDetailView state={state} isPage onRetry={() => void tc.q.refetch()} errorTitle="Could not load app content" />;

  const props = (propsQ.data?.items ?? []).filter((p) => !p.isDeleted);
  const save = (key: keyof typeof CONFIG_RECORDS, metadata: Record<string, unknown>, msg?: string) =>
    tc.save.mutateAsync({ rec: CONFIG_RECORDS[key]!, metadata }).then(() => { if (msg) toast(msg); }).catch(() => undefined);

  // ---- stored configuration (or structural defaults until first save)
  const storedSections = tc.list<HomeSection>(CONFIG_RECORDS.homeLayout!.slug, 'sections');
  const sections = (storedSections?.length ? storedSections : DEFAULT_SECTIONS).map((x, i) => ({ ...x, isActive: bool(x.isActive, true), canDisable: bool(x.canDisable, true), order: i + 1 }));
  const banners = (tc.list<Banner>(CONFIG_RECORDS.homeBanners!.slug, 'banners') ?? []).map((b) => ({ ...b, isActive: bool(b.isActive, true) })).sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
  const storedTypes = tc.list<TypeVis>(CONFIG_RECORDS.typeVisibility!.slug, 'propertyTypes');
  const types = (storedTypes?.length ? storedTypes : DEFAULT_TYPES).map((t) => ({ ...t, showOnBuy: bool(t.showOnBuy, true), showOnSell: bool(t.showOnSell, true) })).sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
  const slides = (tc.list<Slide>(CONFIG_RECORDS.onboarding!.slug, 'slides') ?? []).map((x) => ({ ...x, isActive: bool(x.isActive, true) })).sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
  const curation = tc.meta(CONFIG_RECORDS.curation!.slug);
  const featuredOrder = (Array.isArray(curation.featuredOrder) ? curation.featuredOrder : []).map(String);
  const featured = props.filter((p) => p.isFeatured).sort((a, b) => {
    const ia = featuredOrder.indexOf(a.id);
    const ib = featuredOrder.indexOf(b.id);
    return (ia < 0 ? 1e6 : ia) - (ib < 0 ? 1e6 : ib);
  });
  const upcoming = props.filter((p) => p.isUpcoming);
  const activeBanners = banners.filter((b) => b.isActive);
  const day = (v: string | null) => (v ? v.slice(0, 10) : '');

  const saveSections = (next: HomeSection[], msg?: string) => save('homeLayout', { sections: next.map((x, i) => ({ ...x, order: i + 1 })) }, msg);
  const saveBanners = (next: Banner[], msg?: string) => save('homeBanners', { banners: next.map((x, i) => ({ ...x, order: i + 1 })) }, msg);
  const saveTypes = (next: TypeVis[], msg?: string) => save('typeVisibility', { propertyTypes: next.map((x, i) => ({ ...x, order: i + 1 })) }, msg);
  const saveSlides = (next: Slide[], msg?: string) => save('onboarding', { slides: next.map((x, i) => ({ ...x, order: i + 1 })) }, msg);
  const saveCuration = (nextFeatured: string[]) => save('curation', { ...curation, featuredOrder: nextFeatured });

  const bannerForm = (b?: Banner) =>
    modal.open({
      title: b ? 'Edit Banner' : 'Add Banner',
      wide: true,
      formCols: 2,
      fields: [
        { key: 't', label: 'Banner Title', required: true, placeholder: 'e.g. New Launches in HSR!', default: b?.title },
        { key: 's', label: 'Subtitle / Description', placeholder: 'e.g. Starting ₹45L onwards', default: b?.subtitle },
        { key: 'cta', label: 'CTA Button Text', placeholder: 'e.g. View Properties', default: b?.ctaText },
        { key: 'bg', label: 'Background Color', type: 'select', options: ['Blue', 'Green', 'Orange', 'Purple', 'Red', 'Dark', 'Teal'], default: b?.bgColor || 'Blue' },
        { key: 'img', label: 'Image URL (optional)', hint: 'Recommended: 800×400px, max 2MB', default: b?.imageUrl },
        { key: 'nav', label: 'When user taps banner, go to:', type: 'select', options: NAV_OPTIONS, default: b?.navigateTo || 'Open full Featured list' },
        { key: 'url', label: 'External URL', default: b?.externalUrl },
        { key: 'start', label: 'Start Date', type: 'date', default: b?.startDate },
        { key: 'end', label: 'Expiry Date', type: 'date', default: b?.expiryDate },
      ],
      validate: (v) => ({
        img: isHttps(v.img) ? '' : 'URL must start with https://',
        url: v.nav === 'External URL' && !/^https:\/\//.test(s(v.url)) ? 'URL must start with https://' : '',
        end: v.start && v.end && s(v.end) < s(v.start) ? 'Expiry must be after start' : '',
      }),
      submit: 'Save Banner',
      onSubmit: async (v) => {
        const rec: Banner = {
          id: b?.id || uid('BN'), title: s(v.t).trim(), subtitle: s(v.s), ctaText: s(v.cta) || 'View', bgColor: s(v.bg), imageUrl: s(v.img).trim(), navigateTo: s(v.nav),
          externalUrl: s(v.url).trim(), startDate: s(v.start), expiryDate: s(v.end), isActive: b ? b.isActive : true, order: b?.order ?? banners.length + 1,
        };
        await saveBanners(b ? banners.map((x) => (x.id === b.id ? rec : x)) : [...banners, rec], b ? 'Banner updated' : '✅ Banner saved');
      },
    });

  const testImage = (b: Banner) => {
    if (!b.imageUrl) return toast('No image URL on this banner');
    const img = new Image();
    img.onload = () => toast('Image loaded successfully');
    img.onerror = () => toast('⚠️ Image could not be loaded');
    img.src = b.imageUrl;
  };

  const toggleType = (i: number, field: 'showOnBuy' | 'showOnSell') => {
    const t = types[i]!;
    const go = () => saveTypes(types.map((x, k) => (k === i ? { ...x, [field]: !x[field] } : x)), t.displayName + ' visibility updated');
    if (field === 'showOnBuy' && t.showOnBuy && types.filter((x) => x.showOnBuy).length === 1) return toast('At least 1 must be active');
    if (field === 'showOnBuy' && !t.showOnBuy && t.slug === 'interior') return askConfirm({ title: 'Enable Interior on Buy screen?', confirmLabel: 'Enable', onConfirm: go });
    if (field === 'showOnSell' && !t.showOnSell && t.slug === 'fractional') return askConfirm({ title: 'Enable Fractional on Sell screen?', confirmLabel: 'Enable', onConfirm: go });
    void go();
  };

  const fq = f.str('fq').trim().toLowerCase();
  const cand = fq ? props.filter((p) => !p.isFeatured && p.status === 'available' && p.title.toLowerCase().includes(fq)).slice(0, 5) : [];
  const uq = f.str('uq').trim().toLowerCase();
  const ucand = uq ? props.filter((p) => !p.isUpcoming && !p.isFeatured && p.title.toLowerCase().includes(uq)).slice(0, 5) : [];
  const news = tc.ofSection('news');
  const faqs = tc.ofSection('faq').slice().sort((a, b) => a.order - b.order);

  const preview: SectionSpec = {
    title: '📱 Live preview',
    subtitle: 'Preview updates as you edit',
    rows: [
      { key: 'bar', title: 'BUILTGLORY', sub: 'Search properties…' },
      ...activeBanners.map((b) => ({ key: b.id, title: '🖼 ' + b.title, sub: b.subtitle })),
      ...featured.slice(0, 3).map((p) => ({ key: 'f' + p.id, title: '⭐ ' + p.title, sub: price(p.price) + ' · ✅ Verified' })),
      ...upcoming.slice(0, 2).map((p) => ({ key: 'u' + p.id, title: 'UPCOMING · ' + p.title, sub: day(p.launchDate) ? date(day(p.launchDate) + 'T12:00:00') : 'Set date ⚠️' })),
    ],
  };

  const main: Array<SectionSpec | null> = [];
  const side: SectionSpec[] = [];

  if (cur === 'home') {
    main.push(
      {
        title: 'Section Visibility',
        subtitle: 'Drag to reorder sections and control visibility on the app home screen',
        banners: storedSections?.length ? [] : [{ text: 'Showing the default app layout — save to store it.', tone: 'muted' }],
        rows: sections.map((h, i) => ({
          key: h.id,
          title: '⠿ ' + h.label,
          sub: !h.canDisable ? 'This section cannot be moved or disabled' : h.description,
          badges: [badge(h.isActive ? 'Visible' : 'Hidden', h.isActive ? 'green' : 'muted')],
          actions: !h.canDisable
            ? []
            : [
                { label: '↑', onClick: () => void saveSections(move(sections, i, -1)) },
                { label: '↓', onClick: () => void saveSections(move(sections, i, 1)) },
                { label: h.isActive ? 'Hide' : 'Show', onClick: () => void saveSections(sections.map((x) => (x.id === h.id ? { ...x, isActive: !x.isActive } : x))) },
              ],
        })),
        actions: [btn('Save Layout', () => void saveSections(sections, '✅ Home layout saved'), 'primary', { loading: tc.save.isPending })],
      },
      {
        title: 'Home Banners',
        subtitle: 'Manage promotional carousel banners on the app home screen.',
        banners: [
          activeBanners.length === 0 ? { text: 'No active banners. Home screen will show no carousel.', tone: 'warn' } : null,
          banners.length > 5 ? { text: 'More than 5 banners may slow app loading…', tone: 'warn' } : null,
          { text: 'App shows banners in this order. Auto-cycles every 3 seconds.', tone: 'muted' },
        ],
        rows: banners.map((b, i) => ({
          key: b.id,
          title: i + 1 + '. ' + b.title,
          sub: (b.subtitle ? b.subtitle + ' · ' : '') + 'CTA "' + (b.ctaText || 'View') + '" · → ' + (b.navigateTo || 'No action'),
          badges: [badge(b.isActive ? 'Active' : 'Inactive', b.isActive ? 'green' : 'muted')],
          actions: [
            { label: '↑', onClick: () => void saveBanners(move(banners, i, -1)) },
            { label: '↓', onClick: () => void saveBanners(move(banners, i, 1)) },
            { label: 'Test', onClick: () => testImage(b) },
            { label: b.isActive ? 'Deactivate' : 'Activate', onClick: () => void saveBanners(banners.map((x) => (x.id === b.id ? { ...x, isActive: !x.isActive } : x)), 'Banner ' + b.title + (b.isActive ? ' deactivated' : ' activated')) },
            { label: 'Edit', onClick: () => bannerForm(b) },
            { label: 'Delete', variant: 'red', onClick: () => askConfirm({ title: 'Delete banner?', confirmLabel: 'Delete', tone: 'destructive', onConfirm: () => saveBanners(banners.filter((x) => x.id !== b.id), 'Banner deleted') }) },
          ],
        })),
        empty: banners.length ? '' : 'No banners yet',
        actions: [btn('+ Add Banner', () => bannerForm(), 'primary'), btn('Save All Banners', () => void saveBanners(banners, '✅ Banners saved'), 'outline', { loading: tc.save.isPending })],
      },
      {
        title: 'Property Type Visibility',
        tag: 'App screens: B-01 Buy + SL-01 Sell',
        banners: [
          types.some((t) => t.showOnBuy) ? null : { text: 'No property types visible on Buy screen. At least 1 must be active.', tone: 'error' },
          storedTypes?.length ? null : { text: 'Showing all 13 types (nothing saved yet).', tone: 'muted' },
        ],
        rows: types.map((t, i) => ({
          key: t.id,
          title: i + 1 + '. ' + t.displayName,
          sub: t.typeName,
          actions: [
            { label: 'Buy ' + (t.showOnBuy ? '✓' : '✗'), variant: t.showOnBuy ? 'green' : 'outline', onClick: () => toggleType(i, 'showOnBuy') },
            { label: 'Sell ' + (t.showOnSell ? '✓' : '✗'), variant: t.showOnSell ? 'green' : 'outline', onClick: () => toggleType(i, 'showOnSell') },
            { label: '↑', onClick: () => void saveTypes(move(types, i, -1)) },
          ],
        })),
        actions: [btn('Save All Property Types', () => void saveTypes(types, '✅ Property types saved'), 'primary', { loading: tc.save.isPending })],
      },
      {
        title: '⭐ Featured Properties',
        tag: 'App screen: H-01',
        subtitle: 'First property = first card shown',
        banners: featured.length >= 20 ? [{ text: '⚠️ Maximum 20 featured. Remove one first.', tone: 'warn' }] : [],
        formCols: 1,
        form: [f.inp('fq', '', { placeholder: '🔍 Search property to feature...' })],
        rows: [
          ...cand.map((p) => ({
            key: 'c' + p.id,
            title: '+ ' + p.title,
            sub: price(p.price),
            actions: [{
              label: 'Add',
              onClick: () => {
                if (featured.length >= 20) return toast('⚠️ Maximum 20 featured. Remove one first.');
                propMut.mutate({ id: p.id, body: { isFeatured: true, isUpcoming: false } }, { onSuccess: () => { f.set('fq', ''); toast('⭐ ' + p.title + ' featured'); void saveCuration([...featured.map((x) => x.id), p.id]); } });
              },
            }],
          })),
          ...featured.map((p, i) => ({
            key: 'f' + p.id,
            title: i + 1 + '. ' + p.title,
            sub: price(p.price),
            actions: [
              { label: '↑', onClick: () => void saveCuration(move(featured.map((x) => x.id), i, -1)) },
              { label: '× Remove', variant: 'red' as const, onClick: () => propMut.mutate({ id: p.id, body: { isFeatured: false } }, { onSuccess: () => toast(p.title + ' removed from Featured') }) },
            ],
          })),
        ],
        empty: featured.length || cand.length ? '' : propsQ.isPending ? 'Loading properties…' : 'Search and add your first →',
      },
      {
        title: '🚀 Upcoming Properties',
        form: [f.inp('uq', 'Add Upcoming Launch', { placeholder: 'Search property…' }), f.inp('ud', 'Set Launch Date:', { type: 'date', min: today })],
        banners: upcoming.length && upcoming.every((p) => day(p.launchDate) && day(p.launchDate) < today) ? [{ text: 'All upcoming launches passed! Update dates or remove listings.', tone: 'warn' }] : [],
        rows: [
          ...ucand.map((p) => ({
            key: 'c' + p.id,
            title: '+ ' + p.title,
            actions: [{
              label: 'Add to Upcoming 🚀',
              onClick: () => {
                const d = f.str('ud');
                if (!d || d <= today) return void f.fail('ud', 'Launch date must be in the future');
                propMut.mutate({ id: p.id, body: { isUpcoming: true, launchDate: d } }, { onSuccess: () => { f.clear('u'); toast('🚀 ' + p.title + ' added to Upcoming'); } });
              },
            }],
          })),
          ...upcoming.map((p) => {
            const ld = day(p.launchDate);
            const passed = !!ld && ld < today;
            const soon = !!ld && !passed && Date.parse(ld) - Date.now() < 14 * D;
            return {
              key: 'u' + p.id,
              title: p.title,
              sub: ld ? date(ld + 'T12:00:00') : '',
              badges: [!ld ? badge('Set date ⚠️', 'amber') : passed ? badge('Passed ❌', 'red') : soon ? badge('Launching soon! 🚀', 'purple') : null],
              actions: [
                passed ? { label: 'Move to Available', variant: 'green' as const, onClick: () => propMut.mutate({ id: p.id, body: { isUpcoming: false, isVisibleOnApp: true }, status: p.status === 'available' ? undefined : 'available' }, { onSuccess: () => toast('✅ ' + p.title + ' moved to Available') }) } : null,
                { label: '×', variant: 'red' as const, title: 'Remove from Upcoming', onClick: () => propMut.mutate({ id: p.id, body: { isUpcoming: false } }, { onSuccess: () => toast(p.title + ' removed from Upcoming') }) },
              ],
            };
          }),
        ],
        empty: upcoming.length || ucand.length ? '' : 'No upcoming properties',
      },
      {
        title: 'News & Insights',
        rows: news.map((n) => ({
          key: n.id,
          title: n.title,
          sub: (n.category || 'General') + ' · ' + date(n.publishedAt || n.createdAt) + (n.status !== 'published' ? ' · ' + n.status : ''),
          actions: [{ label: 'Delete', variant: 'red' as const, onClick: () => askConfirm({ title: 'Delete article?', confirmLabel: 'Delete', tone: 'destructive', onConfirm: () => contentMut.mutateAsync(() => deleteContent(n.id)).then(() => toast('Article deleted')) }) }],
        })),
        empty: news.length ? '' : 'No articles yet',
        actions: [
          btn('+ Add Article', () =>
            modal.open({
              title: 'Add Article',
              fields: [
                { key: 't', label: 'Title', required: true },
                { key: 'cat', label: 'Category', type: 'select', options: ['Market News', 'Tips', 'Legal', 'Investment'], default: 'Market News' },
              ],
              onSubmit: (v) => contentMut.mutateAsync(() => createContent({ section: 'news', title: s(v.t).trim(), category: s(v.cat), status: 'published' })).then(() => toast('✅ Article added')),
            }), 'primary'),
        ],
      },
    );
    side.push(preview);
  }

  if (cur === 'onboarding') {
    const act = slides.filter((x) => x.isActive).length;
    main.push({
      title: 'Onboarding',
      tag: 'App screen: S-02',
      subtitle: 'Edit slides shown to new users on first app launch · First slide = first screen shown',
      banners: [
        slides.length < 2 ? { text: 'Minimum 2 slides required', tone: 'error' } : null,
        !act ? { text: 'No active slides. At least 1 must be active.', tone: 'error' } : null,
        slides.length > 4 ? { text: 'More than 4 slides reduces completion rate', tone: 'warn' } : null,
      ],
      rows: slides.map((x, i) => ({
        key: x.id,
        title: i + 1 + '. ' + x.title,
        sub: x.description,
        badges: [badge(x.isActive ? 'Active' : 'Inactive', x.isActive ? 'green' : 'muted')],
        actions: [
          { label: '↑', onClick: () => void saveSlides(move(slides, i, -1)) },
          { label: x.isActive ? 'Deactivate' : 'Activate', onClick: () => void saveSlides(slides.map((y) => (y.id === x.id ? { ...y, isActive: !y.isActive } : y))) },
          { label: 'Delete', variant: 'red' as const, onClick: () => askConfirm({ title: 'Delete slide?', confirmLabel: 'Delete', tone: 'destructive', onConfirm: () => saveSlides(slides.filter((y) => y.id !== x.id), 'Slide deleted') }) },
        ],
      })),
      empty: slides.length ? '' : 'No onboarding slides yet',
      actions: [
        btn('+ Add Slide', () =>
          modal.open({
            title: 'Add Slide',
            fields: [
              { key: 't', label: 'Title (required, max 50)', required: true },
              { key: 'd', label: 'Description (required, max 120)', type: 'textarea', required: true },
              { key: 'img', label: 'Image URL (optional)' },
              { key: 'a', label: 'Active', type: 'checkbox', default: true },
            ],
            validate: (v) => ({ t: s(v.t).length > 50 ? 'Max 50 characters' : '', d: s(v.d).length > 120 ? 'Max 120 characters' : '', img: isHttps(v.img) ? '' : 'URL must start with https://' }),
            onSubmit: (v) => saveSlides([...slides, { id: uid('OB'), order: slides.length + 1, title: s(v.t).trim(), description: s(v.d).trim(), imageUrl: s(v.img).trim(), isActive: !!v.a }], '✅ Slide added'),
          })),
        btn('Save Onboarding Slides', () => {
          if (slides.length < 2 || !act) return toast('Fix the slide rules before saving');
          void saveSlides(slides, '✅ Onboarding slides saved');
        }, 'primary', { loading: tc.save.isPending }),
      ],
    });
    side.push({ title: '📱 Preview', rows: slides.filter((x) => x.isActive).map((x) => ({ key: x.id, title: x.title, sub: x.description })), empty: act ? '' : 'No active slides' });
  }

  if (cur === 'faq') {
    const swap = (i: number) => {
      const a = faqs[i];
      const b = faqs[i - 1];
      if (!a || !b) return;
      const ao = a.order === b.order ? i : a.order;
      const bo = a.order === b.order ? i + 1 : b.order;
      contentMut.mutate(() => reorderContent([{ id: a.id, order: Math.min(ao, bo) }, { id: b.id, order: Math.max(ao, bo) }]));
    };
    const faqForm = (x?: ContentItem) =>
      modal.open({
        title: x ? 'Edit FAQ' : 'Add FAQ',
        fields: [
          { key: 'q', label: 'Question', required: true, default: x?.title },
          { key: 'a', label: 'Answer', type: 'textarea', required: true, default: x?.body },
        ],
        onSubmit: (v) =>
          contentMut
            .mutateAsync(() =>
              x
                ? updateContent(x.id, { title: s(v.q).trim(), body: s(v.a).trim() })
                : createContent({ section: 'faq', title: s(v.q).trim(), body: s(v.a).trim(), status: 'published', order: (faqs[faqs.length - 1]?.order ?? 0) + 1 }),
            )
            .then(() => toast(x ? 'FAQ updated' : '✅ FAQ added')),
      });
    main.push({
      title: 'FAQ',
      rows: faqs.map((x, i) => ({
        key: x.id,
        title: x.title,
        sub: x.body,
        actions: [
          { label: '↑', disabled: i === 0, onClick: () => swap(i) },
          { label: 'Edit', onClick: () => faqForm(x) },
          { label: 'Delete', variant: 'red' as const, onClick: () => askConfirm({ title: 'Delete FAQ?', confirmLabel: 'Delete', tone: 'destructive', onConfirm: () => contentMut.mutateAsync(() => deleteContent(x.id)).then(() => toast('FAQ deleted')) }) },
        ],
      })),
      empty: faqs.length ? '' : 'No FAQs yet',
      actions: [btn('+ Add FAQ', () => faqForm(), 'primary')],
    });
  }

  if (cur === 'terms' || cur === 'privacy') {
    const slug = cur === 'terms' ? 'terms-of-service' : 'privacy-policy';
    const doc = tc.bySlug(slug);
    const key = 'doc.' + cur;
    const label = cur === 'terms' ? 'Terms & Conditions' : 'Privacy Policy';
    main.push({
      title: label,
      subtitle: doc ? 'Last updated ' + date(doc.updatedAt) : 'Not published yet',
      banners: [{ text: 'Changes here update the app immediately', tone: 'warn' }],
      formCols: 1,
      form: [f.inp(key, '', { type: 'textarea', default: doc?.body ?? '' })],
      actions: [
        btn('Save Changes', () => {
          const body = f.str(key, doc?.body ?? '').trim();
          if (!body) return void f.fail(key, 'Content cannot be empty');
          const payload = { slug, section: 'legal' as const, title: cur === 'terms' ? doc?.title || 'Terms of Service' : doc?.title || 'Privacy Policy', excerpt: cur === 'terms' ? 'Terms of Service' : 'How we use and protect your data', body, category: cur, status: 'published' as const, metadata: { ...(doc?.metadata ?? {}), lastUpdatedLabel: date(new Date()) } };
          contentMut.mutate(() => (doc ? updateContent(doc.id, payload) : createContent(payload)), { onSuccess: () => toast('✅ Saved') });
        }, 'primary', { loading: contentMut.isPending }),
        btn('Preview in App', () => modal.open({ title: '📱 ' + label + ' preview', text: f.str(key, doc?.body ?? '') || 'Nothing to preview yet.', submit: 'Close' })),
      ],
    });
  }

  if (cur === 'about') {
    const about = tc.bySlug('about-builtglory');
    const m = about?.metadata ?? {};
    const fu = (tc.meta(CONFIG_RECORDS.forceUpdate!.slug).forceUpdate ?? {}) as Record<string, unknown>;
    main.push(
      {
        title: 'About App',
        form: [
          f.inp('ab.v', 'App Version', { default: s(m.version) }),
          f.inp('ab.b', 'Build Number', { default: s(m.buildNumber) }),
          f.inp('ab.r', 'Release Date', { type: 'date', default: s(m.releaseDate) }),
          f.inp('ab.c', 'Company Name', { default: s(m.companyName) }),
          f.inp('ab.w', 'Company Website', { default: s(m.companyWebsite), placeholder: 'https://…' }),
          f.inp('ab.e', 'Support Email', { default: s(m.supportEmail) }),
          f.inp('ab.p', 'Support Phone', { default: s(m.supportPhone) }),
          f.inp('ab.d', 'App Description', { type: 'textarea', default: about?.body ?? '' }),
          f.inp('ab.s', 'Social Links', { default: s(m.instagram) }),
        ],
        actions: [
          btn('Save About Info', () => {
            const web = f.str('ab.w', s(m.companyWebsite));
            if (web && !/^https:\/\//.test(web)) return void f.fail('ab.w', 'URL must start with https://');
            const email = f.str('ab.e', s(m.supportEmail));
            if (email && !/^\S+@\S+\.\S+$/.test(email)) return void f.fail('ab.e', 'Enter a valid email');
            const company = f.str('ab.c', s(m.companyName));
            const payload = {
              slug: 'about-builtglory', section: 'about' as const, title: 'About ' + (company || 'Builtglory'), excerpt: about?.excerpt || "India's verified real estate marketplace",
              body: f.str('ab.d', about?.body ?? ''), status: 'published' as const,
              metadata: { ...m, version: f.str('ab.v', s(m.version)), buildNumber: f.str('ab.b', s(m.buildNumber)), releaseDate: f.str('ab.r', s(m.releaseDate)), companyName: company, companyWebsite: web, supportEmail: email, supportPhone: f.str('ab.p', s(m.supportPhone)), instagram: f.str('ab.s', s(m.instagram)) },
            };
            contentMut.mutate(() => (about ? updateContent(about.id, payload) : createContent(payload)), { onSuccess: () => toast('✅ About info saved') });
          }, 'primary', { loading: contentMut.isPending }),
        ],
      },
      {
        title: 'Force Update',
        form: [
          f.inp('fu.on', 'Enable Force Update', { type: 'checkbox', hint: 'Users below min version will be forced to update', default: bool(fu.enabled) }),
          f.inp('fu.min', 'Min Required Version', { default: s(fu.minVersion) || '1.0.0' }),
        ],
        actions: [
          btn('Save Update Settings', () => {
            const min = f.str('fu.min', s(fu.minVersion) || '1.0.0').trim();
            if (!/^\d+\.\d+\.\d+$/.test(min)) return void f.fail('fu.min', 'Use format 1.0.0');
            void save('forceUpdate', { forceUpdate: { enabled: !!f.val<boolean>('fu.on', bool(fu.enabled)), minVersion: min } }, '✅ Update settings saved');
          }, 'primary', { loading: tc.save.isPending }),
        ],
      },
    );
  }

  if (cur === 'push') {
    main.push({ title: 'Push Notifications', text: 'Compose, schedule and review delivery reports from the Push Notifications tab.', actions: [btn('Open Push Notifications →', () => navigate('/admin/tools/push'), 'primary')] });
  }

  const err = tc.save.error || contentMut.error || propMut.error;
  return (
    <RecordDetailView
      state="ok"
      isPage
      title="App Content"
      meta="Manage what users see in the BuiltGlory app"
      tabs={SUB_TABS.map(([k, label]) => ({ label, active: cur === k, onClick: () => f.set('sec', k) }))}
      banners={[err ? { text: '⚠️ Last change was not saved: ' + formatApiError(err), tone: 'error' } : null]}
      main={main}
      side={side}
      single={!side.length}
    >
      {modal.element}
    </RecordDetailView>
  );
}
