import { useState, type ReactNode } from 'react';
import { formatApiError } from '../../lib/apiClient';
import type { ActionVariant, DetailBanner, DetailField, InputType } from '../../types/detail';
import { DetailSection } from './DetailSection';
import { Modal } from './Modal';

export interface FormModalField {
  key: string;
  label: string;
  type?: InputType;
  options?: Array<string | { value: string; label: string }>;
  required?: boolean;
  reqMsg?: string;
  default?: string | boolean;
  placeholder?: string;
  hint?: string;
  min?: string;
  max?: string;
  full?: boolean;
  accept?: string;
}

export type FormValues = Record<string, string | boolean | File | null | undefined>;

export interface FormModalOptions {
  title: string;
  subtitle?: string;
  text?: string;
  banners?: DetailBanner[];
  info?: DetailField[];
  fields?: FormModalField[];
  formCols?: 1 | 2;
  submit?: string;
  tone?: ActionVariant;
  wide?: boolean;
  custom?: ReactNode;
  validate?: (v: FormValues) => Record<string, string> | undefined;
  onSubmit?: (v: FormValues) => void | Promise<unknown>;
  extraActions?: Array<{ label: string; onClick: () => void; variant?: ActionVariant }>;
}

/** Modal form rendered with DetailSection, matching the reference record-detail modal. */
export function useFormModal() {
  const [opts, setOpts] = useState<FormModalOptions | null>(null);
  const [values, setValues] = useState<FormValues>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState('');

  const open = (o: FormModalOptions) => {
    const init: FormValues = {};
    (o.fields || []).forEach((f) => {
      if (f.default != null) init[f.key] = f.default;
    });
    setValues(init);
    setErrors({});
    setFailure('');
    setBusy(false);
    setOpts(o);
  };
  const close = () => setOpts(null);

  const submit = async () => {
    if (!opts) return;
    const err: Record<string, string> = {};
    (opts.fields || []).forEach((f) => {
      const v = values[f.key];
      if (f.required && (v == null || String(v instanceof File ? v.name : v).trim() === '' || v === false)) err[f.key] = f.reqMsg || f.label + ' is required';
    });
    if (!Object.keys(err).length && opts.validate) Object.entries(opts.validate(values) || {}).forEach(([k, m]) => m && (err[k] = m));
    if (Object.keys(err).length) return setErrors(err);
    if (!opts.onSubmit) return close();
    setBusy(true);
    setFailure('');
    try {
      await opts.onSubmit(values);
      close();
    } catch (e) {
      setFailure(formatApiError(e));
      setBusy(false);
    }
  };

  const element = opts ? (
    <Modal open onClose={close} bare maxWidth={opts.wide ? 760 : 560} zIndex={105}>
      <DetailSection
        s={{
          title: opts.title,
          subtitle: opts.subtitle,
          text: opts.text,
          banners: [...(opts.banners || []), failure ? { text: failure, tone: 'error' as const } : null],
          fields: opts.info,
          formCols: opts.formCols || 1,
          custom: opts.custom,
          form: (opts.fields || []).map((f) => ({
            ...f,
            value: f.type === 'file' ? undefined : (values[f.key] as string | boolean | undefined) ?? (f.type === 'checkbox' ? false : ''),
            error: errors[f.key] || '',
            onChange: (v: string | boolean) => {
              setValues((s) => ({ ...s, [f.key]: v }));
              setErrors((s) => ({ ...s, [f.key]: '' }));
            },
            onFile: (file: File | null) => {
              setValues((s) => ({ ...s, [f.key]: file }));
              setErrors((s) => ({ ...s, [f.key]: '' }));
            },
          })),
          actions: [
            opts.onSubmit ? { label: opts.submit || 'Save', variant: opts.tone || 'primary', onClick: submit, loading: busy } : null,
            ...(opts.extraActions || []).map((a) => ({ ...a, onClick: () => { close(); a.onClick(); } })),
            { label: opts.onSubmit ? 'Cancel' : 'Close', onClick: close },
          ],
        }}
      />
    </Modal>
  ) : null;

  return { open, close, element };
}
