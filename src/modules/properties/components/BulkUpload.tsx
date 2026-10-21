import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DataTable, type Row } from '../../../components/tables/DataTable';
import { Icon } from '../../../components/ui/Icon';
import { formatApiError, saveBlob } from '../../../lib/apiClient';
import { badge, price, typeLabel } from '../../../lib/format';
import { readWorkbook, writeWorkbook } from '../../../lib/xlsx';
import { bulkUploadProperties, getBulkTemplate } from '../../../services/properties';
import { toast } from '../../../store/uiStore';
import type { ImportJob } from '../../../types/properties';
import { BULK_REQUIRED, FILTER_TYPES, SHEETS, SHEET_TYPE } from '../constants';
import styles from './Properties.module.css';

interface PreviewRow {
  sheet: string;
  row: number;
  pid: string;
  title: string;
  type: string;
  loc: string;
  city: string;
  price: number;
  error: string;
}

type Phase = 'idle' | 'parsing' | 'parsed' | 'done';

const KNOWN_TYPES = new Set(FILTER_TYPES.map(([k]) => k));
const normType = (v: string) => v.trim().toLowerCase().replace(/[\s-]+/g, '_');
const MAX_BYTES = 10 * 1024 * 1024;

/** Client-side pre-check (same required columns as the template grid); the server remains the final validator. */
function precheck(r: Record<string, string>, type: string) {
  const missing = BULK_REQUIRED.filter((k) => !(k === 'type' ? type : String(r[k] ?? '').trim()));
  if (missing.length) return missing[0] + ' is required';
  if (!KNOWN_TYPES.has(type)) return 'property type is not supported';
  if (!/^\d{6}$/.test(String(r.pincode ?? '').trim())) return 'pincode must contain 6 digits';
  if (!(Number(r.price) > 0)) return 'price must be positive';
  return '';
}

export function BulkUpload() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [sheet, setSheet] = useState('Plot');
  const [drag, setDrag] = useState(false);
  const [importing, setImporting] = useState(false);
  const [tplBusy, setTplBusy] = useState(false);
  const [rejected, setRejected] = useState<{ count: number; errors: Array<{ row: number; field: string; message: string }> } | null>(null);
  const [job, setJob] = useState<{ accepted: number; rejected: number; job: ImportJob | null } | null>(null);

  const reset = () => {
    setPhase('idle');
    setFile(null);
    setRows([]);
    setSheet('Plot');
    setRejected(null);
    setJob(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const browse = () => fileRef.current?.click();

  const parse = async (f: File) => {
    if (!/\.xlsx$/i.test(f.name)) return toast('Only .xlsx files are accepted');
    if (f.size > MAX_BYTES) return toast('File is larger than 10MB');
    setFile(f);
    setRejected(null);
    setPhase('parsing');
    try {
      const book = await readWorkbook(f);
      const out: PreviewRow[] = [];
      Object.entries(book).forEach(([sheetName, list]) => {
        list.forEach((r, i) => {
          const type = normType(String(r.type ?? '')) || SHEET_TYPE[sheetName] || '';
          out.push({
            sheet: sheetName,
            row: i + 2,
            pid: String(r.referenceId || r.propertyId || r.id || '').trim() || 'ROW-' + (i + 2),
            title: String(r.title ?? '').trim() || 'Untitled property',
            type,
            loc: String(r.locality ?? '').trim(),
            city: String(r.city ?? '').trim(),
            price: Number(r.price) || 0,
            error: precheck(r, type),
          });
        });
      });
      setRows(out);
      const first = SHEETS.find((s) => out.some((r) => r.type === SHEET_TYPE[s]));
      setSheet(first || 'Plot');
      setPhase('parsed');
    } catch (e) {
      toast('⚠️ Could not read ' + f.name + ': ' + (e instanceof Error ? e.message : 'invalid workbook'));
      reset();
    }
  };

  const downloadTemplate = async () => {
    setTplBusy(true);
    try {
      const t = await getBulkTemplate('empty');
      const keys = t.fields.map((x) => x.key).filter(Boolean);
      if (!keys.length) return toast('The server returned an empty template');
      const body = t.rows.map((r) => keys.map((k) => r[k] as string | number | boolean | undefined));
      saveBlob(writeWorkbook([{ name: 'Properties', rows: [keys, ...body] }]), 'Builtglory_Master_Sheet_Template.xlsx');
      toast('📥 Downloading Builtglory_Master_Sheet_Template.xlsx');
    } catch (e) {
      toast('⚠️ ' + formatApiError(e));
    } finally {
      setTplBusy(false);
    }
  };

  const importNow = async () => {
    if (!file) return;
    setImporting(true);
    setRejected(null);
    try {
      const r = await bulkUploadProperties(file);
      if (!r.valid) {
        setRejected({ count: r.rowsRejected, errors: r.errors });
        toast(`Upload rejected: ${r.rowsRejected} rows have errors. Fix the file and upload again.`);
        return;
      }
      setJob({ accepted: r.rowsAccepted, rejected: r.rowsRejected, job: r.job });
      setPhase('done');
      void qc.invalidateQueries({ queryKey: ['properties'] });
      void qc.invalidateQueries({ queryKey: ['import-jobs'] });
      void qc.invalidateQueries({ queryKey: ['overview'] });
      toast('✅ Imported ' + r.rowsAccepted + ' properties');
    } catch (e) {
      toast('⚠️ ' + formatApiError(e));
    } finally {
      setImporting(false);
    }
  };

  const ok = rows.filter((r) => !r.error);
  const bad = rows.filter((r) => r.error);
  const sheetType = SHEET_TYPE[sheet];
  const sheetRows = rows.filter((r) => r.type === sheetType);
  const other = rows.filter((r) => !Object.values(SHEET_TYPE).includes(r.type));
  const tableRows: Row[] = (sheet === '__other' ? other : sheetRows).map((r) => ({
    key: r.sheet + r.row,
    cells: [
      { title: r.pid, muted: true },
      { title: r.title, strong: true, sub: [r.loc, r.city].filter(Boolean).join(', ') + (r.price ? ' · ' + price(r.price) : '') },
      { title: typeLabel(r.type) || '—' },
      r.error ? { badges: [badge('Rejected', 'red')], sub: r.error } : { badges: [badge('Valid', 'green')] },
    ],
  }));

  return (
    <div className={styles.narrow}>
      <div>
        <h2 className={styles.h2}>Bulk Upload</h2>
        <p className={styles.lead}>Import properties from the Builtglory Master Sheet</p>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="bg-sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void parse(f);
        }}
      />
      {phase === 'idle' && (
        <div
          className={[styles.drop, drag ? styles.dropActive : ''].join(' ')}
          role="button"
          tabIndex={0}
          onClick={browse}
          onKeyDown={(e) => e.key === 'Enter' && browse()}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            const f = e.dataTransfer.files?.[0];
            if (f) void parse(f);
          }}
        >
          <span style={{ display: 'inline-flex', color: '#2563eb' }}><Icon name="file-spreadsheet" size={48} stroke={1.5} /></span>
          <p className={styles.dropTitle}>Drop your Builtglory Master Sheet</p>
          <p className={styles.lead}>All 13 property types in one file</p>
          <p className={styles.dropHint}>Accepts .xlsx · Max 10MB</p>
          <div className={styles.dropActions} onClick={(e) => e.stopPropagation()}>
            <button type="button" className={styles.btnPrimary} onClick={browse}>Browse File</button>
            <button type="button" className={styles.btnOutline} disabled={tplBusy} onClick={() => void downloadTemplate()}>
              <Icon name={tplBusy ? 'loader-2' : 'download'} size={16} spin={tplBusy} />Download Template
            </button>
          </div>
        </div>
      )}
      {phase === 'parsing' && (
        <div className={styles.parsing}><Icon name="loader-2" size={16} spin />{'Reading ' + (file?.name || '') + '…'}</div>
      )}
      {phase === 'parsed' && (
        <>
          <div className={styles.fileBar}>
            <span className={styles.fileName}><Icon name="file-spreadsheet" size={16} />{file?.name}</span>
            <button type="button" className={styles.linkBtn} style={{ fontSize: 13, fontWeight: 400 }} onClick={reset}>Upload Another File</button>
          </div>
          <p style={{ fontWeight: 600 }}>Validation Summary</p>
          <div className={styles.tiles}>
            {[
              { label: 'Accepted Rows', value: ok.length, color: '#15803d' },
              { label: 'Ready to Import', value: ok.length, color: '#2563eb' },
              { label: 'Property Types', value: new Set(rows.map((r) => r.type).filter(Boolean)).size, color: '#0f172a' },
              { label: 'Rejected Rows', value: bad.length, color: '#b91c1c' },
            ].map((t) => (
              <div key={t.label} className={styles.tile}>
                <p className={styles.tileLabel}>{t.label}</p>
                <p className={styles.tileValue} style={{ color: t.color }}>{t.value}</p>
              </div>
            ))}
          </div>
          <p className={styles.note}>Pre-checked in the browser; the server validates every row again when you import.</p>
          <div className={styles.sheetTabs} role="tablist">
            {SHEETS.map((sh) => (
              <button
                key={sh}
                type="button"
                role="tab"
                aria-selected={sheet === sh}
                className={styles.sheetTab}
                style={{ borderBottomColor: sheet === sh ? '#2563eb' : 'transparent', color: sheet === sh ? '#2563eb' : '#64748b' }}
                onClick={() => setSheet(sh)}
              >
                {sh + ' (' + rows.filter((r) => r.type === SHEET_TYPE[sh]).length + ')'}
              </button>
            ))}
            {other.length > 0 && (
              <button
                type="button"
                role="tab"
                aria-selected={sheet === '__other'}
                className={styles.sheetTab}
                style={{ borderBottomColor: sheet === '__other' ? '#2563eb' : 'transparent', color: sheet === '__other' ? '#2563eb' : '#64748b' }}
                onClick={() => setSheet('__other')}
              >
                {'Unrecognised type (' + other.length + ')'}
              </button>
            )}
          </div>
          <DataTable
            columns={['Property ID', 'Title', 'Type', 'Validation']}
            rows={tableRows}
            state={tableRows.length ? 'normal' : 'empty'}
            empty={{ icon: 'file-spreadsheet', title: 'No rows in this sheet', text: 'This sheet was empty in the uploaded file' }}
            minWidth="720px"
          />
          {rejected && (
            <div className={styles.rejected} role="alert">
              <p className={styles.rejectedTitle}>{'❌ Upload rejected — ' + rejected.count + ' rows have errors'}</p>
              <p className={styles.rejectedText}>Fix the file and upload again. Nothing was imported.</p>
              {rejected.errors.length > 0 && (
                <ul style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: '#991b1b' }}>
                  {rejected.errors.slice(0, 50).map((er, i) => (
                    <li key={i}>{'Row ' + er.row + (er.field ? ' · ' + er.field : '') + ': ' + er.message}</li>
                  ))}
                  {rejected.errors.length > 50 && <li>{'…and ' + (rejected.errors.length - 50) + ' more'}</li>}
                </ul>
              )}
            </div>
          )}
          {ok.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" className={styles.importBtn} disabled={importing} onClick={() => void importNow()}>
                {importing && <Icon name="loader-2" size={16} spin />}
                {importing ? 'Validating…' : 'Validate And Import'}
              </button>
            </div>
          )}
        </>
      )}
      {phase === 'done' && job && (
        <div className={styles.done}>
          <p className={styles.doneTitle}>✅ Import Job complete</p>
          <p className={styles.doneText}>
            {job.accepted + ' accepted, ' + job.rejected + ' rejected from ' + (job.job?.fileName || file?.name || 'upload') + (job.job?.referenceId ? ' · Job ' + job.job.referenceId : '')}
          </p>
          <div className={styles.doneActions}>
            <button type="button" className={styles.doneBtn} onClick={() => navigate('/admin/tools/mastersheet')}>View Import Summary</button>
            <button type="button" className={styles.doneBtn} onClick={() => navigate('/admin/properties/all')}>View All Properties</button>
            <button type="button" className={styles.doneBtn} onClick={reset}>Upload Another File</button>
            <button type="button" className={styles.doneGhost} onClick={reset}>Hide Summary</button>
          </div>
        </div>
      )}
    </div>
  );
}
