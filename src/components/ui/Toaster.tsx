import { useUiStore } from '../../store/uiStore';
import s from './Modal.module.css';

export function Toaster() {
  const toasts = useUiStore((st) => st.toasts);
  return (
    <div className={s.toasts} role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={s.toast} style={{ background: t.tone === 'green' ? '#16a34a' : '#0f172a' }}>{t.text}</div>
      ))}
    </div>
  );
}
