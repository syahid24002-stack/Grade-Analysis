import { useEffect, useMemo, useState } from 'react';
import { useFeedback } from '../lib/feedback';
import { listAssessments, listPeople, scoresOfEmail } from '../lib/data';
import { f1 } from '../lib/format';
import { downloadText, toCsv } from '../lib/csv';
import { TrendChart } from '../components/TrendChart';
import { AnDelta } from '../components/analysisUi';

const muted = { color: 'var(--text-muted)' };

/** Riwayat satu siswa di semua ujian: grafik perkembangan dan tabel per ujian. */
export function History() {
  const { toast, busy } = useFeedback();
  const [people, setPeople] = useState(null);
  const [exams, setExams] = useState([]);
  const [q, setQ] = useState('');
  const [who, setWho] = useState(null);
  const [rows, setRows] = useState([]);

  useEffect(() => {
    Promise.all([listPeople(), listAssessments()]).then(
      ([p, a]) => { setPeople(p); setExams(a); },
      (e) => { setPeople([]); toast(e.message, 'error'); },
    );
  }, [toast]);

  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!people) return [];
    return people.filter((p) => !s || `${p.name} ${p.email}`.toLowerCase().includes(s)).slice(0, 50);
  }, [people, q]);

  const pick = async (p) => {
    try {
      const r = await busy('Memuat riwayat...', () => scoresOfEmail(p.email));
      const byId = Object.fromEntries(exams.map((a) => [a.id, a]));
      const list = r
        .filter((x) => byId[x.assessment_id])
        .map((x) => ({ ...x, exam: byId[x.assessment_id] }))
        .sort((a, b) => new Date(a.exam.created_at) - new Date(b.exam.created_at));
      setWho(p); setRows(list);
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const avg = rows.length ? rows.reduce((t, r) => t + Number(r.score), 0) / rows.length : null;
  const best = rows.length ? Math.max(...rows.map((r) => Number(r.score))) : null;
  const trend = rows.map((r) => ({ label: r.exam.name, a: Number(r.score), b: r.exam.avg_score }));

  const exportCsv = () => {
    const out = [['Ujian', 'Tanggal', 'Nilai', 'Rata-rata ujian', 'Benar', 'Salah', 'Kosong']];
    rows.forEach((r) => out.push([r.exam.name, new Date(r.exam.created_at).toLocaleDateString('id-ID'), r.score, r.exam.avg_score == null ? '' : Math.round(r.exam.avg_score * 10) / 10, r.correct, r.wrong, r.unanswered]));
    downloadText(`riwayat-${who.email}.csv`, toCsv(out));
  };

  return (
    <div>
      <div className="card" style={{ marginBottom: 16 }}>
        <h4>Cari siswa</h4>
        <div className="search-bar" style={{ marginBottom: 8 }}>
          <input type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ketik nama atau email..." />
        </div>
        {people === null ? <div style={muted}>Memuat…</div> : null}
        {people && !people.length ? <div style={muted}>Belum ada data nilai. Unggah CSV di menu Ujian &amp; Nilai.</div> : null}
        <div className="an-chips" style={{ gap: 8 }}>
          {matches.map((p) => (
            <button key={p.email} className={`btn small ${who?.email === p.email ? '' : 'secondary'}`} onClick={() => pick(p)}>
              {p.name} <small style={{ opacity: 0.75 }}>{p.branch}</small>
            </button>
          ))}
        </div>
        {people && people.length > matches.length && !q ? <div className="an-note">Menampilkan 50 pertama. Ketik nama untuk menyaring.</div> : null}
      </div>

      {who ? (
        <div>
          <div className="grid cols-4" style={{ marginBottom: 16 }}>
            <div className="card stat-card"><div className="num" style={{ fontSize: 18 }}>{who.name}</div><div className="label">{who.email}<br /><small>Cabang {who.branch}</small></div></div>
            <div className="card stat-card"><div className="num">{rows.length}</div><div className="label">Ujian diikuti</div></div>
            <div className="card stat-card"><div className="num">{f1(avg)}</div><div className="label">Rata-rata nilai</div></div>
            <div className="card stat-card"><div className="num">{f1(best)}</div><div className="label">Nilai tertinggi</div></div>
          </div>
          {rows.length ? (
            <>
              <div className="card" style={{ marginBottom: 16 }}>
                <h4>Perkembangan nilai</h4>
                <TrendChart points={trend} aName={who.name} bName="Rata-rata peserta ujian itu" />
              </div>
              <div className="card table-wrap">
                <div className="search-bar"><button className="btn secondary" onClick={exportCsv}>Ekspor CSV</button></div>
                <table>
                  <thead><tr><th>Ujian</th><th>Tanggal</th><th>Nilai</th><th>Selisih terhadap rata-rata</th><th>Benar</th><th>Salah</th><th>Kosong</th></tr></thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id}>
                        <td>{r.exam.name}</td><td>{new Date(r.exam.created_at).toLocaleDateString('id-ID')}</td><td><b>{f1(Number(r.score))}</b></td>
                        <td>{r.exam.avg_score == null ? '-' : <AnDelta x={Number(r.score) - r.exam.avg_score} />}</td>
                        <td>{r.correct}</td><td>{r.wrong}</td><td>{r.unanswered}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : <div className="card" style={muted}>Tidak ada nilai untuk siswa ini.</div>}
        </div>
      ) : null}
    </div>
  );
}
