import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFeedback } from '../lib/feedback';
import { fetchAllScores, getAssessment, listAssessments } from '../lib/data';
import { buildAnalysis } from '../lib/score';
import { downloadText, toCsv } from '../lib/csv';
import { f1 } from '../lib/format';
import { AnBar, AnBadge, AnDelta, AnLevel, Dist, NoMateri, SummaryCards, anColor, anLevelColor } from '../components/analysisUi';
import { StudentCard } from '../components/StudentCard';

const muted = { color: 'var(--text-muted)' };

export function Analysis() {
  const { toast, busy } = useFeedback();
  const [list, setList] = useState(null);
  const [id, setId] = useState('');
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('all');
  const [branch, setBranch] = useState('');
  const [student, setStudent] = useState('');
  const [q, setQ] = useState('');
  const [pBranch, setPBranch] = useState('');

  useEffect(() => {
    listAssessments().then((l) => { setList(l); if (l.length) setId(l[0].id); }, (e) => { setList([]); toast(e.message, 'error'); });
  }, [toast]);

  const load = useCallback(async (aid) => {
    if (!aid) return;
    try {
      const d = await busy('Menganalisis...', async () => {
        const [a, rows] = await Promise.all([getAssessment(aid), fetchAllScores(aid)]);
        return buildAnalysis(a, rows);
      });
      setData(d); setBranch(d.cabangList[0] || ''); setStudent(''); setQ(''); setPBranch('');
    } catch (e) {
      toast(e.message, 'error');
    }
  }, [busy, toast]);
  useEffect(() => { load(id); }, [id, load]);

  const pick = (email, switchTab) => {
    if (switchTab) setTab('p');
    setStudent(email);
    setTimeout(() => document.getElementById('anDetail')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  if (list === null) return <div className="card" style={muted}>Memuat…</div>;
  if (!list.length) return <div className="card" style={muted}>Belum ada ujian. Unggah CSV nilai di menu Ujian &amp; Nilai.</div>;

  return (
    <div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="search-bar" style={{ marginBottom: 0 }}>
          <select value={id} onChange={(e) => setId(e.target.value)}>
            {list.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.participants} peserta)</option>)}
          </select>
          <button className="btn secondary" onClick={() => load(id)}>Muat ulang</button>
        </div>
      </div>

      {data ? (
        <div>
          <div className="an-tabs">
            <button className={`btn small ${tab === 'all' ? '' : 'secondary'}`} onClick={() => setTab('all')}>Keseluruhan</button>
            <button className={`btn small ${tab === 'c' ? '' : 'secondary'}`} onClick={() => setTab('c')}>Per cabang</button>
            <button className={`btn small ${tab === 'p' ? '' : 'secondary'}`} onClick={() => setTab('p')}>Per individu</button>
          </div>
          {tab === 'all' ? <OverallTab d={data} /> : null}
          {tab === 'c' ? <BranchTab d={data} branch={branch} setBranch={setBranch} onStudent={(e) => pick(e, true)} /> : null}
          {tab === 'p' ? (
            <PeopleTab d={data} student={student} onPick={(e) => pick(e, false)} q={q} setQ={setQ} pBranch={pBranch} setPBranch={setPBranch} />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/* ---------------- Tab 1: keseluruhan ---------------- */

function OverallTab({ d }) {
  const o = d.overall;
  const ms = useMemo(() => [...o.materi].sort((x, y) => x.avg - y.avg), [o.materi]);
  return (
    <>
      <h4>{d.assessment.name}</h4>
      <SummaryCards sm={o.sum} />
      <NoMateri show={!d.materi.length} />
      <div className="grid cols-2" style={{ marginBottom: 16 }}>
        <div className="card"><h4>Sebaran nilai</h4><Dist bins={o.dist} /><div className="an-note">Jumlah peserta per rentang nilai</div></div>
        <div className="card">
          <h4>Rata-rata per cabang</h4>
          {o.cabang.map((c) => (
            <div className="an-row" key={c.branch}>
              <div>{c.branch} <small style={muted}>({c.n})</small></div><AnBar pct={c.avg} /><div className="an-val">{f1(c.avg)}</div>
            </div>
          ))}
        </div>
      </div>

      {o.materi.length ? (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <h4>Materi: dari terlemah ke terkuat</h4>
            {ms.map((m) => (
              <div className="an-row an-row-wide" key={m.nama}>
                <div>{m.nama} <small style={muted}>soal {m.soal}</small></div><AnBar pct={m.avg} color={anColor(m.status)} /><div className="an-val">{f1(m.avg)}%</div>
              </div>
            ))}
            <div className="an-note">Lemah &lt; {d.assessment.batas.lemah}% · Kuat ≥ {d.assessment.batas.kuat}% (rata-rata % benar seluruh peserta)</div>
          </div>
          <div className="card table-wrap" style={{ marginBottom: 16 }}>
            <h4>Rincian materi × cabang (% benar)</h4>
            <table>
              <thead><tr><th>Materi</th><th>Semua</th>{d.cabangList.map((c) => <th key={c}>{c}</th>)}<th>Peserta lemah</th><th>Cukup</th><th>Kuat</th></tr></thead>
              <tbody>
                {o.materi.map((m) => (
                  <tr key={m.nama}>
                    <td>{m.nama}</td><td><b>{f1(m.avg)}</b></td>{m.byC.map((v, i) => <td key={i}>{f1(v)}</td>)}<td>{m.lemah}</td><td>{m.cukup}</td><td>{m.kuat}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
      <SoalOverall d={d} />
    </>
  );
}

/** Peringkat 1 = soal tersulit (persen benar terendah) sampai peringkat terakhir = termudah. */
function rankSoal(list) {
  const s = list.filter((q) => q.pct != null).sort((x, y) => x.pct - y.pct || x.no - y.no);
  return s.map((q, i) => ({ ...q, rk: i + 1 }));
}

function SoalOverall({ d }) {
  const o = d.overall;
  const list = useMemo(() => rankSoal(o.soal), [o.soal]);
  if (!list.length) return null;
  return (
    <div className="card table-wrap" style={{ marginBottom: 16 }}>
      <h4>Peringkat kesulitan soal (1 sampai {list.length})</h4>
      <div className="an-note" style={{ marginBottom: 8 }}>
        Peringkat 1 = soal tersulit (persen benar paling rendah), peringkat {list.length} = soal termudah. Sulit &lt; 30% · Sedang 30–70% · Mudah &gt; 70% benar. Soal yang dikosongkan dihitung tidak benar.
      </div>
      <div className="an-scroll">
        <table>
          <thead>
            <tr><th>Peringkat</th><th>Soal</th><th>Materi</th><th>Persen benar</th><th></th><th>Benar</th><th>Salah</th><th>Kosong</th>{d.cabangList.map((c) => <th key={c}>{c} (%)</th>)}<th>Tingkat</th></tr>
          </thead>
          <tbody>
            {list.map((q) => (
              <tr key={q.no}>
                <td><b>{q.rk}</b></td><td>{q.no}</td><td>{q.materi}</td><td>{f1(q.pct)}%</td>
                <td style={{ minWidth: 90 }}><AnBar pct={q.pct} color={anLevelColor(q.pct)} /></td>
                <td>{q.benar}</td><td>{q.salah}</td><td>{q.kosong}</td>{q.byC.map((v, i) => <td key={i}>{f1(v)}</td>)}<td><AnLevel p={q.pct} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------------- Tab 2: per cabang ---------------- */

function BranchTab({ d, branch, setBranch, onStudent }) {
  if (!d.cabang.length) return <div className="card">Belum ada data cabang.</div>;
  const c = d.cabang.find((x) => x.branch === branch) || d.cabang[0];
  const o = d.overall;
  const sorted = [...c.materi].sort((x, y) => x.avg - y.avg);
  const weak = sorted.slice(0, 3);
  const strong = sorted.slice(-3).reverse();

  return (
    <>
      <div className="an-tabs">
        {d.cabang.map((x) => (
          <button key={x.branch} className={`btn small ${x.branch === c.branch ? '' : 'secondary'}`} onClick={() => setBranch(x.branch)}>{x.branch}</button>
        ))}
      </div>
      <h4>Cabang {c.branch} · peringkat {c.rankCabang} dari {d.cabang.length} cabang</h4>
      <SummaryCards sm={c.sum} />
      <div className="card" style={{ marginBottom: 16 }}>
        Rata-rata cabang <b>{f1(c.sum.avg)}</b> dibanding rata-rata semua <b>{f1(o.sum.avg)}</b> (<AnDelta x={c.delta} />).{' '}
        {c.top.length ? `Nilai tertinggi: ${c.top.map((t) => `${t.name} (${f1(t.score)})`).join(', ')}.` : ''}
      </div>
      <NoMateri show={!d.materi.length} />
      <div className="grid cols-2" style={{ marginBottom: 16 }}>
        <div className="card"><h4>Sebaran nilai cabang</h4><Dist bins={c.dist} /><div className="an-note">Jumlah peserta per rentang nilai</div></div>
        {c.materi.length ? (
          <div className="card">
            <h4>Ringkasan materi cabang</h4>
            <div style={{ marginBottom: 8 }}><b>Terlemah:</b> {weak.map((m) => `${m.nama} (${f1(m.avg)}%)`).join(', ')}</div>
            <div><b>Terkuat:</b> {strong.map((m) => `${m.nama} (${f1(m.avg)}%)`).join(', ')}</div>
          </div>
        ) : <div />}
      </div>
      {c.materi.length ? (
        <div className="card table-wrap" style={{ marginBottom: 16 }}>
          <h4>Materi di cabang {c.branch}</h4>
          <table>
            <thead><tr><th>Materi</th><th>% benar</th><th>Selisih terhadap semua</th><th>Status</th><th>Peserta lemah</th><th>Cukup</th><th>Kuat</th></tr></thead>
            <tbody>
              {c.materi.map((m) => (
                <tr key={m.nama}><td>{m.nama}</td><td>{f1(m.avg)}</td><td><AnDelta x={m.delta} /></td><td><AnBadge st={m.status} /></td><td>{m.lemah}</td><td>{m.cukup}</td><td>{m.kuat}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <BranchPeople d={d} c={c} onStudent={onStudent} />
      <SoalBranch d={d} c={c} />
    </>
  );
}

/** Siswa kuat dan lemah di tiap materi, serta kekuatan dan kelemahan tiap siswa (satu cabang). */
function BranchPeople({ d, c, onStudent }) {
  if (!d.materi.length) return null;
  const list = d.people.filter((p) => p.branch === c.branch);
  const none = <span style={muted}>Tidak ada</span>;
  const names = (arr, i) => (arr.length
    ? arr.map((p, k) => <span key={p.email}>{k ? ', ' : ''}{p.name} <small>({f1(p.materi[i].p)}%)</small></span>)
    : none);
  const mat = (p, st) => {
    const r = d.materi.map((m, i) => (p.materi[i].s === st ? { m, i } : null)).filter(Boolean);
    return r.length ? r.map(({ m, i }, k) => <span key={m.nama}>{k ? ', ' : ''}{m.nama} <small>({f1(p.materi[i].p)}%)</small></span>) : none;
  };
  return (
    <>
      <div className="card table-wrap" style={{ marginBottom: 16 }}>
        <h4>Siswa yang kuat dan lemah di tiap materi</h4>
        <div className="an-note" style={{ marginBottom: 8 }}>
          Kuat ≥ {d.assessment.batas.kuat}% · Lemah &lt; {d.assessment.batas.lemah}% (persen benar siswa pada materi itu). Siswa berstatus Cukup tidak ditampilkan.
        </div>
        <table>
          <thead><tr><th>Materi</th><th>Siswa kuat</th><th>Siswa lemah</th></tr></thead>
          <tbody>
            {d.materi.map((m, i) => {
              const kuat = list.filter((p) => p.materi[i].s === 'Kuat').sort((x, y) => y.materi[i].p - x.materi[i].p);
              const lemah = list.filter((p) => p.materi[i].s === 'Lemah').sort((x, y) => x.materi[i].p - y.materi[i].p);
              return (
                <tr key={m.nama}>
                  <td style={{ minWidth: 130 }}><b>{m.nama}</b><br /><small style={muted}>soal {m.soal}</small></td>
                  <td style={{ minWidth: 240 }}><b style={{ color: 'var(--success)' }}>{kuat.length} siswa</b><br />{names(kuat, i)}</td>
                  <td style={{ minWidth: 240 }}><b style={{ color: 'var(--danger)' }}>{lemah.length} siswa</b><br />{names(lemah, i)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="card table-wrap" style={{ marginBottom: 16 }}>
        <h4>Kekuatan dan kelemahan tiap siswa di cabang {c.branch}</h4>
        <div className="an-scroll">
          <table>
            <thead><tr><th>Peringkat di cabang</th><th>Nama</th><th>Nilai</th><th>Kuat di materi</th><th>Lemah di materi</th><th></th></tr></thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.email}>
                  <td>{p.rankC}</td><td>{p.name}</td><td>{f1(p.score)}</td>
                  <td style={{ minWidth: 200 }}>{mat(p, 'Kuat')}</td><td style={{ minWidth: 200 }}>{mat(p, 'Lemah')}</td>
                  <td><button className="btn secondary small" onClick={() => onStudent(p.email)}>Detail</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function SoalBranch({ d, c }) {
  const idx = d.cabangList.indexOf(c.branch);
  const list = useMemo(() => rankSoal(d.overall.soal.map((q) => ({ no: q.no, materi: q.materi, pct: q.byC[idx], all: q.pct }))), [d, idx]);
  if (!list.length) return null;
  return (
    <div className="card table-wrap" style={{ marginBottom: 16 }}>
      <h4>Peringkat kesulitan soal di cabang {c.branch} (1 sampai {list.length})</h4>
      <div className="an-note" style={{ marginBottom: 8 }}>
        Peringkat 1 = soal tersulit bagi peserta cabang ini. Sulit &lt; 30% · Sedang 30–70% · Mudah &gt; 70% benar.
      </div>
      <div className="an-scroll">
        <table>
          <thead>
            <tr><th>Peringkat</th><th>Soal</th><th>Materi</th><th>Persen benar cabang</th><th></th><th>Persen benar semua</th><th>Selisih terhadap semua</th><th>Tingkat</th></tr>
          </thead>
          <tbody>
            {list.map((q) => (
              <tr key={q.no}>
                <td><b>{q.rk}</b></td><td>{q.no}</td><td>{q.materi}</td><td>{f1(q.pct)}%</td>
                <td style={{ minWidth: 90 }}><AnBar pct={q.pct} color={anLevelColor(q.pct)} /></td>
                <td>{f1(q.all)}%</td><td><AnDelta x={q.pct - q.all} /></td><td><AnLevel p={q.pct} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------------- Tab 3: per individu ---------------- */

function PeopleTab({ d, student, onPick, q, setQ, pBranch, setPBranch }) {
  const p = d.people.find((x) => x.email === student);
  const cab = p ? d.cabang.find((c) => c.branch === p.branch) : null;
  const s = q.toLowerCase();
  const list = d.people.filter((x) => (!pBranch || x.branch === pBranch) && (!s || `${x.name} ${x.email}`.toLowerCase().includes(s)));

  const mOf = {};
  d.overall.soal.forEach((x) => { mOf[x.no] = x.materi; });

  const exportPeople = () => {
    const head = ['Peringkat', 'Nama', 'Email', 'Cabang', 'Nilai', 'Peringkat Cabang', 'Benar', 'Salah', 'Kosong']
      .concat(d.materi.map((m) => `${m.nama} (%)`))
      .concat(d.materi.length ? ['Materi Lemah', 'Materi Kuat'] : []);
    const rows = [head];
    d.people.forEach((x) => {
      const r = [x.rank, x.name, x.email, x.branch, x.score, x.rankC, x.correct, x.wrong, x.unanswered].concat(x.materi.map((m) => Math.round(m.p * 10) / 10));
      if (d.materi.length) {
        const names = (st) => d.materi.filter((m, k) => x.materi[k].s === st).map((m) => m.nama).join('; ');
        r.push(names('Lemah'), names('Kuat'));
      }
      rows.push(r);
    });
    downloadText('analisis-individu.csv', toCsv(rows));
  };

  return (
    <>
      {p ? (
        <StudentCard
          o={{
            id: 'anDetail', framed: true, onClose: () => onPick(''), name: p.name, sub: `${p.email} · Cabang ${p.branch}`,
            score: p.score, correct: p.correct, wrong: p.wrong, unanswered: p.unanswered, rank: p.rank, nAll: d.overall.sum.n, pctl: p.pctl,
            rankC: p.rankC, nC: p.nC, avgC: p.avgC, avgAll: d.overall.sum.avg, batas: d.assessment.batas,
            materi: d.materi.map((m, i) => ({
              nama: m.nama, soal: m.soal, b: p.materi[i].b, n: p.materi[i].n, p: p.materi[i].p, s: p.materi[i].s,
              br: cab ? cab.materi[i].avg : null, all: d.overall.materi[i].avg,
            })),
            answers: p.answers, mOf, showNoMateri: !d.materi.length,
          }}
        />
      ) : null}
      <div className="card table-wrap">
        <div className="search-bar">
          <input type="text" placeholder="Cari nama / email..." value={q} onChange={(e) => setQ(e.target.value)} />
          <select value={pBranch} onChange={(e) => setPBranch(e.target.value)}>
            <option value="">Semua cabang</option>
            {d.cabangList.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <button className="btn secondary" onClick={exportPeople}>Ekspor CSV</button>
        </div>
        <table>
          <thead><tr><th>#</th><th>Nama</th><th>Cabang</th><th>Nilai</th><th>Peringkat cabang</th><th>Materi lemah</th><th>Materi kuat</th><th></th></tr></thead>
          <tbody>
            {list.map((x) => (
              <tr key={x.email} className={x.email === student ? 'is-me' : undefined}>
                <td>{x.rank}</td><td>{x.name}</td><td>{x.branch}</td><td>{f1(x.score)}</td><td>{x.rankC}/{x.nC}</td>
                <td>{d.materi.length ? x.materi.filter((m) => m.s === 'Lemah').length : '-'}</td>
                <td>{d.materi.length ? x.materi.filter((m) => m.s === 'Kuat').length : '-'}</td>
                <td><button className="btn secondary small" onClick={() => onPick(x.email)}>Detail</button></td>
              </tr>
            ))}
            {!list.length ? <tr><td colSpan={8} style={muted}>Tidak ada yang cocok.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
