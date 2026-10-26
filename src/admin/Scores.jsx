import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFeedback } from '../lib/feedback';
import { supabase } from '../lib/supabase';
import { fetchAllScores, getAssessment, listAssessments, logActivity, fail } from '../lib/data';
import { buildDetail, normName, parseScoresCsv, rngSoal, validateBatas, validateMateri } from '../lib/score';
import { downloadText, toCsv } from '../lib/csv';
import { downloadXlsx } from '../lib/xlsx';
import { SCORES_TEMPLATE, scoresSheets } from '../lib/report';
import { f1 } from '../lib/format';
import { Dropzone, EmptyState, SkeletonRows, SortTh, useSort } from '../components/ui';

const muted = { color: 'var(--text-muted)' };
const baseName = (n) => n.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();

export function Scores({ intent, clearIntent }) {
  const { toast, busy, confirm } = useFeedback();
  const [list, setList] = useState(null);
  const [name, setName] = useState('');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null); // { rows, total, skipped, duplicates } atau { error }
  const [replace, setReplace] = useState(false);
  const [manage, setManage] = useState(null); // { id, detail, lemah, kuat, published, materi: [{nama, soal}] }
  const [search, setSearch] = useState('');
  const nameInput = useRef(null);

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
      setTimeout(() => document.getElementById('manage-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
    } catch (e) {
      toast(e.message, 'error');
    }
  }, [busy, toast]);

  const onFile = async (f) => {
    setFile(f);
    if (!name.trim()) setName(baseName(f.name));
    try {
      setPreview(parseScoresCsv(await f.text()));
    } catch (e) {
      setPreview({ error: e.message });
    }
  };

  const exists = useMemo(() => !!name.trim() && (list || []).some((a) => normName(a.name) === normName(name)), [list, name]);

  const upload = async () => {
    if (!file || !preview || preview.error) return toast('Pilih file CSV yang valid dulu.', 'error');
    if (!name.trim()) return toast('Isi nama ujian.', 'error');
    try {
      const res = await busy('Mengunggah nilai...', async () => {
        const { data, error } = await supabase.rpc('import_scores', { p_name: name.trim(), p_total: preview.total, p_rows: preview.rows, p_replace: replace });
        if (error) fail(error);
        return data;
      });
      toast(`${res.participants} peserta tersimpan (${res.total_questions} soal).`, 'success');
      setName(''); setFile(null); setPreview(null); setReplace(false);
      loadList();
      open(res.assessment_id);
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const remove = async (a) => {
    const ok = await confirm({
      title: 'Hapus ujian?', danger: true, okText: 'Hapus ujian',
      message: `Ujian "${a.name}" beserta ${a.participants} data nilainya akan dihapus permanen dan tidak bisa dikembalikan.`,
    });
    if (!ok) return;
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
  const exportXlsx = () => {
    const { name: n, sheets } = scoresSheets(manage.detail);
    downloadXlsx(`nilai-${n}.xlsx`, sheets);
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

  const filtered = useMemo(() => {
    if (!manage) return [];
    const s = search.toLowerCase();
    return manage.detail.rows.filter((r) => !s || `${r.name} ${r.branch} ${r.email}`.toLowerCase().includes(s));
  }, [manage, search]);

  const listRows = useMemo(() => (list || []).map((a) => ({ ...a, status: a.published ? 'Terbit' : 'Draf' })), [list]);
  const sortList = useSort(listRows, 'created_at', 'desc');
  const sortRows = useSort(filtered, 'rank', 'asc');
  const d = manage?.detail;

  return (
    <div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <h4 style={{ margin: 0 }}>Unggah nilai (CSV)</h4>
          <button className="btn secondary small" onClick={() => downloadText('templat-nilai.csv', `\uFEFF${SCORES_TEMPLATE}`)}>Unduh templat CSV</button>
        </div>
        <p style={{ color: 'var(--muted)', fontSize: 13 }}>
          Kolom wajib: Nama, Email, Cabang, Nilai. Kolom "Soal 1…Soal N" (isi BENAR/SALAH/KOSONG) dipakai untuk analisis materi dan butir soal. Email ganda dihitung sekali.
        </p>
        <Dropzone accept=".csv,text/csv" file={file} onFile={onFile} hint="Format .csv, pemisah koma atau titik koma" />

        {preview?.error ? <div className="preview-box bad">{preview.error}</div> : null}
        {preview && !preview.error ? (
          <div className="preview-box">
            <b>{preview.rows.length} peserta</b> terbaca dengan <b>{preview.total} soal</b>
            {preview.skipped ? <> · {preview.skipped} baris dilewati (email atau nilai kosong)</> : null}
            {preview.duplicates ? <> · {preview.duplicates} email ganda digabung</> : null}
            <div className="table-wrap" style={{ marginTop: 8 }}>
              <table>
                <thead><tr><th>Nama</th><th>Email</th><th>Cabang</th><th>Nilai</th><th>Benar</th><th>Salah</th><th>Kosong</th></tr></thead>
                <tbody>
                  {preview.rows.slice(0, 5).map((r) => <tr key={r.email}><td>{r.name}</td><td>{r.email}</td><td>{r.branch}</td><td>{r.score}</td><td>{r.correct}</td><td>{r.wrong}</td><td>{r.unanswered}</td></tr>)}
                </tbody>
              </table>
            </div>
            {preview.rows.length > 5 ? <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>…dan {preview.rows.length - 5} peserta lainnya</div> : null}
          </div>
        ) : null}

        <div className="search-bar" style={{ marginTop: 12, marginBottom: 0 }}>
          <input ref={nameInput} type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama ujian, mis. Logika" />
          <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} style={{ width: 'auto' }} /> Timpa data lama
          </label>
          <button className="btn" onClick={upload} disabled={!preview || !!preview.error}>Unggah</button>
        </div>
        {exists && !replace ? <div style={{ marginTop: 8, fontSize: 12.5, color: 'var(--warning)' }}>Ujian bernama sama sudah ada. Centang "Timpa data lama" bila ingin menggantinya.</div> : null}
      </div>

      <div className="card table-wrap" style={{ marginBottom: 16 }}>
        <table>
          <thead>
            <tr>
              <SortTh k="name" {...sortList}>Ujian</SortTh><SortTh k="participants" {...sortList}>Peserta</SortTh><SortTh k="total_questions" {...sortList}>Soal</SortTh>
              <SortTh k="avg_score" {...sortList}>Rata-rata</SortTh><SortTh k="status" {...sortList}>Status</SortTh><th />
            </tr>
          </thead>
          <tbody>
            {list === null ? <SkeletonRows cols={6} /> : null}
            {sortList.rows.map((a) => (
              <tr key={a.id}>
                <td>{a.name}</td><td>{a.participants}</td><td>{a.total_questions}</td><td>{f1(a.avg_score)}</td><td>{a.status}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="btn secondary small" onClick={() => open(a.id)}>Kelola</button>{' '}
                  <button className="btn danger small" onClick={() => remove(a)}>Hapus</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {list && !list.length ? <EmptyState icon="upload" title="Belum ada ujian" text="Unggah CSV nilai pertamamu di atas. Unduh templat bila belum punya formatnya." /> : null}
      </div>

      {manage ? (
        <div id="manage-panel">
          <div className="card" style={{ marginBottom: 16 }}>
            <h4>{d.assessment.name} · {d.stats.n} peserta · rata-rata {f1(d.stats.avg)} · {d.assessment.total_questions} soal</h4>
            <div className="search-bar">
              <label>Lemah jika di bawah <input type="number" min="0" max="100" value={manage.lemah} onChange={(e) => setManage((m) => ({ ...m, lemah: e.target.value }))} style={{ width: 80, display: 'inline-block' }} /> %</label>
              <label>Kuat jika ≥ <input type="number" min="0" max="100" value={manage.kuat} onChange={(e) => setManage((m) => ({ ...m, kuat: e.target.value }))} style={{ width: 80, display: 'inline-block' }} /> %</label>
              <span style={{ ...muted, fontSize: 12.5 }}>(di antaranya: Cukup)</span>
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
            <div style={{ fontSize: 12.5, ...muted }}>
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
              <div style={{ ...muted, padding: 8 }}>Tentukan materi lalu klik Simpan untuk melihat analisis.</div>
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
                <div style={{ fontSize: 12, ...muted, padding: '8px 12px' }}>
                  Jumlah peserta per status · Lemah &lt; {d.assessment.batas.lemah}% · Kuat ≥ {d.assessment.batas.kuat}%
                </div>
              </>
            )}
          </div>

          <div className="card table-wrap">
            <div className="search-bar">
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nama / cabang / email..." />
              <button className="btn secondary" onClick={exportCsv}>Ekspor CSV</button>
              <button className="btn" onClick={exportXlsx}>Unduh Excel</button>
            </div>
            <table>
              <thead>
                <tr>
                  <SortTh k="rank" {...sortRows}>#</SortTh><SortTh k="name" {...sortRows}>Nama</SortTh><SortTh k="email" {...sortRows}>Email</SortTh><SortTh k="branch" {...sortRows}>Cabang</SortTh>
                  <SortTh k="score" {...sortRows}>Nilai</SortTh><SortTh k="correct" {...sortRows}>Benar</SortTh><SortTh k="wrong" {...sortRows}>Salah</SortTh><SortTh k="unanswered" {...sortRows}>Kosong</SortTh>
                </tr>
              </thead>
              <tbody>
                {sortRows.rows.map((r) => (
                  <tr key={r.email}>
                    <td>{r.rank}</td><td>{r.name}</td><td>{r.email}</td><td>{r.branch}</td><td>{r.score}</td><td>{r.correct}</td><td>{r.wrong}</td><td>{r.unanswered}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!filtered.length ? <div style={{ ...muted, padding: 12 }}>Tidak ada yang cocok.</div> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
