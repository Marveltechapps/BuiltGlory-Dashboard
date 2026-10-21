import type { SectionSpec } from '../../types/detail';

/** Checklist section whose state lives in a persisted `{ [label]: boolean }` map. */
export function checksSection(title: string, items: string[], state: Record<string, unknown>, onToggle: (next: Record<string, boolean>) => void, subtitle?: string): SectionSpec {
  const cur = Object.fromEntries(items.map((i) => [i, state[i] === true]));
  return {
    title,
    subtitle,
    checks: items.map((label) => ({ label, done: cur[label], onToggle: () => onToggle({ ...cur, [label]: !cur[label] }) })),
  };
}

export const checksDone = (items: string[], state: Record<string, unknown>) => items.filter((i) => state[i] === true).length;
