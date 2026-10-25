import { f1 } from '../lib/format';

export function AnBar({ pct, color }) {
  const v = pct == null ? 0 : Math.max(0, Math.min(100, pct));
  return <div className="an-bar"><div style={{ width: `${v}%`, background: color || 'var(--primary)' }} /></div>;
}

export const anColor = (st) => (st === 'Lemah' ? 'var(--danger)' : st === 'Kuat' ? 'var(--success)' : 'var(--warning)');
export const anLevelColor = (p) => (p < 30 ? 'var(--danger)' : p <= 70 ? 'var(--warning)' : 'var(--success)');

export function AnBadge({ st }) {
  if (!st) return '-';
  return <span className={`badge ${st === 'Lemah' ? 'LOCKED' : st === 'Kuat' ? 'ACTIVE' : 'DRAFT'}`}>{st}</span>;
}

export function AnLevel({ p }) {
  if (p == null) return '-';
  return p < 30 ? <span className="badge LOCKED">Sulit</span> : p <= 70 ? <span className="badge DRAFT">Sedang</span> : <span className="badge ACTIVE">Mudah</span>;
}

export function AnDelta({ x }) {
  if (x == null || Number.isNaN(x)) return '-';
  return <span style={{ color: x >= 0 ? 'var(--success)' : 'var(--danger)' }}>{x >= 0 ? '+' : '−'}{f1(Math.abs(x))}</span>;
}

export function SummaryCards({ sm }) {
  return (
    <div className="grid cols-4" style={{ marginBottom: 16 }}>
      <div className="card stat-card"><div className="num">{f1(sm.avg)}</div><div className="label">Rata-rata<br /><small>Median {f1(sm.median)}</small></div></div>
      <div className="card stat-card"><div className="num">{sm.n}</div><div className="label">Peserta</div></div>
      <div className="card stat-card"><div className="num">{f1(sm.max)}</div><div className="label">Tertinggi<br /><small>Terendah {f1(sm.min)}</small></div></div>
      <div className="card stat-card"><div className="num">{f1(sm.sd)}</div><div className="label">Simpangan baku<br /><small>sebaran nilai</small></div></div>
    </div>
  );
}

export function Dist({ bins }) {
  const mx = Math.max(1, ...bins.map((b) => b.n));
  return (
    <div className="an-dist">
      {bins.map((b) => (
        <div className="an-dist-col" key={b.from}>
          <div className="an-dist-n">{b.n || ''}</div>
          <div className="an-dist-bar" style={{ height: `${(b.n / mx) * 100}%` }} />
          <div className="an-dist-lbl">{f1(b.from)}</div>
        </div>
      ))}
    </div>
  );
}

export function NoMateri({ show }) {
  if (!show) return null;
  return (
    <div className="card" style={{ color: 'var(--text-muted)', marginBottom: 16 }}>
      Pemetaan soal ke materi belum diatur, jadi analisis kuat/lemah per materi belum tersedia. Buka <b>Ujian &amp; Nilai › Kelola</b>, isi materi, lalu Simpan.
    </div>
  );
}
