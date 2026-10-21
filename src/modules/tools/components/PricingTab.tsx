import { btn } from '../../../components/detail/sections';
import { useFormModal } from '../../../components/ui/FormModal';
import { RecordDetailView } from '../../../components/ui/RecordDetailView';
import { useFormFields } from '../../../hooks/useFormFields';
import { useRefreshingMutation } from '../../../hooks/useRefreshingMutation';
import { useDesigners } from '../../../hooks/useTeam';
import { formatApiError } from '../../../lib/apiClient';
import { badge, date, num, price, todayIso } from '../../../lib/format';
import { inviteAdmin, removeAdmin, updateAdmin } from '../../../services/admins';
import { askConfirm, toast } from '../../../store/uiStore';
import type { Coupon, SettingsTools } from '../../../types/settings';
import { CONFIG_RECORDS, useAdminSettings, useToolsContent } from '../hooks/useToolsContent';
import { uid } from './toolsShared';

interface BoostOrder { id: string; propertyId: string; property: string; plan: string; started: string; expires: string; status: string }

const D = 864e5;
const s = (v: unknown) => (v == null ? '' : String(v));
const amountOf = (label: string) => Number(String(label).replace(/[^\d.]/g, '')) || 0;

/**
 * Tools › Pricing — boost plans, interior packages and coupons live in admin settings
 * (`PATCH /admin/settings` → tools.*); boost orders in the `tools-operational-config` CMS record;
 * designers are admin accounts (GET /admin/designers, POST /admin/admins/invite, PATCH/DELETE /admin/admins/:id).
 */
export function PricingTab() {
  const f = useFormFields();
  const modal = useFormModal();
  const st = useAdminSettings();
  const tc = useToolsContent();
  const des = useDesigners();
  const desKeys = [['designers']];
  const addDesigner = useRefreshingMutation((b: Parameters<typeof inviteAdmin>[0]) => inviteAdmin(b), desKeys);
  const setAvail = useRefreshingMutation((v: { id: string; on: boolean }) => updateAdmin(v.id, { isAvailable: v.on }), desKeys);
  const delDesigner = useRefreshingMutation((id: string) => removeAdmin(id), desKeys);

  const loading = st.q.isPending || tc.q.isPending;
  if (loading) return <RecordDetailView state="loading" isPage />;
  const tools: SettingsTools = st.settings?.tools ?? { boostPlans: [], interiorPackages: [], coupons: [] };
  const plans = tools.boostPlans;
  const pkgs = tools.interiorPackages;
  const coupons = tools.coupons;
  const meta = tc.meta(CONFIG_RECORDS.toolsConfig!.slug);
  const orders = (tc.list<BoostOrder>(CONFIG_RECORDS.toolsConfig!.slug, 'boostOrders') ?? []).map((o) => ({ ...o, property: s(o.property), plan: s(o.plan), started: s(o.started), expires: s(o.expires) }));
  const saveTools = (patch: Partial<SettingsTools>, msg: string) => st.save.mutateAsync({ tools: { ...tools, ...patch } }).then(() => { toast(msg); return true; }).catch(() => false);
  const saveOrders = (next: BoostOrder[], msg: string) => tc.save.mutateAsync({ rec: CONFIG_RECORDS.toolsConfig!, metadata: { ...meta, boostOrders: next } }).then(() => toast(msg)).catch(() => undefined);
  const revenue = orders.reduce((t, o) => t + amountOf(plans.find((p) => p.name === o.plan)?.priceLabel ?? ''), 0);
  const settingsDenied = st.q.isError;
  const err = st.save.error || tc.save.error;

  return (
    <RecordDetailView
      state="ok"
      isPage
      title="Pricing & Monetization"
      meta="Manage boost plans, packages, and active orders · Configure seller boost tiers shown in the app (SL-14), interior packages, coupon codes, and monitor featured listing boosts in one place."
      single
      banners={[
        settingsDenied ? { text: '⚠️ Could not load admin settings (boost plans, packages, coupons): ' + formatApiError(st.q.error), tone: 'error', actions: [{ label: 'Retry', onClick: () => void st.q.refetch() }] } : null,
        tc.q.isError ? { text: '⚠️ Could not load boost orders (app content): ' + formatApiError(tc.q.error), tone: 'error', actions: [{ label: 'Retry', onClick: () => void tc.q.refetch() }] } : null,
        err ? { text: '⚠️ Last change was not saved: ' + formatApiError(err), tone: 'error' } : null,
      ]}
      main={[
        {
          title: 'Summary',
          cols: 3,
          fields: [
            { label: 'Total orders', value: orders.length, strong: true },
            { label: 'Active coupons', value: coupons.filter((c) => c.active).length, strong: true },
            { label: 'Boost revenue (est.)', value: price(revenue), strong: true },
          ],
        },
        {
          title: 'Boost Plans',
          rows: plans.map((p) => ({
            key: p.id,
            title: p.name + ' · ' + (p.priceLabel || '—'),
            sub: [p.description, p.benefits.join(' · ')].filter(Boolean).join('\n'),
            badges: [badge(p.active ? 'Show in app' : 'Hidden', p.active ? 'green' : 'muted')],
            actions: [
              { label: p.active ? 'Hide' : 'Show', onClick: () => void saveTools({ boostPlans: plans.map((x) => (x.id === p.id ? { ...x, active: !x.active } : x)) }, p.name + (p.active ? ' hidden' : ' shown in app')) },
              {
                label: 'Edit',
                onClick: () =>
                  modal.open({
                    title: 'Edit ' + p.name,
                    fields: [
                      { key: 'price', label: 'Price (₹)', type: 'number', required: true, default: String(amountOf(p.priceLabel) || '') },
                      { key: 'b', label: 'Benefits', type: 'textarea', default: p.benefits.join('\n'), hint: 'One per line (max 12)' },
                    ],
                    validate: (v) => ({ price: Number(v.price) >= 0 ? '' : 'Enter a valid price' }),
                    submit: 'Save plan',
                    onSubmit: async (v) => {
                      const benefits = s(v.b).split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 12);
                      await st.save.mutateAsync({ tools: { ...tools, boostPlans: plans.map((x) => (x.id === p.id ? { ...x, priceLabel: '₹' + num(Number(v.price)), benefits } : x)) } });
                      toast('✅ Plan saved');
                    },
                  }),
              },
            ],
          })),
          empty: plans.length ? '' : settingsDenied ? 'Unavailable' : 'No boost plans configured in settings yet.',
        },
        {
          title: 'Active Boost Orders',
          rows: orders.map((o) => {
            const left = Math.ceil((Date.parse(o.expires) - Date.now()) / D);
            return {
              key: o.id,
              title: o.property,
              sub: o.plan + ' · Started ' + date(o.started) + ' · Expires ' + date(o.expires),
              badges: [badge(left > 0 ? left + ' days left' : 'Expired', left > 3 ? 'green' : left > 0 ? 'amber' : 'red')],
              actions: [{ label: 'Renew', onClick: () => void saveOrders(orders.map((x) => (x.id === o.id ? { ...x, expires: new Date(Math.max(Date.now(), Date.parse(o.expires) || 0) + 15 * D).toISOString(), status: 'active' } : x)), '🔁 Boost renewed for 15 days') }],
            };
          }),
          empty: orders.length ? '' : tc.q.isError ? 'Unavailable' : 'No boost orders recorded',
        },
        {
          title: 'Interior Design Packages',
          rows: pkgs.map((p) => ({ key: p.id, title: p.name, sub: (p.priceRange || '—') + ' · ' + (p.timeline || '—'), actions: [{ label: 'Delete', variant: 'red' as const, onClick: () => askConfirm({ title: 'Delete ' + p.name + '?', confirmLabel: 'Delete', tone: 'destructive', onConfirm: () => saveTools({ interiorPackages: pkgs.filter((x) => x.id !== p.id) }, 'Package deleted') }) }] })),
          empty: pkgs.length ? '' : 'No interior packages yet',
          form: [f.inp('ip.n', 'Package'), f.inp('ip.r', 'Price range', { placeholder: '₹8L – ₹15L' }), f.inp('ip.t', 'Timeline', { placeholder: '6 weeks' })],
          actions: [
            btn('+ Add package', () => {
              if (!f.need({ 'ip.n': 'Package is required', 'ip.r': 'Price range is required' })) return;
              void saveTools({ interiorPackages: [...pkgs, { id: uid('IP'), name: f.str('ip.n').trim(), priceRange: f.str('ip.r').trim(), timeline: f.str('ip.t').trim() || '—', active: true }] }, '✅ Package added').then((ok) => ok && f.clear('ip.'));
            }, 'primary', { loading: st.save.isPending, disabled: settingsDenied }),
          ],
        },
        {
          title: 'Interior Designers',
          rows: des.designers.map((d) => ({
            key: d.id,
            title: d.name,
            sub: [d.specialization.join(', ') || d.assignedArea.join(', ') || 'General', d.phone].filter(Boolean).join(' · '),
            badges: [badge(d.isAvailable ? 'Available' : 'Unavailable', d.isAvailable ? 'green' : 'muted')],
            actions: [
              { label: 'Availability', onClick: () => setAvail.mutate({ id: d.id, on: !d.isAvailable }, { onSuccess: () => toast(d.name + (d.isAvailable ? ' marked unavailable' : ' marked available')) }) },
              { label: 'Remove', variant: 'red' as const, onClick: () => askConfirm({ title: 'Remove designer?', message: d.name + ' will lose dashboard access.', confirmLabel: 'Remove', tone: 'destructive', onConfirm: () => delDesigner.mutateAsync(d.id).then(() => toast('Designer removed')) }) },
            ],
          })),
          empty: des.designers.length ? '' : des.isPending ? 'Loading…' : des.isError ? 'Could not load designers' : 'No designers yet',
          form: [f.inp('ds.n', 'Name'), f.inp('ds.p', 'Phone'), f.inp('ds.e', 'Email'), f.inp('ds.s', 'Specialization')],
          actions: [
            btn('+ Add Designer', () => {
              if (!f.need({ 'ds.n': 'Name is required', 'ds.p': 'Phone is required', 'ds.e': 'Email is required' })) return;
              if (!/^\S+@\S+\.\S+$/.test(f.str('ds.e').trim())) return void f.fail('ds.e', 'Enter a valid email');
              const spec = f.str('ds.s').trim() || 'General';
              addDesigner.mutate(
                { name: f.str('ds.n').trim(), phone: f.str('ds.p').trim(), email: f.str('ds.e').trim().toLowerCase(), role: 'designer', assignedArea: [spec], specialization: [spec], isAvailable: true },
                { onSuccess: () => { f.clear('ds.'); toast('✅ Designer added'); } },
              );
            }, 'primary', { loading: addDesigner.isPending }),
          ],
        },
        {
          title: 'Coupon Codes',
          rows: coupons.map((c) => ({
            key: c.id,
            title: c.code,
            sub: (c.type === '% discount' ? c.discount + ' discount' : 'Flat ' + c.discount) + ' · ' + c.appliesTo + ' · ' + (c.uses || '0') + ' uses · Expires ' + (c.expiry ? date(c.expiry) : '—'),
            badges: [badge(c.active ? 'Active' : 'Inactive', c.active ? 'green' : 'muted')],
            actions: [{ label: 'Delete', variant: 'red' as const, onClick: () => askConfirm({ title: 'Delete coupon ' + c.code + '?', confirmLabel: 'Delete', tone: 'destructive', onConfirm: () => saveTools({ coupons: coupons.filter((x) => x.id !== c.id) }, 'Coupon deleted: ' + c.code) }) }],
          })),
          empty: coupons.length ? '' : 'No coupon codes yet.',
          form: [
            f.inp('cp.code', 'CODE'),
            f.inp('cp.t', 'Type', { type: 'select', options: ['% discount', 'Flat ₹'], default: '% discount' }),
            f.inp('cp.v', 'Value', { type: 'number' }),
            f.inp('cp.a', 'Applies to', { type: 'select', options: ['Boost', 'Interior', 'Both'], default: 'Both' }),
            f.inp('cp.m', 'Max uses', { type: 'number' }),
            f.inp('cp.e', 'Expiry', { type: 'date', min: todayIso() }),
          ],
          actions: [
            btn('Create coupon', () => {
              if (!f.need({ 'cp.code': 'Code is required', 'cp.v': 'Value is required', 'cp.e': 'Expiry is required' })) return;
              const code = f.str('cp.code').trim().toUpperCase();
              if (!/^[A-Z0-9]{4,12}$/.test(code)) return void f.fail('cp.code', '4–12 letters or digits');
              if (coupons.some((x) => x.code === code)) return void f.fail('cp.code', 'Code already exists');
              const pct = f.str('cp.t', '% discount') === '% discount';
              const value = Number(f.str('cp.v'));
              if (!(value > 0)) return void f.fail('cp.v', 'Enter a positive value');
              if (pct && value > 100) return void f.fail('cp.v', 'Max 100%');
              const coupon: Coupon = {
                id: uid('CP'), code, discount: pct ? value + '%' : '₹' + num(value), type: pct ? '% discount' : 'Flat discount', appliesTo: f.str('cp.a', 'Both'),
                uses: '0/' + (Number(f.str('cp.m')) || 100), expiry: f.str('cp.e'), active: true,
              };
              void saveTools({ coupons: [...coupons, coupon] }, '🎟 Coupon ' + code + ' created').then((ok) => ok && f.clear('cp.'));
            }, 'primary', { loading: st.save.isPending, disabled: settingsDenied }),
          ],
        },
      ]}
    >
      {modal.element}
    </RecordDetailView>
  );
}
