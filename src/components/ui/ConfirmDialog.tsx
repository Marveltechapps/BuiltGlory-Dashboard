import { useEffect, useState } from 'react';
import { useUiStore } from '../../store/uiStore';
import { formatApiError } from '../../lib/apiClient';
import { Button } from './Button';
import { Modal } from './Modal';
import s from './Modal.module.css';

/** Global confirm dialog driven by `askConfirm()` (optional select + required reason input). */
export function ConfirmDialog() {
  const cf = useUiStore((st) => st.confirm);
  const close = useUiStore((st) => st.closeConfirm);
  const [value, setValue] = useState('');
  const [select, setSelect] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setValue(cf?.input?.defaultValue ?? '');
    setSelect('');
    setError('');
    setBusy(false);
  }, [cf]);

  if (!cf) return null;
  const variant = cf.tone === 'destructive' ? 'destructive' : cf.tone === 'green' ? 'solidGreen' : 'primary';

  const ok = async () => {
    if (cf.select?.required && !select) return setError(cf.select.error || 'Please select an option');
    if (cf.input?.required && !value.trim()) return setError(cf.input.error || 'This field is required');
    setBusy(true);
    try {
      await cf.onConfirm({ value, select });
      close();
    } catch (e) {
      setError(formatApiError(e));
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={close} labelledBy="confirm-title">
      <h3 id="confirm-title" className={s.title}>{cf.title}</h3>
      {cf.message && <p className={s.message}>{cf.message}</p>}
      {cf.select && (
        <label className={s.label} style={{ marginTop: 16 }}>
          {cf.select.label}
          <select className="bg-input" value={select} onChange={(e) => { setSelect(e.target.value); setError(''); }}>
            <option value="">{cf.select.placeholder || 'Select…'}</option>
            {cf.select.options.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </label>
      )}
      {cf.input && (
        <label className={s.label} style={{ marginTop: 16 }}>
          {cf.input.label}
          <textarea className="bg-input" rows={3} value={value} placeholder={cf.input.placeholder} onChange={(e) => { setValue(e.target.value); setError(''); }} />
        </label>
      )}
      {error && <p className={s.error} style={{ marginTop: 4 }}>{error}</p>}
      <div className={s.actions}>
        <Button variant={variant} onClick={ok} loading={busy}>{cf.confirmLabel || 'Confirm'}</Button>
        <Button onClick={close}>Cancel</Button>
      </div>
    </Modal>
  );
}
