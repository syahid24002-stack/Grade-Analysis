import { Ring } from './Ring';
import { AnBar, AnBadge, AnDelta, anColor, NoMateri } from './analysisUi';
import { f1, scoreColor } from '../lib/format';
import { rngSoal } from '../lib/score';

/**
 * Kartu analisis individu. Dipakai bersama oleh halaman admin dan halaman siswa agar tampilannya sama.
 * o: { id, framed, onClose, name, sub, score, correct, wrong, unanswered, rank, nAll, pctl, rankC, nC, avgC, avgAll,
 *      batas, materi: [{ nama, soal, b, n, p, s, br, all }], answers, mOf, showNoMateri }
 */
export function StudentCard({ o }) {
  const weak = o.materi.filter((m) => m.s === 'Lemah').sort((a, b) => a.p - b.p);
  const strong = o.materi.filter((m) => m.s === 'Kuat').sort((a, b) => b.p - a.p);
  const mOf = o.mOf || {};
  // Rencana belajar: materi yang belum Kuat, beserta nomor soal yang salah atau kosong, dari yang terlemah.
  const plan = o.answers
    ? o.materi
      .filter((m) => m.s !== 'Kuat')
      .sort((a, b) => a.p - b.p)
      .map((m) => ({ ...m, review: rngSoal(m.soal).filter((n) => o.answers.charAt(n - 1) !== 'B') }))
      .filter((m) => m.review.length)
    : [];
  return (
    <div
      id={o.id} className="card"
      style={{ marginBottom: 16, ...(o.framed ? { borderColor: 'var(--blue)', boxShadow: '0 0 0 3px var(--glow),var(--shadow)' } : {}) }}
    >
      <div className="print-only" style={{ marginBottom: 12, fontSize: 13 }}>
        <b>Agrade</b> · Laporan hasil asesmen · {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
          <Ring value={o.score} size={84} stroke={9} color={scoreColor(o.score)} big={f1(o.score)} small="nilai" />
          <div style={{ minWidth: 0 }}>
            <h4 style={{ margin: 0 }}>{o.name}</h4>
            <div style={{ color: 'var(--muted)', fontSize: 13 }}>{o.sub}</div>
          </div>
        </div>
        {o.hideActions ? null : (
          <div className="no-print" style={{ display: 'flex', gap: 8 }}>
            <button className="btn secondary small" onClick={() => window.print()}>Cetak / PDF</button>
            {o.onClose ? <button className="btn secondary small" onClick={o.onClose}>Tutup</button> : null}
          </div>
        )}
      </div>

      <div className="grid cols-4" style={{ margin: '14px 0' }}>
        <div className="card stat-card">
          <div className="num">{f1(o.score)}</div>
          <div className="label">Nilai<br /><small>Benar {o.correct} · Salah {o.wrong} · Kosong {o.unanswered}</small></div>
        </div>
        <div className="card stat-card">
          <div className="num">{o.rank}<small style={{ fontSize: 13 }}> / {o.nAll}</small></div>
          <div className="label">Peringkat keseluruhan{o.pctl != null ? <><br /><small>Di atas {f1(o.pctl)}% peserta</small></> : null}</div>
        </div>
        <div className="card stat-card">
          <div className="num">{o.rankC}<small style={{ fontSize: 13 }}> / {o.nC}</small></div>
          <div className="label">Peringkat di cabang</div>
        </div>
        <div className="card stat-card">
          <div className="num"><AnDelta x={o.score - o.avgC} /></div>
          <div className="label">
            Dibanding rata-rata cabang ({f1(o.avgC)})<br />
            <small>Dibanding rata-rata semua ({f1(o.avgAll)}): <AnDelta x={o.score - o.avgAll} /></small>
          </div>
        </div>
      </div>

      {o.materi.length ? (
        <>
          <div className="grid cols-2" style={{ marginBottom: 14 }}>
            <div className="an-box an-weak">
              <b>Perlu penguatan</b>
              <div>{weak.length ? weak.map((m) => <div key={m.nama} style={{ marginTop: 0 }}>{m.nama} ({f1(m.p)}%)</div>) : 'Tidak ada materi di kategori Lemah.'}</div>
            </div>
            <div className="an-box an-strong">
              <b>Sudah kuat</b>
              <div>{strong.length ? strong.map((m) => <div key={m.nama} style={{ marginTop: 0 }}>{m.nama} ({f1(m.p)}%)</div>) : 'Belum ada materi di kategori Kuat.'}</div>
            </div>
          </div>
          <h4 style={{ margin: '0 0 8px' }}>Kekuatan per materi</h4>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Materi</th><th>Soal</th><th>Benar</th><th>Persen benar</th><th></th><th>Rata-rata cabang</th><th>Rata-rata semua</th><th>Status</th></tr>
              </thead>
              <tbody>
                {o.materi.map((m) => (
                  <tr key={m.nama}>
                    <td>{m.nama}</td><td>{m.soal}</td><td>{m.b}/{m.n}</td><td>{f1(m.p)}</td>
                    <td style={{ minWidth: 90 }}><AnBar pct={m.p} color={anColor(m.s)} /></td>
                    <td>{f1(m.br)}</td><td>{f1(m.all)}</td><td><AnBadge st={m.s} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="an-note">Lemah &lt; {o.batas.lemah}% · Kuat ≥ {o.batas.kuat}%</div>
        </>
      ) : <NoMateri show={o.showNoMateri} />}

      {plan.length ? (
        <div style={{ marginTop: 14 }}>
          <h4 style={{ margin: '0 0 8px' }}>Rencana belajar</h4>
          <div className="card" style={{ background: 'var(--soft)', boxShadow: 'none' }}>
            <ol style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 6 }}>
              {plan.map((m) => (
                <li key={m.nama}>
                  <b>{m.nama}</b> ({f1(m.p)}% benar): bahas ulang soal <b>{m.review.join(', ')}</b>
                </li>
              ))}
            </ol>
            <div className="an-note">Urutan dari materi yang paling perlu dikuatkan. Soal yang dicantumkan adalah yang salah atau dikosongkan.</div>
          </div>
        </div>
      ) : null}

      {o.answers ? (
        <>
          <h4 style={{ marginTop: 14 }}>Jawaban per soal</h4>
          <div className="an-chips">
            {o.answers.split('').map((ch, i) => {
              const cls = ch === 'B' ? 'ok' : ch === 'S' ? 'bad' : 'nul';
              const mat = mOf[i + 1] && mOf[i + 1] !== '-' ? ` · ${mOf[i + 1]}` : '';
              return <span key={i} className={`an-chip ${cls}`} title={`Soal ${i + 1}${mat}`}>{i + 1}</span>;
            })}
          </div>
          <div className="an-note">Hijau benar · merah salah · abu-abu kosong. Arahkan kursor ke nomor untuk melihat materinya.</div>
        </>
      ) : null}
    </div>
  );
}
