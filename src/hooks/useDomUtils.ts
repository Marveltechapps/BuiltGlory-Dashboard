import { useEffect, useRef, useState, type RefObject } from 'react';

/** Closes a popover when a mousedown lands outside `ref`. */
export function useClickOutside(ref: RefObject<HTMLElement | null>, open: boolean, onOutside: () => void) {
  const cb = useRef(onOutside);
  cb.current = onOutside;
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) cb.current();
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open, ref]);
}

export function useDebounced<T>(value: T, ms = 250): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** Browser online/offline state plus a 3s "Back online" flash. */
export function useOnlineStatus() {
  const [offline, setOffline] = useState(typeof navigator !== 'undefined' ? !navigator.onLine : false);
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const on = () => {
      setOffline(false);
      setFlash(true);
      clearTimeout(t);
      t = setTimeout(() => setFlash(false), 3000);
    };
    const off = () => setOffline(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
      clearTimeout(t);
    };
  }, []);
  return { offline, backOnline: flash && !offline };
}

/** Width of an element, kept current with ResizeObserver (used by the SVG charts). */
export function useElementWidth<T extends HTMLElement>() {
  const [el, setEl] = useState<T | null>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, [el]);
  return { ref: setEl, el, width: w };
}
