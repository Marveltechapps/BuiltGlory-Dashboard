export const move = <T,>(list: T[], i: number, dir: number): T[] => {
  const j = i + dir;
  if (j < 0 || j >= list.length) return list;
  const a = list.slice();
  [a[i], a[j]] = [a[j]!, a[i]!];
  return a;
};

export const uid = (prefix: string) => prefix + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export const isHttps = (v: unknown) => !String(v ?? '').trim() || /^https:\/\//.test(String(v).trim());
