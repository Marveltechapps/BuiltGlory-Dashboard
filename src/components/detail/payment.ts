import type { FormFields } from '../../hooks/useFormFields';
import type { FormInput } from '../../types/detail';

/** Payment methods accepted by the acquisition token and sales token-payment validators. */
export const PAY_METHODS: Array<{ value: 'neft' | 'upi' | 'cheque' | 'cash'; label: string }> = [
  { value: 'neft', label: 'NEFT' },
  { value: 'upi', label: 'UPI' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'cash', label: 'Cash' },
];

export const methodLabel = (m: unknown) => PAY_METHODS.find((x) => x.value === m)?.label ?? String(m || '—').toUpperCase();

export interface PaymentRecord {
  amount: number;
  method: 'neft' | 'upi' | 'cheque' | 'cash';
  paymentDate: string;
  reference: string;
  proofUrl?: string;
  notes?: string;
}

/** Amount / method / reference / date fields (prefix keeps several forms apart). */
export function payForm(f: FormFields, p: string, today: string, o: { amountLabel?: string; amount?: number; hint?: string; proof?: boolean } = {}): FormInput[] {
  const method = f.str(p + 'method');
  const list: Array<FormInput | null> = [
    f.inp(p + 'amount', o.amountLabel || 'Amount (₹)', { type: 'number', required: true, default: o.amount != null ? String(o.amount) : '', hint: o.hint }),
    f.inp(p + 'method', 'Payment method', { type: 'select', options: PAY_METHODS, required: true }),
    method === 'cash' ? null : f.inp(p + 'ref', method === 'cheque' ? 'Cheque number' : 'UTR / Reference number', { required: true }),
    method === 'cheque' ? f.inp(p + 'chqStatus', 'Cheque status', { type: 'select', options: ['Deposited', 'Cleared', 'Cheque Bounced ❌'] }) : null,
    f.inp(p + 'date', 'Payment date', { type: 'date', required: true, max: today, default: today }),
    o.proof ? f.inp(p + 'proof', 'Payment proof uploaded', { type: 'checkbox' }) : null,
  ];
  return list.filter((x): x is FormInput => !!x);
}

/** Validates a payForm block; returns the record or null (errors set on the fields). */
export function payValid(f: FormFields, p: string, today: string, defaults: { amount?: number } = {}, o: { zeroMsg?: string; proof?: boolean } = {}): PaymentRecord | null {
  const amountStr = f.str(p + 'amount', defaults.amount != null ? String(defaults.amount) : '');
  const date = f.str(p + 'date', today);
  const req: Record<string, string> = { [p + 'method']: 'Payment method is required' };
  if (!amountStr) req[p + 'amount'] = 'Amount is required';
  if (!date) req[p + 'date'] = 'Payment date is required';
  if (f.str(p + 'method') && f.str(p + 'method') !== 'cash') req[p + 'ref'] = f.str(p + 'method') === 'cheque' ? 'Cheque number is required' : 'UTR / Reference number is required';
  if (!f.need(req, { [p + 'amount']: amountStr, [p + 'date']: date })) return null;
  const amount = Number(amountStr);
  if (!(amount > 0)) return (f.fail(p + 'amount', o.zeroMsg || 'Amount must be greater than 0'), null);
  if (date > today) return (f.fail(p + 'date', 'Payment date is in the future'), null);
  if (o.proof && !f.val<boolean>(p + 'proof', false)) return (f.fail(p + 'proof', 'Payment proof is required'), null);
  if (f.str(p + 'chqStatus') === 'Cheque Bounced ❌') return (f.fail(p + 'chqStatus', 'Cheque Bounced ❌ — re-initiate payment'), null);
  const method = f.str(p + 'method') as PaymentRecord['method'];
  return { amount, method, reference: f.str(p + 'ref') || 'Cash', paymentDate: date };
}

/** Opens a printable receipt (browser print dialog → Save as PDF). */
export function printReceipt(title: string, rows: Array<[string, string]>, footer?: string) {
  // Same-origin blank window we write ourselves; `noopener` would make window.open return null.
  const w = window.open('', '_blank', 'width=640,height=760');
  if (!w) return;
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);
  w.document.write(
    `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>body{font-family:'Segoe UI',system-ui,sans-serif;color:#0f172a;padding:32px}h1{font-size:20px;color:#2563eb;margin:0 0 4px}h2{font-size:16px;margin:0 0 20px}table{width:100%;border-collapse:collapse}td{padding:8px 0;border-bottom:1px solid #e2e8f0;font-size:14px}td:first-child{color:#64748b}p{margin-top:20px;font-size:13px;color:#475569}</style></head><body><h1>BUILTGLORY</h1><h2>${esc(title)}</h2><table>${rows
      .map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`)
      .join('')}</table>${footer ? `<p>${esc(footer)}</p>` : ''}<script>window.onload=function(){window.print()}</script></body></html>`,
  );
  w.document.close();
}
