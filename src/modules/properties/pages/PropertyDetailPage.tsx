import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { detailStateOf } from '../../../components/detail/detailState';
import { btn } from '../../../components/detail/sections';
import { useFormModal } from '../../../components/ui/FormModal';
import { RecordDetailView } from '../../../components/ui/RecordDetailView';
import { useEditLock } from '../../../hooks/useEditLock';
import { useSession } from '../../../hooks/useSession';
import { useFormFields } from '../../../hooks/useFormFields';
import { useWorkflowSections } from '../../../hooks/useWorkflowSections';
import { copyText } from '../../../lib/contact';
import { badge, date, num, price, todayIso, typeLabel } from '../../../lib/format';
import { sendAdminPush } from '../../../services/notifications';
import { getProperty } from '../../../services/properties';
import { askConfirm, toast } from '../../../store/uiStore';
import type { Property, PropertyPayload } from '../../../types/properties';
import { PROPERTY_STATUS, areaOf, bhkOf, displayStatus, reraOf } from '../constants';
import { usePropertyActions } from '../hooks/useProperties';

const AMEN = ['Swimming Pool', 'Gym', 'Clubhouse', 'Power Backup', 'Lift', 'Security', 'CCTV', 'Garden', 'Covered Parking', 'EV Charging'];
const NEARBY_ICON: Record<string, string> = { school: '🏫', hospital: '🏥', mall: '🛍️', it_park: '💻', airport: '✈️', highway: '🛣️', restaurant: '🍽️', metro: '🚇' };
const MEDIA: Array<[keyof Property & string, string, string]> = [
  ['videoUrl', 'videoUrl', 'Video Walkthrough'],
  ['droneImageUrl', 'droneImageUrl', 'Aerial / Drone Image'],
  ['droneVideoUrl', 'droneVideoUrl', 'Aerial / Drone Video'],
  ['tour3dUrl', 'tour3dUrl', '3D Virtual Tour'],
  ['floorPlanUrl', 'floorPlanUrl', 'Floor Plan'],
];
const isUrl = (v: unknown) => /^https:\/\//.test(String(v || '').trim());
const day = (v: string | null) => (v ? v.slice(0, 10) : '');

/** Full address object for PATCH (the endpoint replaces nested objects, so unchanged parts are re-sent). */
const addressOf = (p: Property, patch: Partial<NonNullable<PropertyPayload['address']>> = {}): NonNullable<PropertyPayload['address']> => ({
  line1: p.line1 || null,
  line2: p.line2 || null,
  landmark: p.landmark || null,
  locality: p.locality || null,
  city: p.city || null,
  state: p.state || null,
  ...(/^\d{6}$/.test(p.pincode) ? { pincode: p.pincode } : {}),
  ...(p.latitude != null ? { latitude: p.latitude } : {}),
  ...(p.longitude != null ? { longitude: p.longitude } : {}),
  ...patch,
});

export function PropertyDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const f = useFormFields();
  const modal = useFormModal();
  const act = usePropertyActions();
  const { admin } = useSession();
  const q = useQuery({ queryKey: ['property', id], queryFn: ({ signal }) => getProperty(id, signal), retry: false });
  const p = q.data;
  const wf = useWorkflowSections('property', id, f, p?.createdAt);
  const lock = useEditLock('property', id);

  const state = detailStateOf(q);
  if (state !== 'ok' || !p) return <RecordDetailView state={state} onRetry={() => void q.refetch()} backPath="/admin/properties/all" nfTitle="Property not found" />;

  const today = todayIso();
  const ds = displayStatus(p);
  const st = PROPERTY_STATUS[ds] ?? [ds, 'muted'];
  const media = p.media;
  const rera = reraOf(p);
  const area = areaOf(p);
  const launch = day(p.launchDate);
  const visOk: Array<[string, boolean]> = [
    ['Status is Active', p.status === 'available' && p.isVisibleOnApp],
    ['Photos uploaded (min 1)', p.photos.length > 0],
    ['Price set', p.price > 0],
    ['Location complete', !!(p.locality && p.city)],
    ['Description added', !!p.description],
    ...(p.type === 'apartment' ? [['RERA number (apartments)', !!rera] as [string, boolean]] : []),
  ];
  const nri: Array<[string, boolean]> = [
    ['Video walkthrough', !!p.videoUrl],
    ['Aerial / drone media', !!(p.droneImageUrl || p.droneVideoUrl)],
    ['3D tour', !!p.tour3dUrl],
    ['Floor plan', !!p.floorPlanUrl],
    ['RERA number', !!rera],
  ];
  const nriScore = Math.round((nri.filter((x) => x[1]).length / nri.length) * 100);
  const patch = (body: PropertyPayload, msg?: string) => act.patch(p, body, msg);
  const setMedia = (key: string, value: string | null, msg: string) => patch({ media: { ...media, [key]: value } }, msg);
  const setMediaPhotos = (photos: string[], msg: string) => patch({ media: { ...media, photos, coverPhoto: photos[0] ?? null } }, msg);

  const notifySavers = async (np: number) => {
    if (!p.savedByUsers.length) return toast('No buyers have saved this property — no price drop notification sent');
    const results = await Promise.allSettled(
      p.savedByUsers.map((userId) =>
        sendAdminPush({ userId, audience: 'buyer', notificationType: 'price_drop', title: 'Price dropped on ' + p.title, message: 'Now ' + price(np), propertyId: p.id, entityType: 'property', entityId: p.id }),
      ),
    );
    const sent = results.filter((r) => r.status === 'fulfilled').length;
    toast('🔔 Price drop sent to ' + sent + ' of ' + p.savedByUsers.length + ' saved-by buyers');
  };

  const updatePrice = () =>
    modal.open({
      title: '💰 Update Price',
      fields: [
        { key: 'price', label: 'New price (₹)', type: 'number', required: true, default: String(p.price || '') },
        { key: 'notify', label: 'Send price drop notification when price is lowered', type: 'checkbox', default: true },
      ],
      submit: 'Save price',
      validate: (v) => ({ price: Number(v.price) > 0 ? '' : 'Enter a valid price' }),
      onSubmit: async (v) => {
        const np = Number(v.price);
        const apply = async () => {
          const ok = await patch({ price: np }, '💰 Price updated');
          if (ok && v.notify && np < p.price) await notifySavers(np);
        };
        if (np < p.price * 0.85) {
          askConfirm({ title: 'Large price drop', message: 'Confirm price reduction from ' + price(p.price) + ' to ' + price(np) + '?', confirmLabel: 'Confirm drop', tone: 'destructive', onConfirm: apply });
        } else {
          await apply();
        }
      },
    });

  const edit = () =>
    modal.open({
      title: '✏️ Edit Property',
      wide: true,
      formCols: 2,
      fields: [
        { key: 'title', label: 'Property Title', default: p.title, required: true },
        { key: 'locality', label: 'Locality', default: p.locality, required: true },
        { key: 'address', label: 'Address', default: p.line1 },
        { key: 'rera', label: 'RERA Number', default: rera },
        { key: 'bhk', label: 'BHK', type: 'number', default: String(p.specs.bhk ?? '').replace(/\D/g, '') },
        { key: 'area', label: 'Area (sqft)', type: 'number', default: area ? String(area) : '' },
        { key: 'desc', label: 'Description', type: 'textarea', default: p.description, full: true },
      ],
      submit: 'Save Changes',
      onSubmit: async (v) => {
        const specs: Record<string, unknown> = { ...p.specs, reraNumber: String(v.rera || '') || undefined };
        if (v.bhk) specs.bhk = String(v.bhk);
        if (Number(v.area) > 0) {
          const areaKey = p.specs.builtUpArea != null ? 'builtUpArea' : p.specs.carpetArea != null ? 'carpetArea' : p.specs.plotArea != null ? 'plotArea' : p.type === 'plot' || p.type === 'land' ? 'plotArea' : 'builtUpArea';
          specs[areaKey] = Number(v.area);
        }
        await act.patch(p, { title: String(v.title), description: String(v.desc || ''), address: addressOf(p, { locality: String(v.locality), line1: String(v.address || '') || null }), specs }, '✅ Property updated');
      },
    });

  const toggleUp = () => {
    if (p.isUpcoming) return void patch({ isUpcoming: false }, 'Removed from Upcoming');
    if (p.isFeatured) return toast('Cannot be both Featured and Upcoming');
    modal.open({
      title: '🕐 Mark as Upcoming',
      fields: [{ key: 'd', label: 'Launch Date', type: 'date', min: today, required: true, reqMsg: 'Launch date is required for upcoming properties', default: launch }],
      onSubmit: (v) => patch({ isUpcoming: true, launchDate: String(v.d) }, '🕐 Showing in upcoming section'),
    });
  };
  const toggleFeat = () => {
    if (!p.isFeatured && p.isUpcoming) return toast('Cannot be both Featured and Upcoming');
    void patch({ isFeatured: !p.isFeatured }, p.isFeatured ? 'Removed from Featured' : '⭐ Showing in Featured section');
  };
  const confirmStatus = (title: string, run: () => Promise<unknown>) => askConfirm({ title, confirmLabel: 'Confirm', onConfirm: run });
  const addMedia = (key: string, label: string) =>
    modal.open({
      title: label,
      fields: [{ key: 'url', label: 'URL', required: true, placeholder: key === 'tour3dUrl' ? 'https://my.matterport.com/show/?m=...' : 'https://…', default: String(media[key] ?? '') }],
      validate: (v) => ({ url: isUrl(v.url) ? '' : 'URL must start with https://' }),
      onSubmit: (v) => setMedia(key, String(v.url).trim(), '✅ ' + label + ' saved'),
    });

  const preview = () =>
    modal.open({
      title: 'App preview (B-04)',
      info: [
        { label: 'Title', value: p.title, strong: true },
        { label: 'Price', value: price(p.price), strong: true, color: '#2563eb' },
        { label: 'Location', value: [p.locality, p.city].filter(Boolean).join(', ') },
        { label: 'Specs', value: [bhkOf(p), area ? area + ' sqft' : ''].filter(Boolean).join(' · ') },
      ],
      custom: p.photos[0] ? <img src={p.photos[0]} alt="" style={{ width: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: 8 }} /> : undefined,
      text: 'Preview only — actual app may vary',
      submit: 'Close',
      extraActions: [{ label: 'Open in app', onClick: () => void copyText(p.referenceId || p.id) }],
    });

  const remove = () =>
    askConfirm({
      title: 'Delete property?',
      message: p.status === 'sold' ? 'This is a sold property. Delete record anyway?' : 'This will move the property to Deleted Properties. You can restore it later.',
      confirmLabel: 'Delete',
      tone: 'destructive',
      onConfirm: async () => {
        await act.remove([p.id]);
        navigate('/admin/properties/all');
      },
    });

  const sourceText = p.acquisitionId ? 'Acquired via acquisition ' + p.acquisitionId.slice(-6).toUpperCase() : p.source === 'bulk_upload' ? 'Uploaded via Master Sheet' + (p.sourceSheet ? ' (' + p.sourceSheet + ')' : '') : p.source === 'acquired' ? 'Acquired from a seller' : 'Added manually';
  const possession = day(p.possessionDate) ? date(day(p.possessionDate) + 'T12:00:00') : String(p.specs.possession ?? '') || (p.status === 'under_construction' ? 'Under construction' : 'Ready to move');

  return (
    <RecordDetailView
      state="ok"
      backPath="/admin/properties/all"
      crumbs={[{ label: 'Properties', path: '/admin/properties/all' }, { label: p.title }]}
      title={p.title}
      badges={[
        { text: st[0], tone: st[1] },
        p.isFeatured ? { text: '⭐ Featured', tone: 'amber' } : null,
        p.isUpcoming ? { text: '🕐 Upcoming', tone: 'purple' } : null,
        { text: typeLabel(p.type), tone: 'muted' },
      ]}
      meta={p.referenceId + ' • ' + [p.locality, p.city].filter(Boolean).join(', ') + ' • ' + (p.price ? price(p.price) : 'Price not set') + (p.isNegotiable ? ' · Negotiable' : '') + ' • Added ' + date(p.createdAt)}
      banners={[
        lock,
        p.status === 'draft' ? { text: '⚠️ Draft — not visible on app', tone: 'warn', actions: [{ label: '▶️ Publish', onClick: () => confirmStatus('Publish property?', () => act.publish(p, '▶️ Published')) }] } : null,
        p.isUpcoming && launch && launch < today ? { text: 'Launch passed', tone: 'error', actions: [{ label: 'Move to Available', onClick: () => void act.moveToAvailable(p) }] } : null,
      ]}
      hActions={[
        btn('💰 Update Price', updatePrice, 'primary'),
        btn('✏️ Edit Property', edit),
        btn(p.isFeatured ? '⭐ Remove Featured' : '⭐ Mark Featured', toggleFeat),
        btn(p.isUpcoming ? '🕐 Remove Upcoming' : '🕐 Mark Upcoming', toggleUp),
        btn('📱 View on App', preview),
      ]}
      main={[
        {
          title: 'Photos',
          images: p.photos,
          empty: p.photos.length ? '' : 'No photos — add photos to make this property visible on app',
          formCols: 1,
          form: [f.inp('ph', '', { placeholder: 'https://… photo URL' })],
          actions: [
            btn('+ Add Photo URL', () => {
              const u = f.str('ph').trim();
              if (!u || !isUrl(u)) return void f.fail('ph', 'URL must start with https://');
              void setMediaPhotos([...p.photos, u], '📸 Photo added').then(() => f.set('ph', ''));
            }, 'outline', { loading: act.busy }),
            p.photos.length ? btn('Remove last', () => void setMediaPhotos(p.photos.slice(0, -1), 'Photo removed'), 'red') : null,
          ],
        },
        {
          title: 'Media & Virtual Tour',
          subtitle: 'Photos, walkthrough, drone, 3D tour, and floor plan for NRI buyers',
          rows: MEDIA.map(([prop, key, label]) => {
            const url = p[prop] as string | null;
            return {
              key,
              title: label,
              sub: url || (key === 'tour3dUrl' ? 'Essential for NRI buyers' : 'Not added'),
              badges: [url ? badge('Added', 'green') : badge('Missing', 'muted')],
              actions: [
                url ? { label: 'Preview', onClick: () => window.open(url, '_blank', 'noopener,noreferrer') } : null,
                { label: url ? 'Edit' : '+ Add', onClick: () => addMedia(key, label) },
                url ? { label: 'Remove', variant: 'red' as const, onClick: () => void setMedia(key, null, label + ' removed') } : null,
              ],
            };
          }),
        },
        { title: 'NRI Readiness Score', subtitle: nriScore + '%', checks: nri.map(([label, done]) => ({ label, done })) },
        {
          title: 'Property Details',
          fields: [
            { label: 'Type', value: typeLabel(p.type) },
            { label: 'BHK', value: bhkOf(p) },
            { label: 'Area', value: area ? num(area) + ' sqft' : '' },
            { label: 'Price', value: price(p.price), strong: true },
            { label: 'Negotiable', value: p.isNegotiable ? 'Yes' : 'No' },
            { label: 'RERA', value: rera },
            { label: 'Address', value: p.addressLine },
            { label: 'Pincode', value: p.pincode },
          ],
        },
        { title: 'Description', text: p.description || 'No description added' },
        {
          title: 'Amenities',
          chips: AMEN.map((a) => ({
            label: a,
            on: p.amenities.includes(a),
            onClick: () => void patch({ amenities: p.amenities.includes(a) ? p.amenities.filter((x) => x !== a) : [...p.amenities, a] }),
          })),
        },
        {
          title: 'Why Buy This Property?',
          fields: [
            { label: 'Investment Potential', value: p.advantages?.investment.join(' · ') },
            { label: 'Location Advantages', value: p.advantages?.location.join(' · ') },
            { label: 'Connectivity', value: p.advantages?.connectivity.join(' · ') },
          ],
        },
        {
          title: 'Nearby Places',
          rows: p.nearbyPlaces.map((n, i) => ({ key: n.name + i, title: (NEARBY_ICON[n.type] || '📍') + ' ' + (n.name || n.type), right: n.distance, rightColor: '#64748b' })),
          empty: p.nearbyPlaces.length ? '' : 'No nearby places added',
        },
      ]}
      side={[
        {
          title: 'Performance',
          cols: 1,
          fields: [
            { label: '👁️ Views', value: num(p.views), strong: true },
            { label: '💬 Enquiries', value: p.enquiries },
            { label: '📅 Visits', value: p.visits },
            { label: '🔄 Comparisons', value: p.compareCount },
            { label: '❤️ Saves', value: p.saves },
          ],
          banners: p.views > 1200 ? [{ text: '🔥 Popular property', tone: 'warn' }] : [],
          actions: [btn('View All Enquiries →', () => navigate('/admin/enquiries/buy'), 'link')],
        },
        {
          title: 'Listing Status',
          stack: true,
          actions: [
            ds === 'available' ? btn('⏸️ Pause Listing', () => confirmStatus('Pause listing?', () => act.pause(p))) : null,
            p.status === 'available' || p.status === 'reserved' ? btn('✅ Mark as Sold', () => confirmStatus('Mark as sold?', () => act.markSold(p))) : null,
            ds === 'paused' ? btn('▶️ Make Available', () => confirmStatus('Make available?', () => act.publish(p, '▶️ Listing live'))) : null,
            p.status === 'draft' ? btn('▶️ Publish', () => confirmStatus('Publish property?', () => act.publish(p, '▶️ Published')), 'primary') : null,
            p.status === 'sold' && (admin?.role === 'super_admin' || admin?.permissions?.includes('*')) ? btn('♻️ Relist Property', () => confirmStatus('Relist property?', () => act.publish(p, '♻️ Relisted'))) : null,
            btn('🗑 Delete Property', remove, 'red'),
          ],
        },
        {
          title: 'App Visibility',
          checks: visOk.map(([label, done]) => ({ label, done })),
          banners: visOk.every((x) => x[1]) ? [{ text: '✅ Visible on app', tone: 'success' }] : [{ text: 'Hidden on app until all items are complete', tone: 'warn' }],
        },
        {
          title: 'Promotions',
          checks: [
            { label: '⭐ Show in Featured Section', done: p.isFeatured, onToggle: toggleFeat },
            { label: '🕐 Show in Upcoming Section', done: p.isUpcoming, onToggle: toggleUp, sub: p.isUpcoming ? 'Launch Date: ' + (launch ? date(launch + 'T12:00:00') : 'Set date ⚠️') : '' },
          ],
        },
        {
          title: 'Source Info',
          text: sourceText,
          actions: p.acquisitionId ? [btn('View Acquisition →', () => navigate('/admin/acquisition/' + p.acquisitionId), 'link')] : [],
        },
        {
          title: 'Dates',
          cols: 1,
          fields: [{ label: 'Added', value: date(p.createdAt) }, { label: 'Possession Date', value: possession }, launch ? { label: 'Launch Date', value: date(launch + 'T12:00:00') } : null, p.soldAt ? { label: 'Sold', value: date(p.soldAt) } : null],
        },
        wf.activity(),
      ]}
    >
      {modal.element}
    </RecordDetailView>
  );

}
