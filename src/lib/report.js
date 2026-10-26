// Pembentuk isi laporan Excel (tanpa DOM, jadi bisa diuji). Hasilnya dipakai makeXlsx / downloadXlsx.
import { rankSoal, tingkatOf } from './score.js';

const r1 = (x) => (x == null || Number.isNaN(x) ? null : Math.round(x * 10) / 10);
const lbl = { info: 'Info', warn: 'Perhatian', good: 'Positif' };

/** Seluruh analisis satu ujian (hasil buildAnalysis) menjadi beberapa sheet. */
export function analysisSheets(d) {
  const o = d.overall, sm = o.sum;
  const sheets = [];

  const ring = [
    ['Keterangan', 'Nilai'],
    ['Ujian', d.assessment.name],
    ['Jumlah soal', d.assessment.total_questions],
    ['Jumlah peserta', sm.n],
    ['Rata-rata', r1(sm.avg)], ['Median', r1(sm.median)], ['Simpangan baku', r1(sm.sd)],
    ['Tertinggi', r1(sm.max)], ['Terendah', r1(sm.min)],
    ['Batas Lemah (%)', d.assessment.batas.lemah], ['Batas Kuat (%)', d.assessment.batas.kuat],
    [],
    ['Insight otomatis', ''],
    ...d.insights.map((i) => [lbl[i.type] || 'Info', i.text]),
  ];
  sheets.push({ name: 'Ringkasan', rows: ring, widths: [22, 90] });

  sheets.push({
    name: 'Per Cabang',
    widths: [18, 10, 12, 10, 10, 10, 16, 16],
    rows: [['Cabang', 'Peserta', 'Rata-rata', 'Median', 'Terendah', 'Tertinggi', 'Selisih vs semua', 'Peringkat cabang'],
      ...d.cabang.map((c) => [c.branch, c.sum.n, r1(c.sum.avg), r1(c.sum.median), r1(c.sum.min), r1(c.sum.max), r1(c.delta), c.rankCabang])],
  });

  if (o.materi.length) {
    sheets.push({
      name: 'Materi',
      widths: [26, 14, 14, 10, ...d.cabangList.map(() => 12), 10, 10, 10],
      rows: [['Materi', 'Soal', '% benar (semua)', 'Status', ...d.cabangList.map((c) => `${c} (%)`), 'Peserta lemah', 'Cukup', 'Kuat'],
        ...o.materi.map((m) => [m.nama, m.soal, r1(m.avg), m.status, ...m.byC.map(r1), m.lemah, m.cukup, m.kuat])],
    });
  }

  const soal = rankSoal(o.soal);
  if (soal.length) {
    sheets.push({
      name: 'Butir Soal',
      widths: [12, 8, 22, 12, 8, 8, 8, ...d.cabangList.map(() => 12), 10, 10, 10],
      rows: [['Peringkat kesulitan', 'Soal', 'Materi', '% benar', 'Benar', 'Salah', 'Kosong', ...d.cabangList.map((c) => `${c} (%)`), 'Tingkat', 'Daya beda', 'Kualitas'],
        ...soal.map((q) => [q.rk, q.no, q.materi, r1(q.pct), q.benar, q.salah, q.kosong, ...q.byC.map(r1), tingkatOf(q.pct), q.daya == null ? null : Math.round(q.daya * 100) / 100, q.dayaLabel || ''])],
    });
  }

  sheets.push({
    name: 'Per Individu',
    widths: [10, 26, 28, 14, 8, 12, 8, 8, 8, ...d.materi.map(() => 14), 28, 28],
    rows: [['Peringkat', 'Nama', 'Email', 'Cabang', 'Nilai', 'Peringkat cabang', 'Benar', 'Salah', 'Kosong', ...d.materi.map((m) => `${m.nama} (%)`), ...(d.materi.length ? ['Materi lemah', 'Materi kuat'] : [])],
      ...d.people.map((p) => [
        p.rank, p.name, p.email, p.branch, r1(p.score), p.rankC, p.correct, p.wrong, p.unanswered,
        ...p.materi.map((m) => r1(m.p)),
        ...(d.materi.length ? [
          d.materi.filter((m, k) => p.materi[k].s === 'Lemah').map((m) => m.nama).join('; '),
          d.materi.filter((m, k) => p.materi[k].s === 'Kuat').map((m) => m.nama).join('; '),
        ] : []),
      ])],
  });

  sheets.push({
    name: 'Perlu Perhatian',
    widths: [26, 28, 14, 8, 60],
    rows: [['Nama', 'Email', 'Cabang', 'Nilai', 'Alasan'], ...d.attention.map((p) => [p.name, p.email, p.branch, r1(p.score), p.reasons.join('; ')])],
  });
  return sheets;
}

/** Daftar peringkat satu ujian (halaman Ujian & Nilai). */
export function scoresSheets(detail) {
  const a = detail.assessment;
  const sheets = [{
    name: 'Peringkat',
    widths: [10, 26, 28, 14, 8, 8, 8, 8, 14],
    rows: [['Peringkat', 'Nama', 'Email', 'Cabang', 'Nilai', 'Benar', 'Salah', 'Kosong', 'Peringkat cabang'],
      ...detail.rows.map((r) => [r.rank, r.name, r.email, r.branch, r.score, r.correct, r.wrong, r.unanswered, r.rankC])],
  }];
  if (detail.materi.length) {
    sheets.push({
      name: 'Materi',
      widths: [26, 14, 12, ...detail.cabang.map(() => 12), 10, 10, 10],
      rows: [['Materi', 'Soal', 'Semua (%)', ...detail.cabang.map((c) => `${c.branch} (%)`), 'Lemah', 'Cukup', 'Kuat'],
        ...detail.materi.map((m) => [m.nama, m.soal, r1(m.all), ...m.byC.map(r1), m.lemah, m.cukup, m.kuat])],
    });
  }
  return { name: a.name, sheets };
}

/** Perbandingan dua ujian (hasil buildComparison). */
export function comparisonSheets(c) {
  return [
    {
      name: 'Ringkasan', widths: [34, 24],
      rows: [['Keterangan', 'Nilai'],
        ['Ujian sebelum (A)', c.a.name], ['Ujian sesudah (B)', c.b.name],
        ['Peserta A', c.a.n], ['Peserta B', c.b.n], ['Ikut keduanya', c.both],
        ['Rata-rata A (yang ikut keduanya)', r1(c.avgBothA)], ['Rata-rata B (yang ikut keduanya)', r1(c.avgBothB)], ['Rata-rata perubahan', r1(c.avgDelta)],
        ['Naik', c.up], ['Turun', c.down], ['Tetap', c.same]],
    },
    { name: 'Per Siswa', widths: [26, 28, 14, 10, 10, 10], rows: [['Nama', 'Email', 'Cabang', 'Nilai A', 'Nilai B', 'Perubahan'], ...c.pairs.map((p) => [p.name, p.email, p.branch, r1(p.a), r1(p.b), r1(p.delta)])] },
    { name: 'Per Cabang', widths: [18, 10, 10, 10, 12], rows: [['Cabang', 'Peserta', 'Rata-rata A', 'Rata-rata B', 'Perubahan'], ...c.cabang.map((x) => [x.branch, x.n, r1(x.avgA), r1(x.avgB), r1(x.avgDelta)])] },
    ...(c.materi.length ? [{ name: 'Materi', widths: [26, 12, 12, 12], rows: [['Materi', '% benar A', '% benar B', 'Perubahan'], ...c.materi.map((m) => [m.nama, r1(m.a), r1(m.b), r1(m.delta)])] }] : []),
  ];
}

/** Templat CSV (teks) untuk diunduh admin. */
export const SCORES_TEMPLATE = 'Nama,Email,Cabang,Nilai,Soal 1,Soal 2,Soal 3,Soal 4,Waktu Submit\nAni Lestari,ani@email.com,Bandung,75,BENAR,BENAR,BENAR,SALAH,2026-01-15 09:30:00\nBudi Santoso,budi@email.com,Cirebon,50,BENAR,SALAH,KOSONG,SALAH,2026-01-15 09:41:00\n';
export const USERS_TEMPLATE = 'name,email,password,branch,role\nAni Lestari,ani@email.com,rahasia123,Bandung,USER\nBudi Santoso,budi@email.com,rahasia123,Cirebon,USER\n';
