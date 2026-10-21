import { apiRequest } from '../../lib/apiClient';
import { arr, asRaw, iso, num, str, strArr, type Raw } from '../../lib/raw';
import type { AdminSettings, AdminSettingsPatch } from '../../types/settings';

const flags = (v: unknown) => Object.fromEntries(Object.entries(asRaw(v)).map(([k, x]) => [k, x === true]));

export function mapSettings(raw: Raw): AdminSettings {
  const o = asRaw(raw.organization);
  const a = asRaw(raw.app);
  const s = asRaw(raw.sla);
  const al = asRaw(raw.alerts);
  const n = asRaw(raw.notifications);
  const c = asRaw(n.contact);
  const d = asRaw(raw.display);
  const tl = asRaw(raw.tools);
  return {
    organization: { name: str(o.name), tagline: str(o.tagline), email: str(o.email), phone: str(o.phone), address: str(o.address), city: str(o.city), state: str(o.state), pincode: str(o.pincode) },
    app: {
      maintenance: a.maintenance === true, registration: a.registration !== false, kycRequired: a.kycRequired === true, showPrices: a.showPrices !== false,
      virtualTours: a.virtualTours !== false, stagePayment: a.stagePayment !== false, interior: a.interior !== false,
    },
    sla: {
      interiorHours: num(s.interiorHours) ?? 24, stagePaymentHours: num(s.stagePaymentHours) ?? 48, enquiryHours: num(s.enquiryHours) ?? 24,
      autoEscalate: s.autoEscalate !== false, escalateToAdminId: str(s.escalateToAdminId) || null, escalateToName: str(s.escalateToName),
    },
    alerts: { triggers: flags(al.triggers), email: str(al.email), whatsapp: str(al.whatsapp) },
    notifications: { contact: { phone: str(c.phone), email: str(c.email), ccEmail: str(c.ccEmail) }, email: flags(n.email), whatsapp: flags(n.whatsapp) },
    display: { timezone: str(d.timezone, 'IST'), dateFormat: str(d.dateFormat, 'DD MMM YYYY'), currencyFormat: str(d.currencyFormat, 'indian') },
    tools: {
      boostPlans: arr(tl.boostPlans).map((x) => {
        const b = asRaw(x);
        return { id: str(b.id), name: str(b.name), priceLabel: str(b.priceLabel), description: str(b.description), benefits: strArr(b.benefits), active: b.active !== false };
      }),
      interiorPackages: arr(tl.interiorPackages).map((x) => {
        const b = asRaw(x);
        return { id: str(b.id), name: str(b.name), priceRange: str(b.priceRange), timeline: str(b.timeline), active: b.active !== false };
      }),
      coupons: arr(tl.coupons).map((x) => {
        const b = asRaw(x);
        return { id: str(b.id), code: str(b.code), discount: str(b.discount), type: str(b.type) === 'Flat discount' ? 'Flat discount' : '% discount', appliesTo: str(b.appliesTo), uses: str(b.uses), expiry: str(b.expiry), active: b.active !== false };
      }),
    },
    updatedAt: iso(raw.updatedAt),
  };
}

/** GET /api/v1/admin/settings */
export async function getSettings(signal?: AbortSignal) {
  return mapSettings(asRaw(await apiRequest<Raw>('/v1/admin/settings', { signal })));
}

/** PATCH /api/v1/admin/settings */
export async function updateSettings(body: AdminSettingsPatch) {
  return mapSettings(asRaw(await apiRequest<Raw>('/v1/admin/settings', { method: 'PATCH', body })));
}
