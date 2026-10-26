import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useViewport } from '../../../hooks/useViewport';
import { formatApiError } from '../../../lib/apiClient';
import { typeLabel } from '../../../lib/format';
import { createProperty } from '../../../services/properties';
import { toast } from '../../../store/uiStore';
import type { PropertyPayload } from '../../../types/properties';
import { AMENITIES, FILTER_TYPES, SPECS, specKey, specParts } from '../constants';
import { useProperties } from '../hooks/useProperties';
import styles from './Properties.module.css';

interface FieldDef {
  k: string;
  label: string;
  required?: boolean;
  type?: string;
  options?: string[];
  area?: boolean;
  check?: boolean;
  checkLabel?: string;
  placeholder?: string;
  full?: boolean;
}

const URL_KEYS = ['photo1', 'video', 'droneImg', 'droneVid', 'tour', 'floor'];
const STATE_OF: Record<string, string> = { Chennai: 'Tamil Nadu', Bengaluru: 'Karnataka' };
const NUMERIC = /(Area|Count|Floors?|Number of|Bedrooms|Bathrooms|Slots|Width|Height|Washrooms|\(₹\)|%|months|km|acres|weeks|Plots in Layout)/;

export function AddProperty() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { vw } = useViewport();
  const props = useProperties();
  const [type, setType] = useState('');
  const [form, setForm] = useState<Record<string, string | boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [amen, setAmen] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<'' | 'draft' | 'publish'>('');

  const v = (k: string) => String(form[k] ?? '');
  const set = (k: string, val: string | boolean) => {
    setForm((s) => ({ ...s, [k]: val }));
    setErrors((s) => ({ ...s, [k]: '' }));
    setFormError('');
  };

  const specDefs = (SPECS[type] || []).map((d) => {
    const [label, options, required, placeholder] = specParts(d);
    return { k: 'spec.' + specKey(label), label, options: options || undefined, required: !!required, placeholder: placeholder || '' } as FieldDef;
  });
  const title = v('title').trim();
  const dup = title.length > 6 ? (props.data?.items ?? []).find((p) => !p.isDeleted && p.title.toLowerCase() === title.toLowerCase()) : null;

  const sections: Array<{ title: string; note?: string; fields: FieldDef[]; empty?: boolean; chips?: boolean }> = [
    {
      title: 'Section 1: Basic Info',
      fields: [
        { k: 'pid', label: 'Property ID', placeholder: 'Auto-generated if blank' },
        { k: 'title', label: 'Property Title', required: true, placeholder: 'e.g. 3 BHK Apartment in OMR' },
        { k: 'price', label: 'Price (₹)', required: true, type: 'number', placeholder: 'e.g. 8500000' },
        { k: 'negotiable', label: 'Negotiable', check: true, checkLabel: 'Price is negotiable' },
        { k: 'description', label: 'Description', area: true, full: true, placeholder: 'Describe the property' },
        { k: 'txn', label: 'Transaction Type', options: ['New', 'Resale'] },
        { k: 'possession', label: 'Possession', options: ['Ready to Move', 'Specific date'] },
        ...(v('possession') === 'Specific date' ? [{ k: 'possDate', label: 'Possession date', placeholder: 'e.g. December 2026' }] : []),
      ],
    },
    {
      title: 'Section 2: Location',
      fields: [
        { k: 'address', label: 'Address', full: true },
        { k: 'locality', label: 'Locality', required: true },
        { k: 'city', label: 'City', options: ['Chennai', 'Bengaluru'], required: true },
        { k: 'state', label: 'State', options: ['Tamil Nadu', 'Karnataka'] },
        { k: 'pincode', label: 'Pincode' },
        { k: 'lat', label: 'Latitude (optional)' },
        { k: 'lng', label: 'Longitude (optional)' },
      ],
    },
    { title: 'Section 3: Specifications', fields: specDefs, empty: specDefs.length === 0 },
    { title: 'Section 4: Amenities', fields: [], chips: true },
    {
      title: 'Section 5: Media & Virtual Tour',
      note: 'Optional for all types; recommended for NRI properties.',
      fields: [
        { k: 'photo1', label: 'Photo URL', placeholder: 'https://…', full: true },
        { k: 'video', label: 'Video Walkthrough URL', placeholder: 'https://…' },
        { k: 'droneImg', label: 'Aerial / Drone Image URL', placeholder: 'https://…' },
        { k: 'droneVid', label: 'Aerial / Drone Video URL', placeholder: 'https://…' },
        { k: 'tour', label: '3D / VR Tour URL', placeholder: 'https://my.matterport.com/show/?m=...' },
        { k: 'floor', label: 'Floor Plan URL', placeholder: 'https://…' },
      ],
    },
    {
      title: 'Section 6: Pricing Details',
      fields: [
        { k: 'psf', label: 'Sale Price per sqft (₹)', type: 'number' },
        { k: 'maint', label: 'Maintenance (₹/month)', type: 'number' },
        { k: 'booking', label: 'Booking Amount (₹)', type: 'number' },
      ],
    },
    {
      title: 'Section 7: Settings',
      fields: [
        { k: 'status', label: 'Property Status', options: ['Available', 'Under Construction', 'Reserved'] },
        { k: 'featured', label: 'Featured', check: true, checkLabel: '⭐ Mark as Featured' },
        { k: 'upcoming', label: 'Upcoming', check: true, checkLabel: '🕐 Mark as Upcoming' },
        ...(form.upcoming ? [{ k: 'launch', label: 'Launch Date', type: 'date', required: true }] : []),
      ],
    },
  ];

  const save = async (asDraft: boolean) => {
    const e: Record<string, string> = {};
    if (!title) e.title = 'Property title is required';
    // The create endpoint requires a positive price for every record, drafts included.
    if (!(Number(v('price')) > 0)) e.price = asDraft ? 'Price is required (the server needs a price even for drafts)' : 'Price is required to publish';
    if (!asDraft && !v('locality').trim()) e.locality = 'Locality is required';
    if (!asDraft && !v('city')) e.city = 'City is required';
    if (type === 'plot' && !asDraft && !v('spec.plotArea').trim()) e['spec.plotArea'] = 'Plot area (sqft) is required for plots.';
    if (form.upcoming && !v('launch')) e.launch = 'Launch date is required for upcoming properties';
    if (v('pincode') && !/^\d{6}$/.test(v('pincode'))) e.pincode = 'Pincode must be 6 digits';
    if (v('lat') && !Number.isFinite(Number(v('lat')))) e.lat = 'Latitude must be a number';
    if (v('lng') && !Number.isFinite(Number(v('lng')))) e.lng = 'Longitude must be a number';
    URL_KEYS.forEach((k) => {
      if (v(k) && !/^https:\/\//.test(v(k))) e[k] = 'URL must start with https://';
    });
    const fe = form.featured && form.upcoming ? 'Cannot be featured AND upcoming — pick one before saving.' : '';
    if (Object.keys(e).length || fe) {
      setErrors(e);
      setFormError(fe || 'Please fix the highlighted fields.');
      return;
    }

    const specs: Record<string, unknown> = {};
    specDefs.forEach((d) => {
      const raw = v(d.k).trim();
      if (!raw) return;
      const key = d.k.slice(5);
      specs[key] = !d.options && NUMERIC.test(d.label) && Number.isFinite(Number(raw)) ? Number(raw) : raw === 'Yes' ? true : raw === 'No' ? false : raw;
    });
    if (v('pid').trim()) specs.externalReferenceId = v('pid').trim();
    if (v('txn')) specs.transactionType = v('txn');
    if (v('possession')) specs.possession = v('possession') === 'Specific date' ? v('possDate').trim() || 'Specific date' : v('possession');
    if (Number(v('psf')) > 0) specs.pricePerSqft = Number(v('psf'));
    if (Number(v('maint')) > 0) specs.maintenancePerMonth = Number(v('maint'));
    if (Number(v('booking')) > 0) specs.bookingAmount = Number(v('booking'));

    const city = v('city');
    const media: Record<string, unknown> = {};
    if (v('photo1')) {
      media.photos = [v('photo1')];
      media.coverPhoto = v('photo1');
    }
    if (v('video')) media.videoUrl = v('video');
    if (v('droneImg')) media.droneImageUrl = v('droneImg');
    if (v('droneVid')) media.droneVideoUrl = v('droneVid');
    if (v('tour')) media.tour3dUrl = v('tour');
    if (v('floor')) media.floorPlanUrl = v('floor');

    const st = v('status');
    const body: PropertyPayload & { title: string; type: string; price: number } = {
      title,
      type,
      price: Number(v('price')),
      description: v('description') || null,
      status: asDraft ? 'draft' : st === 'Under Construction' ? 'under_construction' : st === 'Reserved' ? 'reserved' : 'available',
      source: 'manual',
      isVisibleOnApp: !asDraft,
      isNegotiable: !!form.negotiable,
      isFeatured: !!form.featured,
      isUpcoming: !!form.upcoming,
      launchDate: form.upcoming ? v('launch') : null,
      address: {
        line1: v('address') || null,
        locality: v('locality') || null,
        city: city || null,
        state: v('state') || STATE_OF[city] || null,
        pincode: v('pincode') || null,
        ...(v('lat') ? { latitude: Number(v('lat')) } : {}),
        ...(v('lng') ? { longitude: Number(v('lng')) } : {}),
      },
      specs,
      amenities: Object.keys(amen).filter((k) => amen[k]),
      media,
    };
    setSaving(asDraft ? 'draft' : 'publish');
    try {
      const created = await createProperty(body);
      void qc.invalidateQueries({ queryKey: ['properties'] });
      void qc.invalidateQueries({ queryKey: ['overview'] });
      setForm({});
      setErrors({});
      setFormError('');
      setType('');
      setAmen({});
      toast(asDraft ? '💾 Saved as draft — ⚠️ Draft — not visible on app' : '✅ Property published');
      navigate('/admin/properties/' + created.id);
    } catch (err) {
      setFormError(formatApiError(err));
    } finally {
      setSaving('');
    }
  };

  const renderField = (f: FieldDef) => {
    const err = errors[f.k] || '';
    const border = err ? '#ef4444' : '#e2e8f0';
    return (
      <label key={f.k} className={styles.field} style={{ gridColumn: f.full ? '1 / -1' : 'auto' }}>
        <span>
          {f.label}
          {f.required && <span className={styles.req}> *</span>}
        </span>
        {f.check ? (
          <span className={styles.check}>
            <input type="checkbox" checked={!!form[f.k]} onChange={() => set(f.k, !form[f.k])} />
            {f.checkLabel || f.label}
          </span>
        ) : f.options ? (
          <select className={styles.select} style={{ borderColor: border }} value={v(f.k)} onChange={(e) => set(f.k, e.target.value)}>
            <option value="">Select…</option>
            {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        ) : f.area ? (
          <textarea className={styles.textarea} rows={3} value={v(f.k)} onChange={(e) => set(f.k, e.target.value)} placeholder={f.placeholder} />
        ) : (
          <input className={styles.input} style={{ borderColor: border }} type={f.type || 'text'} value={v(f.k)} onChange={(e) => set(f.k, e.target.value)} placeholder={f.placeholder} />
        )}
        {err && <span className={styles.fieldErr}>{err}</span>}
      </label>
    );
  };

  return (
    <div className={styles.narrow}>
      <div>
        <h2 className="bg-sr-only">Add Property</h2>
        <p className={styles.lead}>Choose a property type to load its fields</p>
      </div>
      <div className={styles.panel}>
        <p className={styles.panelTitle} style={{ marginBottom: 12 }}>Property type</p>
        <div className={styles.typeGrid}>
          {FILTER_TYPES.filter(([k]) => k !== 'villa').map(([k, label]) => (
            <button
              key={k}
              type="button"
              className={styles.typeBtn}
              aria-pressed={type === k}
              style={{ borderColor: type === k ? '#2563eb' : '#e2e8f0', background: type === k ? '#eff6ff' : '#ffffff', color: type === k ? '#1d4ed8' : '#0f172a' }}
              onClick={() => {
                setType(k);
                setErrors({});
                setFormError('');
              }}
            >
              {label}
            </button>
          ))}
        </div>
        {type && (
          <p className={styles.selected}>
            Selected type: <strong>{typeLabel(type)}</strong>
          </p>
        )}
        {dup && (
          <div className={styles.dup}>
            {'⚠️ A property with a similar title already exists: ' + dup.title}
            <button type="button" onClick={() => navigate('/admin/properties/' + dup.id)}>View existing</button>
          </div>
        )}
      </div>
      {type && (
        <>
          {sections.map((sec) => (
            <div key={sec.title} className={styles.panel}>
              <p className={styles.panelTitle}>{sec.title}</p>
              {sec.note && <p className={styles.panelNote}>{sec.note}</p>}
              {sec.empty && <p style={{ marginTop: 12, fontSize: 14, color: '#64748b' }}>No additional specification fields for this type.</p>}
              {sec.fields.length > 0 && (
                <div className={styles.fieldGrid} style={{ gridTemplateColumns: vw >= 768 ? 'repeat(2, minmax(0, 1fr))' : 'minmax(0, 1fr)' }}>
                  {sec.fields.map(renderField)}
                </div>
              )}
              {sec.chips && (
                <div className={styles.chips}>
                  {AMENITIES.map((a) => {
                    const on = !!amen[a];
                    return (
                      <button
                        key={a}
                        type="button"
                        className={styles.chip}
                        aria-pressed={on}
                        style={{ borderColor: on ? '#2563eb' : '#e2e8f0', background: on ? '#eff6ff' : '#ffffff', color: on ? '#1d4ed8' : '#334155' }}
                        onClick={() => setAmen((s) => ({ ...s, [a]: !s[a] }))}
                      >
                        {a}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
          {formError && <div className={styles.formError} role="alert">{formError}</div>}
          <div className={styles.sticky}>
            <button type="button" className={styles.btnOutline} onClick={() => navigate('/admin/properties/all')}>Cancel</button>
            <button type="button" className={styles.btnOutline} disabled={!!saving} onClick={() => void save(true)}>
              {saving === 'draft' ? 'Saving…' : 'Save as Draft'}
            </button>
            <button type="button" className={styles.btnPrimary} disabled={!!saving} onClick={() => void save(false)}>
              {saving === 'publish' ? 'Publishing…' : 'Publish'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
