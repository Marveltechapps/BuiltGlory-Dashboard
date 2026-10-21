import { useSyncExternalStore } from 'react';

const subscribe = (cb: () => void) => {
  window.addEventListener('resize', cb);
  return () => window.removeEventListener('resize', cb);
};
const getWidth = () => window.innerWidth || document.documentElement.clientWidth || 1280;

/** Live viewport width plus the Tailwind-style breakpoints the reference design uses. */
export function useViewport() {
  const vw = useSyncExternalStore(subscribe, getWidth, () => 1280);
  return { vw, isSm: vw >= 640, isMd: vw >= 768, isLg: vw >= 1024, isXl: vw >= 1280 };
}
