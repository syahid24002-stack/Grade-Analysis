// Pembaca dan penulis CSV kecil (RFC 4180), tanpa pustaka tambahan.
// Pemisah (koma atau titik koma) dikenali otomatis dari baris pertama, karena Excel versi Indonesia
// biasanya menyimpan CSV dengan titik koma.

export function detectDelimiter(text) {
  let inQ = false, comma = 0, semi = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') inQ = !inQ;
    else if (!inQ && (c === '\n' || c === '\r')) break;
    else if (!inQ && c === ',') comma++;
    else if (!inQ && c === ';') semi++;
  }
  return semi > comma ? ';' : ',';
}

/** Mengubah teks CSV menjadi array baris (array string). Baris yang seluruhnya kosong dibuang. */
export function parseCsv(input) {
  const text = String(input ?? '').replace(/^\uFEFF/, '');
  const delim = detectDelimiter(text);
  const rows = [];
  let row = [], field = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false;
      } else field += c;
    } else if (c === '"') inQ = true;
    else if (c === delim) { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      rows.push(row); row = [];
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((x) => String(x).trim() !== ''));
}

export function csvEscape(v) {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

/** Array baris -> teks CSV (dengan BOM agar Excel membaca UTF-8 dengan benar). */
export function toCsv(rows) {
  return '\uFEFF' + rows.map((r) => r.map(csvEscape).join(',')).join('\n');
}

/** Mengunduh teks sebagai berkas di browser. */
export function downloadText(filename, text, type = 'text/csv;charset=utf-8;') {
  const blob = new Blob([text], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
