import { saveBlob } from './apiClient';

/** CSV download of real records (client-side; used where the API has no export endpoint). */
export function downloadCsv(fileName: string, head: string[], rows: Array<Array<string | number | null | undefined>>) {
  const cell = (v: string | number | null | undefined) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const text = [head, ...rows].map((r) => r.map(cell).join(',')).join('\n');
  saveBlob(new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' }), fileName);
}
