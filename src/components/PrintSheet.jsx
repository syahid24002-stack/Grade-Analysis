import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { StudentCard } from './StudentCard';

/**
 * Pratinjau rapor banyak siswa (satu siswa per halaman) lalu cetak atau simpan sebagai PDF.
 * cards: array props untuk StudentCard.
 */
export function PrintSheet({ title, cards, onClose }) {
  useEffect(() => {
    document.body.classList.add('printing-all');
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    window.scrollTo(0, 0);
    return () => { document.body.classList.remove('printing-all'); document.removeEventListener('keydown', onKey); };
  }, [onClose]);

  return createPortal(
    <div className="print-sheet">
      <div className="print-toolbar no-print">
        <div><b>{title}</b><div style={{ fontSize: 12.5, color: 'var(--muted)' }}>{cards.length} rapor · satu siswa per halaman. Di jendela cetak pilih "Simpan sebagai PDF".</div></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={() => window.print()}>Cetak / Simpan PDF</button>
          <button className="btn secondary" onClick={onClose}>Tutup</button>
        </div>
      </div>
      {cards.map((o, i) => (
        <div className="print-page" key={o.email || i}><StudentCard o={{ ...o, hideActions: true, id: undefined, onClose: undefined, framed: false }} /></div>
      ))}
    </div>,
    document.body,
  );
}
