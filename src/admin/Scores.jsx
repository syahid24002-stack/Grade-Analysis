import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFeedback } from '../lib/feedback';
import { supabase } from '../lib/supabase';
import { fetchAllScores, getAssessment, listAssessments, logActivity, fail } from '../lib/data';
import { buildDetail, parseScoresCsv, rngSoal, validateBatas, validateMateri } from '../lib/score';
import { downloadText, toCsv } from '../lib/csv';
import { f1 } from '../lib/format';

export function Scores({ intent, clearIntent }) {
  const { toast, busy } = useFeedback();
  const [list, setList] = useState(null);
  const [name, setName] = useState('');
  const [file, setFile] = useState(null);
  const [replace, setReplace] = useState(false);
  const [manage, setManage] = useState(null); // { detail, lemah, kuat, published, materi: [{nama, soal}] }
  const [search, setSearch] = useState('');
  const nameInput = useRef(null);
  const fileInput = useRef(null);

  const loadList = useCallback(async () => {
    try { setList(await listAssessments()); } catch (e) { setList([]); toast(e.message, 'error'); }
  }, [toast]);
  useEffect(() => { loadList(); }, [loadList]);

  useEffect(() => {
    if (intent === 'upload') { setTimeout(() => nameInput.current?.focus(), 80); clearIntent(); }
  }, [intent, clearIntent]);

  const open = useCallback(async (id) => {
    try {
      const [a, rows] = await busy('Memuat ujian...', () => Promise.all([getAssessment(id), fetchAllScores(id)]));
      const detail = buildDetail(a, rows);
      const as = detail.assessment;
      setManage({
        id, detail, lemah: as.batas.lemah, kuat: as.batas.kuat, published: as.published,
        materi: as.materi.length ? as.materi.map((m) => ({ nama: m.nama, soal: m.soal })) : [{ nama: '', soal: '' }],
      });
      setSearch('');
    } catch (e) {
      toast(e.message, 'error');
    }
  }, [busy, toast]);

  const upload = async () => {
    if (!file) return toast('Pilih file CSV dulu.', 'error');
    if (!name.trim()) return toast('Isi nama ujian.', 'error');
    try {
      const res = await busy('Mengunggah nilai...', async () => {
        const { rows, total } = parseScoresCsv(await file.text());
        const { data, error } = await supabase.rpc('import_scores', { p_name: name.trim(), p_total: total, p_rows: rows, p_replace: replace });
        if (error) fail(error);
        return data;
      });
      toast(`${res.participants} peserta tersimpan (${res.total_questions} soal).`, 'success');
      setName(''); setFile(null); setReplace(false);
      if (fileInput.current) fileInput.current.value = '';
      loadList();
      open(res.assessment_id);
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const remove = async (a) => {
    if (!window.confirm(`Hapus ujian "${a.name}" beserta semua nilainya?`)) return;
    const { error } = await supabase.from('assessments').delete().eq('id', a.id);
    if (error) return toast('Gagal menghapus ujian.', 'error');
    logActivity('ADMIN_DELETE_ASSESSMENT', { assessment_id: a.id, name: a.name });
    toast('Ujian dihapus', 'success');
    if (manage?.id === a.id) setManage(null);
    loadList();
  };

  const save = async () => {
    try {
      const total = manage.detail.assessment.total_questions;
      const b = validateBatas(manage.lemah, manage.kuat);
      const materi = validateMateri(manage.materi, total);
      const { error } = await supabase.from('assessments')
        .update({ lemah_pct: b.lemah, kuat_pct: b.kuat, published: manage.published, materi }).eq('id', manage.id);
      if (error) fail(error);
      logActivity('ADMIN_SAVE_ASSESSMENT', { assessment_id: manage.id, published: manage.published });
      toast('Tersimpan', 'success');
      loadList();
      open(manage.id);
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const exportCsv = () => {
    const rows = [['Peringkat', 'Nama', 'Email', 'Cabang', 'Nilai', 'Benar', 'Salah', 'Kosong']];
    manage.detail.rows.forEach((r) => rows.push([r.rank, r.name, r.email, r.branch, r.score, r.correct, r.wrong, r.unanswered]));
    downloadText('nilai.csv', toCsv(rows));
  };

  const setMateri = (i, k, v) => setManage((m) => ({ ...m, materi: m.materi.map((x, j) => (j === i ? { ...x, [k]: v } : x)) }));

  const missing = useMemo(() => {
    if (!manage) return [];
    const used = new Set();
    manage.materi.forEach((m) => rngSoal(m.soal).forEach((n) => used.add(n)));
    const miss = [];
    for (let k = 1; k <= manage.detail.assessment.total_questions; k++) if (!used.has(k)) miss.push(k);
    return miss;
  }, [manage]);

  const rows = useMemo(() => {
    if (!manage) return [];
    const s = search.toLowerCase();
    return manage.detail.rows.filter((r) => !s || `${r.name} ${r.branch}`.toLowerCase().includes(s));
  }, [manage, search]);

  const d = manage?.detail;

  return (
    <div>
      <div className="card" style={{ marginBottom: 16 }}>
        <h4>Unggah nilai (CSV)</h4>
        <p style={{ color: 'var(--muted)', fontSize: 13 }}>
          Kolom wajib: Nama, Email, Cabang, Nilai. Kolom "Soal 1…Soal N" (isi BENAR/SALAH/KOSONG) dipakai untuk analisis materi. Data ganda (email sama) dihitung sekali.
        </p>
        <div className="search-bar">
          <input ref={nameInput} type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama ujian, mis. Logika" />
          <input ref={fileInput} type="file" accept=".csv,text/csv" onChange={(e) => setFile(e.target.files[0] || null)} />
          <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} style={{ width: 'auto' }} /> Timpa data lama
          </label>
          <button className="btn" onClick={upload}>Unggah</button>
        </div>
      </div>

      <div className="card table-wrap" style={{ marginBottom: 16 }}>
        <table>
          <thead><tr><th>Ujian</th><th>Peserta</th><th>Soal</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {list === null ? <tr><td colSpan={5}>Memuat...</td></tr> : null}
            {list && !list.length ? <tr><td colSpan={5} style={{ color: 'var(--text-muted)' }}>Belum ada ujian. Unggah CSV nilai di atas.</td></tr> : null}
            {(list || []).map((a) => (
              <tr key={a.id}>
                <td>{a.name}</td><td>{a.participants}</td><td>{a.total_questions}</td><td>{a.published ? 'Terbit' : 'Draf'}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="btn secondary small" onClick={() => open(a.id)}>Kelola</button>{' '}
                  <button className="btn danger small" onClick={() => remove(a)}>Hapus</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {manage ? (
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <h4>{d.assessment.name} · {d.stats.n} peserta · rata-rata {f1(d.stats.avg)} · {d.assessment.total_questions} soal</h4>
            <div className="search-bar">
              <label>Lemah jika di bawah <input type="number" min="0" max="100" value={manage.lemah} onChange={(e) => setManage((m) => ({ ...m, lemah: e.target.value }))} style={{ width: 80, display: 'inline-block' }} /> %</label>
              <label>Kuat jika ≥ <input type="number" min="0" max="100" value={manage.kuat} onChange={(e) => setManage((m) => ({ ...m, kuat: e.target.value }))} style={{ width: 80, display: 'inline-block' }} /> %</label>
              <span style={{ color: 'var(--text-muted)', fontSize: 12.5 }}>(di antaranya: Cukup)</span>
            </div>
            <h4 style={{ marginTop: 12 }}>Pemetaan soal ke materi</h4>
            {manage.materi.map((m, i) => (
              <div className="search-bar" key={i}>
                <input type="text" placeholder="Nama materi" value={m.nama} onChange={(e) => setMateri(i, 'nama', e.target.value)} />
                <input type="text" placeholder="Soal, mis. 1-4, 18" value={m.soal} onChange={(e) => setMateri(i, 'soal', e.target.value)} />
                <button className="btn secondary small" onClick={() => setManage((x) => ({ ...x, materi: x.materi.filter((_, j) => j !== i) }))}>Hapus</button>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, margin: '8px 0' }}>
              <button className="btn secondary small" onClick={() => setManage((x) => ({ ...x, materi: [...x.materi, { nama: '', soal: '' }] }))}>+ Materi</button>
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
              {missing.length ? `Soal belum masuk materi: ${missing.join(', ')}` : 'Semua soal sudah dipetakan.'}
            </div>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10 }}>
              <input type="checkbox" checked={manage.published} onChange={(e) => setManage((m) => ({ ...m, published: e.target.checked }))} style={{ width: 'auto' }} /> Terbitkan hasil ke siswa
            </label>
            <button className="btn" style={{ marginTop: 12 }} onClick={save}>Simpan</button>
          </div>

          <div className="card table-wrap" style={{ marginBottom: 16 }}>
            <h4>Analisis per materi (rata-rata % benar)</h4>
            {!d.materi.length ? (
              <div style={{ color: 'var(--text-muted)', padding: 8 }}>Tentukan materi lalu klik Simpan untuk melihat analisis.</div>
            ) : (
              <>
                <table>
                  <thead>
                    <tr><th>Materi</th><th>Soal</th><th>Semua</th>{d.cabang.map((c) => <th key={c.branch}>{c.branch}</th>)}<th>Lemah</th><th>Cukup</th><th>Kuat</th></tr>
                  </thead>
                  <tbody>
                    {d.materi.map((m) => (
                      <tr key={m.nama}>
                        <td>{m.nama}</td><td>{m.soal}</td><td>{f1(m.all)}</td>
                        {m.byC.map((v, i) => <td key={i}>{f1(v)}</td>)}
                        <td>{m.lemah}</td><td>{m.cukup}</td><td>{m.kuat}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 12px' }}>
                  Jumlah peserta per status · Lemah &lt; {d.assessment.batas.lemah}% · Kuat ≥ {d.assessment.batas.kuat}%
                </div>
              </>
            )}
          </div>

          <div className="card table-wrap">
            <div className="search-bar">
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nama / cabang..." />
              <button className="btn secondary" onClick={exportCsv}>Ekspor CSV</button>
            </div>
            <table>
              <thead><tr><th>#</th><th>Nama</th><th>Email</th><th>Cabang</th><th>Nilai</th><th>Benar</th><th>Salah</th><th>Kosong</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.email}>
                    <td>{r.rank}</td><td>{r.name}</td><td>{r.email}</td><td>{r.branch}</td><td>{r.score}</td><td>{r.correct}</td><td>{r.wrong}</td><td>{r.unanswered}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
