import type { CSSProperties, ReactNode } from 'react';
import type { BadgeSpec } from '../../lib/format';

interface BadgeProps {
  spec?: BadgeSpec;
  bg?: string;
  fg?: string;
  children?: ReactNode;
  size?: 'xs' | 'sm';
  style?: CSSProperties;
}

/** Rounded status pill. `xs` is the 10px tag used inside table cells. */
export function Badge({ spec, bg, fg, children, size = 'sm', style }: BadgeProps) {
  const base: CSSProperties =
    size === 'xs'
      ? { display: 'inline-flex', alignItems: 'center', borderRadius: 9999, padding: '0 6px', fontSize: 10, lineHeight: '16px', fontWeight: 600 }
      : { display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap', borderRadius: 9999, padding: '2px 8px', fontSize: 12, lineHeight: '16px', fontWeight: 500 };
  return <span style={{ ...base, background: spec?.bg ?? bg ?? '#f1f5f9', color: spec?.fg ?? fg ?? '#64748b', ...style }}>{children ?? spec?.text}</span>;
}
