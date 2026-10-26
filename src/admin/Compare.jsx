import { useEffect, useMemo, useState } from 'react';
import { useFeedback } from '../lib/feedback';
import { fetchAllScores, getAssessment, listAssessments } from '../lib/data';
import { buildComparison } from '../lib/score';
import { downloadXlsx } from '../lib/xlsx';
import { comparisonSheets } from '../lib/report';
import { f1 } from '../lib/format';
import { AnBar, AnDelta } from '../components/analysisUi';
import { EmptyState, Skeleton, SortTh, useSort } from '../components/ui';

const muted = { color: 'var(--text-muted)' };

/** Membandingkan dua ujian: siapa naik, siapa turun, dan perubahan per cabang dan materi. */
export function Compare() {
  const { toast, busy } = useFeedback();
  const [list, setList] = useState(null);
  const [aId, setAId] = useState('');
  const [bId, setBId] = useState('');
  const [cmp, setCmp] = useState(null);

  useEffect(() => {
    listAssessments().then((l) => {
      setList(l);
      if (l.length >= 2) { setBId(l[0].id); setAId(l[1].id); }
    }, (e) => { setList([]); toast(e.message, 'error'); });
  }, [toast]);

  useEffect(() => {
    if (!aId || !bId || aId === bId) { setCmp(null); return; }
    let cancelled = false;
    busy('Membandingkan...', async () => {
      const [a, ra, b, rb] = await Promise.all([getAssessment(aId), fetchAllScores(aId), getAssessment(bId), fetchAllScores(bId)]);
      return buildComparison(a, ra, b, rb);
    }).then((c) => { if (!cancelled) setCmp(c); }, (e) => toast(e.message, 'error'));
    return () => { cancelled = true; };
  }, [aId, bId, busy, toast]);

  const sorter = useSort(cmp?.pairs || [], 'delta', 'desc');
  const maxBin = useMemo(() => Math.max(1, ...(cmp?.bins || []).map((b) => b.n)), [cmp]);

  if (list === null) return <div className="card"><Skeleton lines={4} /></div>;
  if (list.length < 2) {
    return <div className="card"><EmptyState icon="chart" title="Butuh minimal dua ujian" text="Unggah nilai untuk dua ujian atau lebih di menu Ujian & Nilai, lalu bandingkan di sini." /></div>;
  }

  const opt = (a) => <option key={a.id} value={a.id}>{a.name} ({a.participants} peserta)</option>;
  const best = cmp?.pairs.slice(0, 5).filter((p) => p.delta > 0.05) || [];
  const worst = [...(cmp?.pairs || [])].reverse().slice(0, 5).filter((p) => p.delta < -0.05);

  return (
    <div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="search-bar" style={{ marginBottom: 0 }}>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 1, minWidth: 220 }}>Sebelum
            <select value={aId} onChange={(e) => setAId(e.target.value)}>{list.map(opt)}</select>
          </label>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 1, minWidth: 220 }}>Sesudah
            <select value={bId} onChange={(e) => setBId(e.target.value)}>{list.map(opt)}</select>
          </label>
          {cmp ? <button className="btn" onClick={() => downloadXlsx(`perbandingan-${cmp.a.name}-vs-${cmp.b.name}.xlsx`, comparisonSheets(cmp))}>Unduh Excel</button> : null}
        </div>
        {aId === bId ? <div style={{ marginTop: 8, fontSize: 12.5, color: 'var(--warning)' }}>Pilih dua ujian yang berbeda.</div> : null}
      </div>

      {cmp && !cmp.both ? (
        <div className="card"><EmptyState icon="users" title="Tidak ada peserta yang sama" text="Peserta dicocokkan lewat email. Tidak ada email yang ikut kedua ujian ini." /></div>
      ) : null}

      {cmp && cmp.both ? (
        <>
          <div className="grid cols-4" style={{ marginBottom: 16 }}>
            <div className="card stat-card"><div className="num">{cmp.both}</div><div className="label">Ikut keduanya<br /><small>{cmp.a.n} di A · {cmp.b.n} di B</small></div></div>
            <div className="card stat-card"><div className="num">{f1(cmp.avgBothA)}</div><div className="label">Rata-rata sebelum</div></div>
            <div className="card stat-card"><div className="num">{f1(cmp.avgBothB)}</div><div className="label">Rata-rata sesudah</div></div>
            <div className="card stat-card"><div className="num"><AnDelta x={cmp.avgDelta} /></div><div className="label">Perubahan rata-rata<br /><small>{cmp.up} naik · {cmp.down} turun · {cmp.same} tetap</small></div></div>
          </div>

          <div className="grid cols-2" style={{ marginBottom: 16 }}>
            <div className="card">
              <h4>Sebaran perubahan nilai</h4>
              {cmp.bins.map((b, i) => (
                <div className="delta-bar" key={b.label}>
                  <div>{b.label}</div><AnBar pct={(b.n / maxBin) * 100} color={i < 3 ? 'var(--danger)' : i === 3 ? 'var(--warning)' : 'var(--success)'} /><div style={{ textAlign: 'right' }}>{b.n}</div>
                </div>
              ))}
            </div>
            <div className="card">
              <h4>Paling meningkat</h4>
              {best.length ? best.map((p) => <div key={p.email} className="delta-bar" style={{ gridTemplateColumns: '1fr auto' }}><span>{p.name} <small style={muted}>{p.branch}</small></span><AnDelta x={p.delta} /></div>) : <div style={muted}>Tidak ada yang naik.</div>}
              <h4 style={{ marginTop: 14 }}>Paling menurun</h4>
              {worst.length ? worst.map((p) => <div key={p.email} className="delta-bar" style={{ gridTemplateColumns: '1fr auto' }}><span>{p.name} <small style={muted}>{p.branch}</small></span><AnDelta x={p.delta} /></div>) : <div style={muted}>Tidak ada yang turun.</div>}
            </div>
          </div>

          <div className="grid cols-2" style={{ marginBottom: 16 }}>
            <div className="card table-wrap">
              <h4>Per cabang</h4>
              <table>
                <thead><tr><th>Cabang</th><th>Peserta</th><th>Sebelum</th><th>Sesudah</th><th>Perubahan</th></tr></thead>
                <tbody>{cmp.cabang.map((c) => <tr key={c.branch}><td>{c.branch}</td><td>{c.n}</td><td>{f1(c.avgA)}</td><td>{f1(c.avgB)}</td><td><AnDelta x={c.avgDelta} /></td></tr>)}</tbody>
              </table>
            </div>
            {cmp.materi.length ? (
              <div className="card table-wrap">
                <h4>Per materi (% benar)</h4>
                <table>
                  <thead><tr><th>Materi</th><th>Sebelum</th><th>Sesudah</th><th>Perubahan</th></tr></thead>
                  <tbody>{cmp.materi.map((m) => <tr key={m.nama}><td>{m.nama}</td><td>{f1(m.a)}</td><td>{f1(m.b)}</td><td><AnDelta x={m.delta} /></td></tr>)}</tbody>
                </table>
              </div>
            ) : <div className="card" style={muted}>Materi belum dipetakan dengan nama yang sama di kedua ujian, jadi perbandingan materi tidak tersedia.</div>}
          </div>

          <div className="card table-wrap">
            <h4>Semua peserta</h4>
            <table>
              <thead>
                <tr><SortTh k="name" {...sorter}>Nama</SortTh><SortTh k="branch" {...sorter}>Cabang</SortTh><SortTh k="a" {...sorter}>Sebelum</SortTh><SortTh k="b" {...sorter}>Sesudah</SortTh><SortTh k="delta" {...sorter}>Perubahan</SortTh></tr>
              </thead>
              <tbody>
                {sorter.rows.map((p) => <tr key={p.email}><td>{p.name}</td><td>{p.branch}</td><td>{f1(p.a)}</td><td>{f1(p.b)}</td><td><AnDelta x={p.delta} /></td></tr>)}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  );
}
