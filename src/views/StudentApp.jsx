import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../lib/auth';
import { useFeedback } from '../lib/feedback';
import { useTheme } from '../lib/theme';
import { api } from '../lib/api';
import { f1, greeting, todayLong, firstName, scoreColor } from '../lib/format';
import { Icon, ThemeIcon } from '../components/Icon';
import { Ring } from '../components/Ring';
import { Skeleton } from '../components/ui';
import { StudentCard } from '../components/StudentCard';
import { TrendChart } from '../components/TrendChart';
import { buildBadges } from '../lib/badges';
import { ChangePasswordModal } from '../components/ChangePasswordModal';

export function StudentApp() {
  const { profile, signOut } = useAuth();
  const { toast, busy } = useFeedback();
  const { theme, toggleTheme } = useTheme();
  const [list, setList] = useState(null);
  const [result, setResult] = useState(null);
  const [showPw, setShowPw] = useState(false);

  const load = useCallback(async () => {
    try {
      setList(await api('my-assessments', { method: 'GET' }));
    } catch (e) {
      setList([]);
      toast(e.message, 'error');
    }
  }, [toast]);
  useEffect(() => { load(); }, [load]);

  // Urut dari ujian paling lama ke terbaru, hanya yang nilainya ditemukan.
  const trend = useMemo(() => (list || [])
    .filter((a) => a.my_score != null)
    .sort((x, y) => new Date(x.created_at) - new Date(y.created_at))
    .map((a) => ({ label: a.name, a: a.my_score, b: a.avg_all })), [list]);

  const badges = useMemo(() => buildBadges((list || [])
    .filter((a) => a.my_score != null)
    .sort((x, y) => new Date(x.created_at) - new Date(y.created_at))), [list]);

  const open = async (id) => {
    try {
      setResult(await busy('Memuat hasil...', () => api('my-result', { method: 'GET', query: { id } })));
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  return (
    <div id="page-user">
      <div className="topbar-user">
        <div className="user-who">
          <div className="brand-mark">A</div>
          <div style={{ lineHeight: 1.25, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile.name}</div>
            <div style={{ color: 'var(--muted)', fontSize: 12 }}>{profile.branch || '-'}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <button className="icon-btn" onClick={toggleTheme} title="Ganti tema"><ThemeIcon theme={theme} /></button>
          <button className="icon-btn" onClick={() => setShowPw(true)} title="Ubah password"><Icon name="lock" /></button>
          <button className="icon-btn" onClick={signOut} title="Keluar"><Icon name="logout" /></button>
        </div>
      </div>

      <div className="user-wrap">
        {result ? (
          <Detail d={result} onBack={() => setResult(null)} />
        ) : (
          <>
            <div className="hero">
              <div>
                <div className="hero-date">{todayLong()}</div>
                <h2>{greeting()}{firstName(profile.name) ? `, ${firstName(profile.name)}` : ''}</h2>
                <p>Hasil asesmen yang sudah diterbitkan muncul di sini.</p>
              </div>
            </div>
            {trend.length ? (
              <div className="card" style={{ marginBottom: 18 }}>
                <h4>Perkembangan nilaimu</h4>
                <TrendChart points={trend} aName="Nilaimu" bName="Rata-rata semua peserta" />
                {trend.length > 1 ? <div className="an-note">{trendNote(trend)}</div> : null}
              </div>
            ) : null}
            {badges.length ? (
              <>
                <h3 style={{ margin: '0 0 12px' }}>Pencapaian</h3>
                <div className="achievements">
                  {badges.map((b) => (
                    <div className="achv" key={b.key}><div className="medal">★</div><div><b>{b.title}</b><small>{b.text}</small></div></div>
                  ))}
                </div>
              </>
            ) : null}
            <h3 style={{ margin: '0 0 12px' }}>Hasil asesmen</h3>
            <div className="grid cols-2">
              {list === null ? <div className="card"><Skeleton lines={3} /></div> : null}
              {list && !list.length ? <div className="card" style={{ color: 'var(--muted)' }}>Belum ada hasil yang diumumkan.</div> : null}
              {(list || []).map((a) => {
                const has = a.my_score != null;
                return (
                  <div className="card assess-card" key={a.assessment_id}>
                    {has
                      ? <Ring value={a.my_score} size={76} stroke={8} color={scoreColor(a.my_score)} big={f1(a.my_score)} small="nilai" />
                      : <div className="stat-ico" style={{ width: 56, height: 56, borderRadius: 16 }}><Icon name="file" /></div>}
                    <div className="grow">
                      <h4>{a.name}</h4>
                      <div className="info">
                        {has ? <>Peringkat <strong>{a.my_rank}</strong> dari {a.participants} peserta</> : 'Nilaimu belum ditemukan di ujian ini.'}
                      </div>
                      <button className="btn small" onClick={() => open(a.assessment_id)}>Lihat hasil</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
      {showPw ? <ChangePasswordModal onClose={() => setShowPw(false)} /> : null}
    </div>
  );
}

function trendNote(t) {
  const last = t[t.length - 1], prev = t[t.length - 2];
  const diff = last.a - prev.a;
  if (Math.abs(diff) < 0.05) return `Nilai terakhirmu sama dengan ujian sebelumnya (${f1(last.a)}).`;
  return `Dibanding ujian sebelumnya, nilaimu ${diff > 0 ? 'naik' : 'turun'} ${f1(Math.abs(diff))} poin.`;
}

function Detail({ d, onBack }) {
  const [tab, setTab] = useState('all');
  const m = d.me;
  const rows = d.board.filter((r) => tab === 'all' || (m && r.branch === m.branch));
  const goMe = () => document.getElementById('myRow')?.scrollIntoView({ behavior: 'smooth', block: 'center' });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 10 }}>
        <h3 style={{ margin: 0 }}>{d.name}</h3>
        <button className="btn secondary small no-print" onClick={onBack}>Kembali</button>
      </div>

      {m ? (
        <StudentCard
          o={{
            name: m.name, sub: `Cabang ${m.branch}`, score: m.score, correct: m.correct, wrong: m.wrong, unanswered: m.unanswered,
            rank: m.rank, nAll: d.total, pctl: m.pctl, rankC: m.rankC, nC: m.nC, avgC: m.avgC, avgAll: d.avg_all, batas: d.batas,
            materi: d.materi.map((x) => ({ nama: x.nama, soal: x.soal, b: x.benar, n: x.n, p: x.pct, s: x.status, br: x.br, all: x.all })),
            answers: m.answers, mOf: d.soalMateri,
          }}
        />
      ) : (
        <div className="card" style={{ marginBottom: 16, color: 'var(--text-muted)' }}>
          Nilaimu tidak ditemukan pada ujian ini (dicocokkan lewat email atau nama). Peringkat tetap ditampilkan di bawah. Hubungi admin bila ini keliru.
        </div>
      )}

      <h4>Rata-rata nilai per cabang</h4>
      <div className="card" style={{ marginBottom: 16 }}>
        {d.cabang.map((c) => (
          <div key={c.branch} style={{ display: 'grid', gridTemplateColumns: '110px 1fr 50px', gap: 10, alignItems: 'center', padding: '5px 0', fontWeight: m && m.branch === c.branch ? 700 : 400 }}>
            <div>{c.branch}</div>
            <div style={{ height: 8, background: 'var(--soft)', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.min(100, c.avg)}%`, background: 'var(--blue)' }} />
            </div>
            <div style={{ textAlign: 'right' }}>{f1(c.avg)}</div>
          </div>
        ))}
      </div>

      <h4>Peringkat</h4>
      <div className="no-print" style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
        <button className={`btn small ${tab === 'all' ? '' : 'secondary'}`} onClick={() => setTab('all')}>Semua cabang</button>
        {m ? <button className={`btn small ${tab === 'c' ? '' : 'secondary'}`} onClick={() => setTab('c')}>Cabang saya</button> : null}
        {m ? <button className="btn small secondary" onClick={goMe}>Lihat posisiku</button> : null}
      </div>
      <div className="card table-wrap">
        <table>
          <thead><tr><th>#</th><th>Nama</th><th>Cabang</th><th>Nilai</th></tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} id={r.me ? 'myRow' : undefined} className={r.me ? 'is-me' : undefined}>
                <td>{tab === 'all' ? r.rank : r.rankC}</td><td>{r.name}</td><td>{r.branch}</td><td>{r.score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
