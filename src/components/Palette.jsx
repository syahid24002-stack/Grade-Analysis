import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from './Icon';

/** Palet perintah (Ctrl K). items: [{ t: teks, i: ikon, f: aksi }] */
export function Palette({ items, onClose }) {
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const input = useRef(null);
  const list = useMemo(() => items.filter((x) => !q.trim() || x.t.toLowerCase().includes(q.toLowerCase().trim())), [items, q]);

  useEffect(() => { input.current?.focus(); }, []);
  const run = (i) => { const it = list[i]; onClose(); if (it) it.f(); };

  const onKey = (e) => {
    if (e.key === 'ArrowDown') { setIdx((i) => Math.min(list.length - 1, i + 1)); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { setIdx((i) => Math.max(0, i - 1)); e.preventDefault(); }
    else if (e.key === 'Enter') { run(idx); e.preventDefault(); }
    else if (e.key === 'Escape') onClose();
  };

  return (
    <div className="modal-overlay palette-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="palette" role="dialog" aria-label="Pencarian cepat">
        <input
          ref={input} type="text" value={q} autoComplete="off" placeholder="Ketik untuk mencari halaman atau aksi..."
          onChange={(e) => { setQ(e.target.value); setIdx(0); }} onKeyDown={onKey}
        />
        <div className="palette-list">
          {list.map((x, i) => (
            <button key={x.t} type="button" className={`palette-item${i === idx ? ' on' : ''}`} onClick={() => run(i)}>
              <Icon name={x.i} /><span>{x.t}</span>
            </button>
          ))}
          {!list.length && <div className="palette-empty">Tidak ada yang cocok.</div>}
        </div>
      </div>
    </div>
  );
}
