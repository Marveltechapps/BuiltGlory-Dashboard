import type { CSSProperties } from 'react';

export function Skeleton({ style }: { style?: CSSProperties }) {
  return <span style={{ display: 'block', background: '#f1f5f9', animation: 'bg-pulse 2s cubic-bezier(.4,0,.6,1) infinite', ...style }} />;
}

/** Repeated title/subtitle rows used while a list or section is loading. */
export function SkeletonRows({ count = 4 }: { count?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading" style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '8px 0' }}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Skeleton style={{ width: 36, height: 36, borderRadius: 9999, flexShrink: 0 }} />
          <div style={{ display: 'flex', flex: 1, flexDirection: 'column', gap: 6 }}>
            <Skeleton style={{ height: 12, width: '46%', borderRadius: 6 }} />
            <Skeleton style={{ height: 10, width: '28%', borderRadius: 6 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Green "live" ping dot. */
export function PingDot() {
  return (
    <span style={{ position: 'relative', display: 'inline-flex', width: 8, height: 8, flexShrink: 0 }}>
      <span style={{ position: 'absolute', inset: 0, borderRadius: 9999, background: '#4ade80', opacity: 0.75, animation: 'bg-ping 1s cubic-bezier(0,0,.2,1) infinite' }} />
      <span style={{ position: 'relative', display: 'inline-flex', width: 8, height: 8, borderRadius: 9999, background: '#22c55e' }} />
    </span>
  );
}
