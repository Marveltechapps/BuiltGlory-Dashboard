import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Icon } from '../../../components/ui/Icon';
import { Skeleton } from '../../../components/ui/Skeleton';
import { PageStack } from '../../../components/ui/ListHeader';
import { formatApiError, saveBlob } from '../../../lib/apiClient';
import { matches } from '../../../components/tables/listState';
import { writeWorkbook } from '../../../lib/xlsx';
import { createProperty, getBulkTemplate, updateProperty, updatePropertyStatus } from '../../../services/properties';
import { toast } from '../../../store/uiStore';
import type { PropertyPayload } from '../../../types/properties';
import { FILTER_TYPES } from '../constants';
import styles from './Properties.module.css';

type Mode = 'empty' | 'valued';
type TplRow = Record<string, string | number | boolean>;

const COLS = ['Property ID', 'Title', 'Type', 'Price (₹)', 'Locality', 'City', 'Status', 'Row status'];
const KEYS = ['title', 'type', 'price', 'locality', 'city', 'status'] as const;
const STATUSES = ['available', 'sold', 'reserved', 'under_construction', 'draft'];
const TYPES = new Set(FILTER_TYPES.map(([k]) => k));
const SAMPLE: TplRow = { __sample: true };

const s = (v: unknown) => (v == null ? '' : String(v));
const rowId = (r: TplRow, i: number) => s(r.propertyId) || s(r.referenceId) || (r.__sample ? 'SAMPLE-1' : 'ROW-' + (i + 1));

type Vals = Record<(typeof KEYS)[number], string>;

function validate(v: Vals) {
  if (!v.title.trim()) return 'Title is required';
  if (!TYPES.has(v.type)) return 'Type must be one of: ' + [...TYPES].join(', ');
  if (!(Number(v.price) > 0)) return 'Price must be positive';
  if (v.status && !STATUSES.includes(v.status)) return 'Status must be one of: ' + STATUSES.join(', ');
  return '';
}

export function PropertyTemplates() {
  const qc = useQueryClient();
  const [mode, setMode] = useState<Mode>('valued');
  const [q, setQ] = useState('');
  const [typeF, setTypeF] = useState('all');
  const [edits, setEdits] = useState<Record<string, Record<string, string>>>({});
  const [rowMsg, setRowMsg] = useState<Record<string, { text: string; ok: boolean }>>({});
  const [saving, setSaving] = useState(false);
  const tq = useQuery({ queryKey: ['property-template', mode], queryFn: () => getBulkTemplate(mode, 100) });

  const data = tq.data;
  const baseRows: TplRow[] = mode === 'empty' ? (data?.rows.length ? data.rows : [SAMPLE]) : data?.rows ?? [];
  const rows = mode === 'empty' ? baseRows : baseRows.filter((r) => (typeF === 'all' || s(r.type) === typeF) && matches(q, s(r.title) + ' ' + s(r.locality) + ' ' + s(r.city)));
  const dirtyIds = Object.keys(edits);
  const valueOf = (r: TplRow, id: string, k: string) => edits[id]?.[k] ?? s(r[k]);

  const switchMode = (m: Mode) => {
    setMode(m);
    setEdits({});
    setRowMsg({});
  };

  const save = async () => {
    if (!dirtyIds.length || saving) return;
    setSaving(true);
    const msgs: Record<string, { text: string; ok: boolean }> = {};
    const still: Record<string, Record<string, string>> = {};
    for (const [i, r] of baseRows.entries()) {
      const id = rowId(r, i);
      if (!edits[id]) continue;
      const v = Object.fromEntries(KEYS.map((k) => [k, valueOf(r, id, k).trim()])) as Vals;
      const err = validate(v);
      if (err) {
        msgs[id] = { text: err, ok: false };
        still[id] = edits[id]!;
        continue;
      }
      const pin = s(r.pincode).trim();
      const address: NonNullable<PropertyPayload['address']> = {
        line1: s(r.address) || null, line2: s(r.line2) || null, landmark: s(r.landmark) || null, state: s(r.state) || null,
        locality: v.locality || null, city: v.city || null, ...(/^\d{6}$/.test(pin) ? { pincode: pin } : {}),
      };
      try {
        const propertyId = s(r.propertyId);
        if (propertyId) {
          await updateProperty(propertyId, { title: v.title, type: v.type, price: Number(v.price), address });
          if (v.status && v.status !== s(r.status)) await updatePropertyStatus(propertyId, { status: v.status as 'available' });
        } else {
          await createProperty({ title: v.title, type: v.type, price: Number(v.price), address, source: 'manual', ...(v.status ? { status: v.status as 'available' } : {}) });
        }
        msgs[id] = { text: 'Saved ✓', ok: true };
      } catch (e) {
        msgs[id] = { text: formatApiError(e), ok: false };
        still[id] = edits[id]!;
      }
    }
    const savedCount = Object.values(msgs).filter((m) => m.ok).length;
    setEdits(still);
    setRowMsg(msgs);
    setSaving(false);
    if (savedCount) {
      toast('✅ ' + savedCount + ' rows saved');
      void qc.invalidateQueries({ queryKey: ['properties'] });
      void qc.invalidateQueries({ queryKey: ['property-template'] });
    }
    if (Object.keys(still).length) toast('⚠️ ' + Object.keys(still).length + ' rows could not be saved');
  };

  const download = () => {
    const keys = data?.fields.map((f) => f.key).filter(Boolean) ?? [];
    if (!keys.length) return toast('Template is not loaded yet');
    const body = baseRows.filter((r) => !r.__sample).map((r, i) => keys.map((k) => {
      const id = rowId(r, i);
      const v = edits[id]?.[k] ?? r[k];
      return v as string | number | boolean | undefined;
    }));
    saveBlob(writeWorkbook([{ name: 'Properties', rows: [keys, ...body] }]), mode === 'empty' ? 'Builtglory_Master_Sheet_Template.xlsx' : 'Builtglory_Master_Sheet.xlsx');
    toast('📥 Downloading ' + (mode === 'empty' ? 'Builtglory_Master_Sheet_Template.xlsx' : 'Builtglory_Master_Sheet.xlsx'));
  };

  return (
    <PageStack>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h2 className={styles.h2}>Property Templates</h2>
          <p className={styles.lead}>Edit the master sheet template inline</p>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <div className={styles.modeToggle}>
            {(['empty', 'valued'] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                className={styles.modeBtn}
                aria-pressed={mode === m}
                style={{ background: mode === m ? '#2563eb' : '#ffffff', color: mode === m ? '#ffffff' : '#334155' }}
                onClick={() => switchMode(m)}
              >
                {m === 'empty' ? 'Empty template' : 'Valued template'}
              </button>
            ))}
          </div>
          <input type="search" className={styles.tplSearch} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter sheet..." aria-label="Filter sheet" />
          <select className={styles.hSelect} value={typeF} onChange={(e) => setTypeF(e.target.value)} aria-label="Type">
            <option value="all">All Types</option>
            {FILTER_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <button type="button" className={styles.saveBtn} style={{ opacity: dirtyIds.length && !saving ? 1 : 0.5 }} onClick={() => void save()} disabled={saving}>
            {saving ? 'Saving…' : dirtyIds.length ? 'Save Changes (' + dirtyIds.length + ')' : 'Save Changes'}
          </button>
          <button type="button" className={styles.iconBtn} title="Refresh" aria-label="Refresh" onClick={() => void tq.refetch().then(() => toast('Refreshed'))}>
            <Icon name="refresh-cw" size={16} spin={tq.isFetching} />
          </button>
          <button type="button" className={styles.iconBtn} title="Download" aria-label="Download" onClick={download}>
            <Icon name="download" size={16} />
          </button>
        </div>
      </div>
      <div className={styles.sheet}>
        <table className={styles.sheetTable}>
          <thead>
            <tr className={styles.sheetHead}>
              {COLS.map((c) => <th key={c} className={styles.sheetTh}>{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {tq.isPending && [0, 1, 2, 3].map((i) => (
              <tr key={i}>{COLS.map((c) => <td key={c} className={styles.sheetTd} style={{ padding: 10 }}><Skeleton style={{ height: 12, width: '70%', borderRadius: 6 }} /></td>)}</tr>
            ))}
            {tq.isError && (
              <tr>
                <td colSpan={8} className={styles.sheetEmpty}>
                  {'Could not load the template. '}
                  <button type="button" className={styles.linkBtn} onClick={() => void tq.refetch()}>Retry</button>
                </td>
              </tr>
            )}
            {!tq.isPending && !tq.isError && rows.length === 0 && (
              <tr><td colSpan={8} className={styles.sheetEmpty}>No properties found for the valued template.</td></tr>
            )}
            {!tq.isPending && !tq.isError && rows.map((r) => {
              const i = baseRows.indexOf(r);
              const id = rowId(r, i);
              const dirty = !!edits[id];
              const msg = dirty ? { text: 'Unsaved changes', ok: true } : rowMsg[id];
              return (
                <tr key={id} style={{ background: dirty ? '#fffbeb' : '#ffffff' }}>
                  <td className={styles.sheetId}>{s(r.referenceId) || id}</td>
                  {KEYS.map((k) => (
                    <td key={k} className={styles.sheetTd}>
                      <input
                        className={styles.sheetInput}
                        value={valueOf(r, id, k)}
                        placeholder={r.__sample ? k : ''}
                        aria-label={k + ' for ' + id}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEdits((st) => ({ ...st, [id]: { ...(st[id] || {}), [k]: val } }));
                        }}
                      />
                    </td>
                  ))}
                  <td className={styles.sheetMsg} style={{ color: dirty ? '#b45309' : msg?.ok ? '#15803d' : '#dc2626' }}>{msg?.text || ''}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {mode === 'empty' && <p className={styles.note}>Replace this sample row with real property details</p>}
    </PageStack>
  );
}
