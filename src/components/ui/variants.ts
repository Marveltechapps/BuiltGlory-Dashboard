import type { CSSProperties } from 'react';
import type { ActionVariant, BannerTone } from '../../types/detail';

/** [border, background, foreground] per action variant. */
const V: Record<ActionVariant, [string, string, string]> = {
  primary: ['#2563eb', '#2563eb', '#ffffff'], outline: ['#e2e8f0', '#ffffff', '#0f172a'], destructive: ['#dc2626', '#dc2626', '#ffffff'],
  green: ['#bbf7d0', '#f0fdf4', '#15803d'], red: ['#fecaca', '#fef2f2', '#b91c1c'], amber: ['#fde68a', '#fffbeb', '#92400e'], link: ['transparent', 'transparent', '#2563eb'],
};

/** [background, foreground, border] per banner tone. */
export const BANNER_TONES: Record<BannerTone, [string, string, string]> = {
  info: ['#eff6ff', '#1d4ed8', '#bfdbfe'], warn: ['#fffbeb', '#92400e', '#fde68a'], error: ['#fef2f2', '#991b1b', '#fecaca'],
  success: ['#f0fdf4', '#15803d', '#bbf7d0'], muted: ['#f8fafc', '#475569', '#e2e8f0'],
};

export const variantStyle = (v: ActionVariant = 'outline'): CSSProperties => {
  const [border, bg, fg] = V[v] ?? V.outline;
  return { borderColor: border, background: bg, color: fg };
};
