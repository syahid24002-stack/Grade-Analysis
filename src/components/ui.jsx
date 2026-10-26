import { useMemo, useRef, useState } from 'react';
import { Icon } from './Icon';

/** Kerangka pemuatan (berkilau) sebagai pengganti tulisan "Memuat…". */
export function Skeleton({ lines = 3, height = 14 }) {
  return (
    <div aria-busy="true" aria-label="Memuat">
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="skeleton" style={{ height, width: `${100 - (i % 3) * 14}%`, marginBottom: 10 }} />
      ))}
    </div>
  );
}

export function SkeletonRows({ cols, rows = 4 }) {
  return Array.from({ length: rows }, (_, r) => (
    <tr key={r}>{Array.from({ length: cols }, (_, c) => <td key={c}><div className="skeleton" style={{ height: 12, width: `${60 + ((r + c) % 4) * 10}%` }} /></td>)}</tr>
  ));
}

/** Tampilan kosong yang memberi arahan, bukan sekadar "tidak ada data". */
export function EmptyState({ icon = 'file', title, text, action }) {
  return (
    <div className="empty-state">
      <div className="stat-ico" style={{ width: 52, height: 52, borderRadius: 16, margin: '0 auto 12px' }}><Icon name={icon} /></div>
      <h4 style={{ margin: '0 0 4px' }}>{title}</h4>
      {text ? <p style={{ margin: '0 0 12px', color: 'var(--muted)', fontSize: 13.5 }}>{text}</p> : null}
      {action}
    </div>
  );
}

/** Mengurutkan baris: const { rows, sort, th } = useSort(data, 'rank'); lalu <SortTh .../> */
export function useSort(data, initialKey = null, initialDir = 'asc') {
  const [state, setState] = useState({ key: initialKey, dir: initialDir });
  const rows = useMemo(() => {
    if (!state.key) return data;
    const k = state.key, m = state.dir === 'asc' ? 1 : -1;
    return [...data].sort((a, b) => {
      const x = a[k], y = b[k];
      if (x == null && y == null) return 0;
      if (x == null) return 1;
      if (y == null) return -1;
      return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'id')) * m;
    });
  }, [data, state]);
  const toggle = (key) => setState((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
  return { rows, sort: state, toggle };
}

export function SortTh({ k, sort, toggle, children }) {
  const on = sort.key === k;
  return (
    <th className="sortable" onClick={() => toggle(k)} aria-sort={on ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      {children}<span className="sort-arrow">{on ? (sort.dir === 'asc' ? '▲' : '▼') : '↕'}</span>
    </th>
  );
}

/** Zona seret-dan-lepas berkas (atau klik untuk memilih). */
export function Dropzone({ accept, file, onFile, hint }) {
  const input = useRef(null);
  const [over, setOver] = useState(false);
  return (
    <div
      className={`dropzone${over ? ' over' : ''}${file ? ' has-file' : ''}`} role="button" tabIndex={0}
      onClick={() => input.current?.click()} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.current?.click(); } }}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files?.[0]; if (f) onFile(f); }}
    >
      <input ref={input} type="file" accept={accept} hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
      <Icon name="upload" />
      <div>
        {file ? <><b>{file.name}</b> <small style={{ color: 'var(--muted)' }}>({Math.max(1, Math.round(file.size / 1024))} KB) · klik untuk mengganti</small></>
          : <><b>Seret file CSV ke sini</b> atau klik untuk memilih<div style={{ color: 'var(--muted)', fontSize: 12.5 }}>{hint}</div></>}
      </div>
    </div>
  );
}
