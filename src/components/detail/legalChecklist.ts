import type { FormModalOptions } from '../ui/FormModal';
import type { FormFields } from '../../hooks/useFormFields';
import { badge, isHttpsUrl } from '../../lib/format';
import { askConfirm, openCompose, toast } from '../../store/uiStore';
import type { DetailAction, SectionSpec } from '../../types/detail';
import type { EntityType } from '../../types/workflow';

export const SELLER_LEGAL: Record<string, string[]> = {
  'Registration Records': ['Sale Deed', 'Mother Deed / Parent Documents', 'Encumbrance Certificate (EC)'],
  'Revenue Records': ['Patta / Khata', 'Chitta & Adangal', 'RTC / Pahani'],
  'Approvals & Planning': ['Building Plan Approval', 'Layout Approval (CMDA / DTCP / BDA)', 'Completion / Occupancy Certificate'],
  'Tax & Utility Records': ['Property Tax Receipts', 'Electricity Bill', 'Water / BWSSB Bill'],
  'Family & Succession Records': ['Legal Heir Certificate', 'Family Tree / Genealogy'],
  'Loan & Encumbrance': ['Loan Closure Letter', 'Bank NOC'],
  'Court Records': ['Litigation Search Report'],
  'Government Acquisition & Restriction Records': ['Land Acquisition Search', 'Government Land Check'],
  'CRZ Records': ['CRZ Clearance'],
  'Environmental Protection Records': ['Environmental Clearance'],
  'Marshy & Water Body Records': ['Water Body Proximity Check'],
  'Mountain & Hill Protection Records': ['Hill Area Clearance'],
};

export const BUYER_LEGAL: Record<string, string[]> = {
  'Sale Agreement & Title': ['Agreement for Sale', 'Title Deed Copy'],
  'Registration & Transfer': ['Registered Sale Deed', 'Khata / Patta Transfer'],
  'Tax & Compliance': ['Stamp Duty Receipt', 'TDS Certificate (Form 16B)'],
  'Utility & Handover': ['Electricity Name Transfer', 'Possession / Handover Letter'],
};

const DOC_ST: Record<string, [string, string]> = {
  missing: ['Missing', 'red'], requested: ['⏳ Awaiting upload from app', 'amber'], pending: ['Pending verification', 'blue'],
  verified: ['✅ Verified', 'green'], rejected: ['❌ Rejected', 'red'], sent: ['📤 Sent to Buyer', 'purple'],
};

export interface DocRecord {
  status: string;
  url?: string;
  fileName?: string;
  rejectionReason?: string;
  updatedAt?: string;
}

/** Persisted shape inside the record's free-form `documentation` object. */
export interface LegalState {
  docs?: Record<string, DocRecord>;
  docsRequired?: Record<string, boolean>;
  customDocs?: Record<string, string[]>;
}

interface LegalOpts {
  mode: 'seller' | 'buyer';
  state: LegalState;
  f: FormFields;
  party: { name: string; phone?: string | null; email?: string | null };
  entity: { type: EntityType; id: string };
  openForm: (o: FormModalOptions) => void;
  save: (patch: LegalState) => Promise<unknown>;
  upload: (file: File, docName: string) => Promise<string>;
}

export function legalSection(o: LegalOpts): SectionSpec & { verified: number; required: number } {
  const base = o.mode === 'buyer' ? BUYER_LEGAL : SELLER_LEGAL;
  const cats: Record<string, string[]> = Object.fromEntries(Object.entries(base).map(([k, v]) => [k, [...v, ...(o.state.customDocs?.[k] ?? [])]]));
  const names = Object.keys(cats);
  const cat = o.f.str('legal.cat', names[0]);
  const all = names.flatMap((n) => cats[n] ?? []);
  const docs = o.state.docs ?? {};
  const statusOf = (n: string) => docs[n]?.status || 'missing';
  const defaultReq = (n: string) => names.indexOf(names.find((k) => (cats[k] ?? []).includes(n)) ?? '') < 4;
  const req = (n: string) => (o.state.docsRequired && n in o.state.docsRequired ? !!o.state.docsRequired[n] : defaultReq(n));
  const reqDocs = all.filter(req);
  const okStatus = o.mode === 'buyer' ? ['sent', 'verified'] : ['verified'];
  const verified = reqDocs.filter((n) => okStatus.includes(statusOf(n))).length;
  const first = o.party.name.split(' ')[0];
  const setDocs = (patch: Record<string, DocRecord>, msg: string) => o.save({ docs: { ...docs, ...patch } }).then(() => toast(msg));
  const setDoc = (n: string, rec: Partial<DocRecord>, msg: string) => setDocs({ [n]: { ...docs[n], status: 'missing', ...rec, updatedAt: new Date().toISOString() } as DocRecord }, msg);

  const request = (n: string) =>
    o.openForm({
      title: 'Send Document Request',
      subtitle: n,
      fields: [{ key: 'ch', label: 'Send via', type: 'select', options: ['💬 WhatsApp', '📧 Email'], default: '💬 WhatsApp', required: true }],
      onSubmit: async (v) => {
        const email = String(v.ch).includes('Email');
        openCompose({
          channel: email ? 'email' : 'whatsapp',
          name: o.party.name,
          to: email ? o.party.email : o.party.phone,
          entity: o.entity,
          subject: 'Document needed — ' + n,
          body: 'Hi ' + first + ', please upload "' + n + '" in the BuiltGlory app.',
          onSent: () => void setDoc(n, { status: 'requested' }, '📲 Document request sent to ' + o.party.name),
        });
      },
    });

  const adminUpload = (n: string) =>
    o.openForm({
      title: '📎 Admin Upload',
      subtitle: n,
      fields: [{ key: 'file', label: 'Document file', type: 'file', accept: '.pdf,.jpg,.jpeg,.png,.webp', required: true }],
      submit: 'Upload',
      onSubmit: async (v) => {
        const file = v.file as File;
        const url = await o.upload(file, n);
        await setDoc(n, { status: 'pending', url, fileName: file.name }, '📎 ' + n + ' uploaded');
      },
    });

  const view = (n: string) => {
    const d = docs[n];
    if (d?.url) return void window.open(d.url, '_blank', 'noopener,noreferrer');
    o.openForm({ title: n, text: 'No file attached to this document yet.' });
  };

  const sendToBuyer = (n: string) =>
    o.openForm({
      title: 'Send to Buyer',
      subtitle: n,
      fields: [
        { key: 'ch', label: 'Send via', type: 'select', options: ['WhatsApp', 'Email'], default: 'WhatsApp' },
        { key: 'url', label: 'Document URL (optional)', placeholder: 'https://…', default: docs[n]?.url || '' },
      ],
      validate: (v) => ({ url: isHttpsUrl(String(v.url || '')) ? '' : 'URL must start with https://' }),
      onSubmit: async (v) => {
        const email = v.ch === 'Email';
        openCompose({
          channel: email ? 'email' : 'whatsapp',
          name: o.party.name,
          to: email ? o.party.email : o.party.phone,
          entity: o.entity,
          subject: n + ' — BuiltGlory',
          body: n + ' is ready in your BuiltGlory app.' + (v.url ? ' ' + v.url : ''),
          onSent: () => void setDoc(n, { status: 'sent', url: String(v.url || docs[n]?.url || '') || undefined }, '📤 Sent to ' + o.party.name),
        });
      },
    });

  const rows = (cats[cat] ?? []).map((n) => {
    const s = statusOf(n);
    const r = req(n);
    const st = DOC_ST[s] ?? DOC_ST.missing!;
    const actions: Array<DetailAction | null> = [
      { label: r ? 'Required ✅' : 'Set as Required', onClick: () => void o.save({ docsRequired: { ...Object.fromEntries(all.map((d) => [d, req(d)])), [n]: !r } }) },
      s === 'missing' || s === 'rejected' || s === 'requested' ? { label: '📎 Admin Upload', onClick: () => adminUpload(n) } : null,
      s === 'missing' || s === 'rejected' ? { label: '📲 Request', onClick: () => request(n) } : null,
      s === 'pending' || s === 'verified' || s === 'sent' ? { label: 'View', onClick: () => view(n) } : null,
      o.mode !== 'buyer' && s === 'pending' ? { label: 'Verify', variant: 'green', onClick: () => void setDoc(n, { status: 'verified' }, '✅ ' + n + ' verified') } : null,
      o.mode !== 'buyer' && s === 'pending'
        ? {
            label: 'Reject',
            variant: 'red',
            onClick: () =>
              askConfirm({
                title: 'Reject document?',
                input: { label: 'Rejection reason', required: true, placeholder: 'e.g. Pages missing' },
                confirmLabel: 'Confirm Reject',
                tone: 'destructive',
                onConfirm: ({ value }) => setDoc(n, { status: 'rejected', rejectionReason: value }, '❌ ' + n + ' rejected'),
              }),
          }
        : null,
      o.mode === 'buyer' && s === 'pending' ? { label: 'Send to Buyer', variant: 'primary', onClick: () => sendToBuyer(n) } : null,
    ];
    return { key: n, title: n, sub: (r ? 'Required ✅' : 'Optional') + (docs[n]?.rejectionReason ? ' · ' + docs[n]!.rejectionReason : '') + (docs[n]?.fileName ? ' · ' + docs[n]!.fileName : ''), badges: [badge(st[0], st[1])], actions };
  });

  return {
    key: 'legal',
    title: o.mode === 'buyer' ? 'Buyer Documents' : 'Legal Document Checklist',
    subtitle: verified + ' of ' + reqDocs.length + ' required documents ' + (o.mode === 'buyer' ? 'sent' : 'verified'),
    banners: [
      o.mode === 'buyer' ? { text: '📤 These documents are prepared by Builtglory and sent to the buyer. Upload each document and send to buyer.', tone: 'info' } : null,
      verified === reqDocs.length && reqDocs.length
        ? { text: '✅ All required documents ' + (o.mode === 'buyer' ? 'sent' : 'verified') + '! Ready to proceed to next stage.', tone: 'success' }
        : { text: 'Mark documents as required to track progress', tone: 'muted' },
    ],
    chips: names.map((n, i) => ({ label: i + 1 + '. ' + n, on: cat === n, onClick: () => o.f.set('legal.cat', n) })),
    rows,
    actions: [
      o.mode !== 'buyer'
        ? {
            label: 'Verify All',
            variant: 'green',
            onClick: () => {
              const pend = (cats[cat] ?? []).filter((n) => statusOf(n) === 'pending');
              if (!pend.length) return toast('No pending documents in ' + cat);
              void setDocs(Object.fromEntries(pend.map((n) => [n, { ...docs[n], status: 'verified' } as DocRecord])), '✅ Pending documents in ' + cat + ' verified');
            },
          }
        : {
            label: '📤 Send All to Buyer',
            variant: 'primary',
            onClick: () => {
              const pend = all.filter((n) => statusOf(n) === 'pending');
              if (!pend.length) return toast('No uploaded documents waiting to be sent');
              openCompose({
                channel: 'whatsapp',
                name: o.party.name,
                to: o.party.phone,
                entity: o.entity,
                body: 'Hi ' + first + ', these documents are ready in your BuiltGlory app: ' + pend.join(', ') + '.',
                onSent: () => void setDocs(Object.fromEntries(pend.map((n) => [n, { ...docs[n], status: 'sent' } as DocRecord])), '📤 Uploaded documents sent to buyer'),
              });
            },
          },
      {
        label: 'Request All Missing',
        onClick: () => {
          const miss = all.filter((n) => statusOf(n) === 'missing' && req(n));
          if (!miss.length) return toast('No missing required documents');
          openCompose({
            channel: 'whatsapp',
            name: o.party.name,
            to: o.party.phone,
            entity: o.entity,
            body: 'Hi ' + first + ', please upload these documents in the BuiltGlory app: ' + miss.join(', ') + '.',
            onSent: () => void setDocs(Object.fromEntries(miss.map((n) => [n, { ...docs[n], status: 'requested' } as DocRecord])), '📲 Requested ' + miss.length + ' documents'),
          });
        },
      },
      {
        label: '+ Add Custom Document',
        onClick: () =>
          o.openForm({
            title: 'Add Custom Document Field',
            fields: [{ key: 'name', label: 'Document name', required: true }],
            onSubmit: async (v) => {
              const name = String(v.name).trim();
              await o.save({
                customDocs: { ...(o.state.customDocs ?? {}), [cat]: [...(o.state.customDocs?.[cat] ?? []), name] },
                docsRequired: { ...(o.state.docsRequired ?? {}), [name]: true },
              });
              toast('Document field added');
            },
          }),
      },
    ],
    verified,
    required: reqDocs.length,
  };
}
