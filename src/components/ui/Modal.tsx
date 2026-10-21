import { useEffect, type CSSProperties, type ReactNode } from 'react';
import styles from './Modal.module.css';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  maxWidth?: number | string;
  /** Renders children without the default padded white panel (DetailSection supplies its own card). */
  bare?: boolean;
  zIndex?: number;
  labelledBy?: string;
}

export function Modal({ open, onClose, children, maxWidth = 448, bare, zIndex, labelledBy }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  const panelStyle: CSSProperties = { maxWidth };
  return (
    <div className={styles.overlay} style={zIndex ? { zIndex } : undefined} onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby={labelledBy} className={[styles.panel, bare ? styles.bare : ''].join(' ')} style={panelStyle} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

