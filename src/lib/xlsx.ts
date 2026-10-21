/**
 * Minimal, dependency-free XLSX support: read every sheet of a workbook into row objects
 * (header row → keys) and write a simple single/multi-sheet workbook. Uses the browser's
 * DecompressionStream for deflate and stores entries uncompressed when writing.
 */

export type SheetRows = Array<Record<string, string>>;

const td = new TextDecoder();
const te = new TextEncoder();

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream('deflate-raw');
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Reads zip entries via the central directory. */
async function unzip(buf: ArrayBuffer): Promise<Map<string, Uint8Array>> {
  const u8 = new Uint8Array(buf);
  const dv = new DataView(buf);
  let eocd = -1;
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('Not a valid .xlsx file');
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const out = new Map<string, Uint8Array>();
  for (let n = 0; n < count; n++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true);
    const csize = dv.getUint32(p + 20, true);
    const nameLen = dv.getUint16(p + 28, true);
    const extraLen = dv.getUint16(p + 30, true);
    const commentLen = dv.getUint16(p + 32, true);
    const local = dv.getUint32(p + 42, true);
    const name = td.decode(u8.subarray(p + 46, p + 46 + nameLen));
    const lNameLen = dv.getUint16(local + 26, true);
    const lExtraLen = dv.getUint16(local + 28, true);
    const start = local + 30 + lNameLen + lExtraLen;
    const raw = u8.subarray(start, start + csize);
    out.set(name, method === 0 ? raw : await inflateRaw(raw));
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

const parseXml = (bytes: Uint8Array | undefined) => new DOMParser().parseFromString(bytes ? td.decode(bytes) : '<x/>', 'application/xml');

function colIndex(ref: string) {
  const letters = ref.replace(/\d+/g, '');
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/** Returns { sheetName: rows[] } using the first row of each sheet as headers. */
export async function readWorkbook(file: File): Promise<Record<string, SheetRows>> {
  const files = await unzip(await file.arrayBuffer());
  const shared = Array.from(parseXml(files.get('xl/sharedStrings.xml')).getElementsByTagName('si')).map((si) =>
    Array.from(si.getElementsByTagName('t')).map((t) => t.textContent ?? '').join(''),
  );
  const wb = parseXml(files.get('xl/workbook.xml'));
  const rels = parseXml(files.get('xl/_rels/workbook.xml.rels'));
  const relTarget: Record<string, string> = {};
  Array.from(rels.getElementsByTagName('Relationship')).forEach((r) => (relTarget[r.getAttribute('Id') ?? ''] = r.getAttribute('Target') ?? ''));
  const result: Record<string, SheetRows> = {};
  Array.from(wb.getElementsByTagName('sheet')).forEach((s, i) => {
    const name = s.getAttribute('name') ?? 'Sheet' + (i + 1);
    const rid = s.getAttribute('r:id') ?? s.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') ?? '';
    const target = relTarget[rid] || 'worksheets/sheet' + (i + 1) + '.xml';
    const path = target.startsWith('/') ? target.slice(1) : 'xl/' + target.replace(/^\.\//, '');
    const doc = parseXml(files.get(path));
    const grid: string[][] = [];
    Array.from(doc.getElementsByTagName('row')).forEach((row) => {
      const cells: string[] = [];
      Array.from(row.getElementsByTagName('c')).forEach((c) => {
        const t = c.getAttribute('t');
        const v = c.getElementsByTagName('v')[0]?.textContent ?? '';
        const inline = Array.from(c.getElementsByTagName('t')).map((x) => x.textContent ?? '').join('');
        const value = t === 's' ? shared[Number(v)] ?? '' : t === 'inlineStr' ? inline : v;
        cells[colIndex(c.getAttribute('r') ?? 'A1')] = value;
      });
      grid.push(cells);
    });
    const headers = (grid[0] ?? []).map((h) => String(h ?? '').trim());
    result[name] = grid
      .slice(1)
      .filter((r) => r.some((v) => String(v ?? '').trim() !== ''))
      .map((r) => Object.fromEntries(headers.map((h, j) => [h || 'Column ' + (j + 1), String(r[j] ?? '').trim()])));
  });
  return result;
}

/* ------------------------------ writer ------------------------------ */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(data: Uint8Array) {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function zip(entries: Array<[string, string]>): Blob {
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const [name, content] of entries) {
    const nameB = te.encode(name);
    const data = te.encode(content);
    const crc = crc32(data);
    const local = new Uint8Array(30 + nameB.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, nameB.length, true);
    local.set(nameB, 30);
    const cen = new Uint8Array(46 + nameB.length);
    const cv = new DataView(cen.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, nameB.length, true);
    cv.setUint32(42, offset, true);
    cen.set(nameB, 46);
    chunks.push(local, data);
    central.push(cen);
    offset += local.length + data.length;
  }
  const cenSize = central.reduce((t, c) => t + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, cenSize, true);
  ev.setUint32(16, offset, true);
  return new Blob([...chunks, ...central, end] as BlobPart[], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);
const colName = (i: number) => {
  let s = '';
  let n = i + 1;
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
};

/** Builds an .xlsx Blob; each sheet is [headers, ...rows] of plain values (inline strings / numbers). */
export function writeWorkbook(sheets: Array<{ name: string; rows: Array<Array<string | number | boolean | null | undefined>> }>): Blob {
  const sheetXml = (rows: Array<Array<string | number | boolean | null | undefined>>) =>
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' +
    rows
      .map((r, ri) => '<row r="' + (ri + 1) + '">' + r.map((v, ci) => {
        const ref = colName(ci) + (ri + 1);
        if (typeof v === 'number' && Number.isFinite(v)) return '<c r="' + ref + '"><v>' + v + '</v></c>';
        const s = v == null ? '' : String(v);
        return '<c r="' + ref + '" t="inlineStr"><is><t xml:space="preserve">' + esc(s) + '</t></is></c>';
      }).join('') + '</row>')
      .join('') +
    '</sheetData></worksheet>';
  const safe = sheets.map((s, i) => ({ ...s, name: esc(s.name.slice(0, 31) || 'Sheet' + (i + 1)) }));
  const entries: Array<[string, string]> = [
    ['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' + safe.map((_, i) => '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join('') + '</Types>'],
    ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
    ['xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' + safe.map((s, i) => '<sheet name="' + s.name + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>').join('') + '</sheets></workbook>'],
    ['xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + safe.map((_, i) => '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>').join('') + '</Relationships>'],
    ...safe.map((s, i) => ['xl/worksheets/sheet' + (i + 1) + '.xml', sheetXml(s.rows)] as [string, string]),
  ];
  return zip(entries);
}
