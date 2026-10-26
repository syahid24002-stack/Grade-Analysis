// Logika nilai: impor CSV, pemetaan soal ke materi, analisis admin, dan hasil siswa.
// Berkas ini murni JavaScript (tanpa DOM) dan dipakai DUA tempat:
//   1. browser (halaman admin), dan
//   2. fungsi server /api (hasil siswa), supaya nama peserta lain disamarkan di server.
//
// Bentuk data (sama dengan tabel Supabase):
//   assessment = { id, name, total_questions, lemah_pct, kuat_pct, published, materi: [{ nama, soal: [1,2,3] }] }
//   score row  = { email, name, branch, score, correct, wrong, unanswered, answers }

import { parseCsv } from './csv.js';
import { f1 } from './format.js';

/* ---------------- Pembantu ---------------- */

/** "1-4, 18" -> [1,2,3,4,18] */
export function rngSoal(txt) {
  const out = [];
  String(txt ?? '').split(/[,;]/).forEach((p) => {
    const m = p.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!m) return;
    for (let a = +m[1], b = +(m[2] || m[1]); a <= b; a++) out.push(a);
  });
  return out;
}

/** [1,2,3,4,18] -> "1-4, 18" */
export function fmtSoal(arr) {
  const a = [...arr].sort((x, y) => x - y);
  const out = [];
  for (let i = 0; i < a.length; i++) {
    let j = i;
    while (j + 1 < a.length && a[j + 1] === a[j] + 1) j++;
    out.push(j > i ? `${a[i]}-${a[j]}` : `${a[i]}`);
    i = j;
  }
  return out.join(', ');
}

export const normName = (s) => String(s ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
export const materiOf = (a) => (Array.isArray(a?.materi) ? a.materi : []);
export const batasOf = (a) => ({
  lemah: a?.lemah_pct == null ? 50 : Number(a.lemah_pct),
  kuat: a?.kuat_pct == null ? 75 : Number(a.kuat_pct),
});
export const avg = (arr) => (arr.length ? arr.reduce((x, y) => x + y, 0) / arr.length : null);
export const rank = (list, r) => 1 + list.filter((x) => Number(x.score) > Number(r.score)).length;

export function median(arr) {
  if (!arr.length) return null;
  const a = [...arr].sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}
export function sd(arr) {
  if (arr.length < 2) return arr.length ? 0 : null;
  const m = avg(arr);
  return Math.sqrt(arr.reduce((t, x) => t + (x - m) * (x - m), 0) / arr.length);
}
export const statusOf = (p, b) => (p == null ? null : p < b.lemah ? 'Lemah' : p >= b.kuat ? 'Kuat' : 'Cukup');

/** Skor per materi untuk satu baris nilai. */
export function skorMateri(row, a) {
  const b = batasOf(a);
  const ans = String(row.answers || '');
  return materiOf(a).map((m) => {
    const benar = m.soal.filter((n) => ans.charAt(n - 1) === 'B').length;
    const pct = m.soal.length ? (100 * benar) / m.soal.length : 0;
    return { nama: m.nama, n: m.soal.length, benar, pct, status: statusOf(pct, b) };
  });
}

/** Mencocokkan siswa dengan barisnya: lewat email, atau nama bila hanya ada satu yang sama persis. */
export function findMine(rows, user) {
  const e = String(user.email || '').trim().toLowerCase();
  const m = rows.find((r) => String(r.email).trim().toLowerCase() === e);
  if (m) return m;
  const byName = rows.filter((r) => normName(r.name) === normName(user.name));
  return byName.length === 1 ? byName[0] : null;
}

export function groupByBranch(rows) {
  const g = {};
  rows.forEach((r) => { (g[r.branch] = g[r.branch] || []).push(r); });
  return g;
}

/* ---------------- Impor CSV nilai ---------------- */

/**
 * Kolom wajib: Nama, Email, Cabang, Nilai. Opsional: "Soal 1".."Soal N" (BENAR/SALAH/KOSONG) dan "Waktu Submit".
 * Email ganda dihitung sekali (submit paling awal). Sel soal yang kosong ditulis "-" agar posisi huruf tetap sejajar nomor soal.
 */
export function parseScoresCsv(text) {
  const t = parseCsv(text);
  if (t.length < 2) throw new Error('File CSV kosong.');
  const h = t[0].map((x) => String(x).trim());
  for (const w of ['Nama', 'Email', 'Cabang', 'Nilai']) {
    if (!h.includes(w)) throw new Error(`Kolom wajib tidak ada: ${w}`);
  }
  const ix = (n) => h.indexOf(n);
  const sIx = {};
  h.forEach((x, i) => { if (/^Soal \d+$/.test(x)) sIx[parseInt(x.slice(5), 10)] = i; });
  const total = Math.max(0, ...Object.keys(sIx).map(Number));

  const uniq = new Map();
  let skipped = 0, valid = 0;
  for (const r of t.slice(1)) {
    const email = String(r[ix('Email')] ?? '').trim().toLowerCase();
    const nilaiTxt = String(r[ix('Nilai')] ?? '').trim().replace(',', '.');
    if (!email || nilaiTxt === '' || Number.isNaN(Number(nilaiTxt))) { skipped++; continue; }
    valid++;

    let answers = '';
    for (let k = 1; k <= total; k++) {
      answers += sIx[k] === undefined ? '-' : String(r[sIx[k]] ?? '').trim().charAt(0).toUpperCase() || '-';
    }
    const cnt = (ch) => answers.split(ch).length - 1;
    const tm = ix('Waktu Submit') < 0 ? NaN : Date.parse(r[ix('Waktu Submit')]);
    const row = {
      email,
      name: String(r[ix('Nama')] ?? '').trim(),
      branch: String(r[ix('Cabang')] ?? '').trim(),
      score: Number(nilaiTxt),
      correct: cnt('B'),
      wrong: cnt('S'),
      unanswered: cnt('K'),
      answers,
      submit_time: Number.isNaN(tm) ? null : new Date(tm).toISOString(),
      _t: Number.isNaN(tm) ? Infinity : tm,
    };
    const prev = uniq.get(email);
    if (!prev || row._t < prev._t) uniq.set(email, row);
  }
  const rows = [...uniq.values()].map(({ _t, ...rest }) => rest);
  if (!rows.length) throw new Error('Tidak ada baris nilai yang valid.');
  return { rows, total, skipped, duplicates: valid - rows.length };
}

/* ---------------- Pengaturan ujian ---------------- */

/** Memeriksa dan merapikan pemetaan materi. Melempar Error berpesan Indonesia bila tidak valid. */
export function validateMateri(materi, total) {
  const seen = {};
  const out = [];
  (materi || []).forEach((m) => {
    const nama = String(m.nama || '').trim();
    const soal = rngSoal(m.soal || '');
    if (!nama && !soal.length) return;
    if (!nama || !soal.length) throw new Error(`Materi "${nama || '?'}" belum lengkap (nama dan nomor soal).`);
    if (nama.length > 80) throw new Error(`Nama materi "${nama.slice(0, 20)}…" terlalu panjang (maks 80 karakter).`);
    soal.forEach((n) => {
      if (n < 1 || (total && n > total)) throw new Error(`Soal ${n} di luar jumlah soal (${total}).`);
      if (seen[n]) throw new Error(`Soal ${n} dipakai dua materi.`);
      seen[n] = 1;
    });
    out.push({ nama, soal });
  });
  return out;
}

export function validateBatas(lemah, kuat) {
  const l = Number(lemah), k = Number(kuat);
  if (!(l >= 0 && k <= 100 && l < k)) throw new Error('Batas harus 0 ≤ lemah < kuat ≤ 100.');
  return { lemah: l, kuat: k };
}

/* ---------------- Admin: detail satu ujian (halaman Ujian & Nilai) ---------------- */

export function buildDetail(a, rows) {
  const g = groupByBranch(rows);
  const cab = Object.keys(g).sort();
  const mm = materiOf(a);
  const S = rows.map((r) => skorMateri(r, a));
  const scores = rows.map((r) => Number(r.score));
  return {
    assessment: {
      id: a.id, name: a.name, total_questions: Number(a.total_questions), published: !!a.published,
      batas: batasOf(a), materi: mm.map((m) => ({ nama: m.nama, soal: fmtSoal(m.soal) })),
    },
    stats: {
      n: rows.length, avg: avg(scores),
      min: rows.length ? Math.min(...scores) : null, max: rows.length ? Math.max(...scores) : null,
    },
    cabang: cab.map((c) => ({ branch: c, n: g[c].length, avg: avg(g[c].map((r) => Number(r.score))) })),
    materi: mm.map((m, i) => {
      const cnt = (st) => S.filter((s) => s[i].status === st).length;
      return {
        nama: m.nama, soal: fmtSoal(m.soal), all: avg(S.map((s) => s[i].pct)),
        byC: cab.map((c) => avg(S.filter((s, j) => rows[j].branch === c).map((s) => s[i].pct))),
        lemah: cnt('Lemah'), cukup: cnt('Cukup'), kuat: cnt('Kuat'),
      };
    }),
    rows: rows.map((r) => ({
      name: r.name, email: r.email, branch: r.branch, score: Number(r.score),
      correct: r.correct, wrong: r.wrong, unanswered: r.unanswered,
      rank: rank(rows, r), rankC: rank(g[r.branch], r),
    })).sort((x, y) => x.rank - y.rank || x.name.localeCompare(y.name)),
  };
}

/* ---------------- Admin: analisis mendalam ---------------- */

function ansCount(list, q, ch) {
  let c = 0;
  list.forEach((it) => { if (String(it.r.answers || '').charAt(q - 1) === ch) c++; });
  return c;
}

export function buildAnalysis(a, rows) {
  const b = batasOf(a);
  const mm = materiOf(a);
  const total = Number(a.total_questions) || 0;
  const g = groupByBranch(rows);
  const cab = Object.keys(g).sort();
  const items = rows.map((r) => ({ r, s: skorMateri(r, a), score: Number(r.score) }));
  const byC = {};
  cab.forEach((c) => { byC[c] = items.filter((it) => it.r.branch === c); });
  const scoresOf = (list) => list.map((it) => it.score);
  const all = scoresOf(items);
  const avgAll = avg(all);

  const summary = (list) => {
    const v = scoresOf(list);
    return { n: v.length, avg: avg(v), median: median(v), sd: sd(v), min: v.length ? Math.min(...v) : null, max: v.length ? Math.max(...v) : null };
  };
  const matStat = (list, i) => {
    const av = avg(list.map((it) => it.s[i].pct));
    const cnt = (st) => list.filter((it) => it.s[i].status === st).length;
    return { avg: av, status: statusOf(av, b), lemah: cnt('Lemah'), cukup: cnt('Cukup'), kuat: cnt('Kuat') };
  };
  const top = all.length && Math.max(...all) > 100 ? Math.ceil(Math.max(...all) / 10) * 10 : 100;
  const w = top / 10;
  const dist = (list) => {
    const bins = [];
    for (let k = 0; k < 10; k++) bins.push({ from: k * w, to: (k + 1) * w, n: 0 });
    scoresOf(list).forEach((v) => { bins[Math.min(9, Math.max(0, Math.floor(v / w)))].n++; });
    return bins;
  };

  // Daya beda butir soal: selisih proporsi benar kelompok atas dan bawah (27% teratas dan terbawah).
  // Nilai negatif berarti peserta pintar lebih sering salah daripada yang lemah (sering tanda kunci jawaban keliru).
  const byScore = [...items].sort((x, y) => y.score - x.score);
  const gSize = Math.max(1, Math.round(byScore.length * 0.27));
  const upper = byScore.slice(0, gSize), lower = byScore.slice(-gSize);
  const dayaOf = (q) => (items.length >= 6 ? ansCount(upper, q, 'B') / upper.length - ansCount(lower, q, 'B') / lower.length : null);
  const dayaLabel = (d) => (d == null ? null : d < 0 ? 'Periksa' : d < 0.2 ? 'Rendah' : d < 0.4 ? 'Cukup' : 'Baik');

  // Analisis butir soal (tingkat kesulitan): keseluruhan dan per cabang
  const materiOfSoal = {};
  mm.forEach((m) => m.soal.forEach((n) => { materiOfSoal[n] = m.nama; }));
  const soal = [];
  for (let q = 1; q <= total; q++) {
    const ben = ansCount(items, q, 'B');
    const daya = dayaOf(q);
    soal.push({
      daya, dayaLabel: dayaLabel(daya),
      no: q, materi: materiOfSoal[q] || '-', benar: ben, salah: ansCount(items, q, 'S'), kosong: ansCount(items, q, 'K'),
      pct: items.length ? (100 * ben) / items.length : null,
      byC: cab.map((c) => (byC[c].length ? (100 * ansCount(byC[c], q, 'B')) / byC[c].length : null)),
    });
  }

  // Per cabang
  const cabOut = cab.map((c) => {
    const list = byC[c];
    const sm = summary(list);
    return {
      branch: c, sum: sm, delta: sm.avg - avgAll, dist: dist(list),
      materi: mm.map((m, i) => {
        const st = matStat(list, i), ga = matStat(items, i);
        return { nama: m.nama, avg: st.avg, status: st.status, delta: st.avg - ga.avg, lemah: st.lemah, cukup: st.cukup, kuat: st.kuat };
      }),
      top: [...list].sort((x, y) => y.score - x.score).slice(0, 3).map((it) => ({ name: it.r.name, score: it.score })),
    };
  });
  cabOut.forEach((c) => { c.rankCabang = 1 + cabOut.filter((x) => x.sum.avg > c.sum.avg).length; });

  // Per individu
  const people = items.map((it) => {
    const r = it.r, lst = byC[r.branch];
    const below = items.filter((x) => x.score < it.score).length;
    return {
      name: r.name, email: r.email, branch: r.branch, score: it.score, correct: r.correct, wrong: r.wrong, unanswered: r.unanswered,
      rank: rank(rows, r), rankC: rank(g[r.branch], r), nC: lst.length, avgC: avg(scoresOf(lst)),
      pctl: items.length > 1 ? (100 * below) / (items.length - 1) : null,
      materi: it.s.map((x) => ({ b: x.benar, n: x.n, p: x.pct, s: x.status })),
      answers: String(r.answers || ''),
    };
  }).sort((x, y) => x.rank - y.rank || String(x.name).localeCompare(String(y.name)));

  // Siswa yang perlu perhatian: lemah di setidaknya separuh materi, atau nilai jauh di bawah rata-rata.
  const sdAll = sd(all);
  const attention = people.map((p) => {
    const reasons = [];
    const lemah = p.materi.filter((m) => m.s === 'Lemah').length;
    if (p.materi.length && lemah >= Math.ceil(p.materi.length / 2)) reasons.push(`Lemah di ${lemah} dari ${p.materi.length} materi`);
    if (all.length >= 5 && sdAll > 0 && p.score < avgAll - sdAll) reasons.push('Nilai jauh di bawah rata-rata');
    return reasons.length ? { name: p.name, email: p.email, branch: p.branch, score: p.score, reasons } : null;
  }).filter(Boolean).sort((x, y) => x.score - y.score);

  const result = {
    assessment: { name: a.name, total_questions: total, batas: b },
    attention,
    cabangList: cab,
    materi: mm.map((m) => ({ nama: m.nama, soal: fmtSoal(m.soal) })),
    overall: {
      sum: summary(items), dist: dist(items), soal,
      cabang: cab.map((c) => ({ branch: c, n: byC[c].length, avg: avg(scoresOf(byC[c])) })),
      materi: mm.map((m, i) => {
        const st = matStat(items, i);
        st.nama = m.nama;
        st.soal = fmtSoal(m.soal);
        st.byC = cab.map((c) => matStat(byC[c], i).avg);
        return st;
      }),
    },
    cabang: cabOut,
    people,
  };
  result.insights = buildInsights(result);
  return result;
}

/* ---------------- Siswa (dihitung di server, /api) ---------------- */

/** Ujian terbit + ringkasan nilai dan peringkat milik sendiri. */
export function buildMyAssessments(assessments, rowsById, user) {
  return assessments
    .filter((a) => a.published)
    .map((a) => {
      const rows = rowsById[a.id] || [];
      const me = findMine(rows, user);
      return {
        assessment_id: a.id, name: a.name, created_at: a.created_at, participants: rows.length,
        avg_all: avg(rows.map((r) => Number(r.score))),
        my_score: me ? Number(me.score) : null, my_rank: me ? rank(rows, me) : null,
      };
    });
}

/**
 * Hasil lengkap satu ujian untuk siswa. Materi, jawaban per soal, dan persentil hanya dihitung untuk baris
 * milik siswa itu. Nama siswa lain SELALU disamarkan "xxxx" di sini (server), jadi tidak pernah sampai ke browser.
 */
export function buildMyResult(a, rows, user) {
  if (!a.published) throw new Error('Hasil ujian ini belum diumumkan.');
  const me = findMine(rows, user);
  const g = groupByBranch(rows);
  const scoresOf = (list) => list.map((r) => Number(r.score));
  const mm = me ? skorMateri(me, a) : [];
  const defs = materiOf(a);
  const soalMateri = {};
  const allS = rows.map((r) => skorMateri(r, a));
  const brIdx = [];
  rows.forEach((r, j) => { if (me && r.branch === me.branch) brIdx.push(j); });
  mm.forEach((x, i) => {
    x.all = avg(allS.map((s) => s[i].pct));
    x.br = avg(brIdx.map((j) => allS[j][i].pct));
    x.soal = fmtSoal(defs[i].soal);
  });
  defs.forEach((m) => m.soal.forEach((n) => { soalMateri[n] = m.nama; }));
  const below = me ? rows.filter((r) => Number(r.score) < Number(me.score)).length : 0;

  return {
    name: a.name, total: rows.length, avg_all: avg(scoresOf(rows)), batas: batasOf(a),
    cabang: Object.keys(g).sort().map((c) => ({ branch: c, n: g[c].length, avg: avg(scoresOf(g[c])) })),
    me: me && {
      name: me.name, branch: me.branch, score: Number(me.score), correct: me.correct, wrong: me.wrong, unanswered: me.unanswered,
      rank: rank(rows, me), rankC: rank(g[me.branch], me), nC: g[me.branch].length, avgC: avg(scoresOf(g[me.branch])),
      pctl: rows.length > 1 ? (100 * below) / (rows.length - 1) : null, answers: String(me.answers || ''),
    },
    materi: mm,
    soalMateri,
    board: rows
      .map((r) => ({ r, rank: rank(rows, r), rankC: rank(g[r.branch], r) }))
      .sort((x, y) => x.rank - y.rank || String(x.r.name).localeCompare(String(y.r.name)))
      .map((o) => {
        const isMe = o.r === me;
        return { name: isMe ? o.r.name : 'xxxx', branch: o.r.branch, score: Number(o.r.score), rank: o.rank, rankC: o.rankC, me: isMe };
      }),
  };
}

/** Peringkat kesulitan soal: 1 = tersulit (persen benar terendah). Soal tanpa data dibuang. */
export function rankSoal(list) {
  return list.filter((q) => q.pct != null).sort((x, y) => x.pct - y.pct || x.no - y.no).map((q, i) => ({ ...q, rk: i + 1 }));
}

/** Sulit < 30%, Sedang 30–70%, Mudah > 70% benar. */
export const tingkatOf = (p) => (p == null ? '' : p < 30 ? 'Sulit' : p <= 70 ? 'Sedang' : 'Mudah');

/* ---------------- Insight otomatis ---------------- */

/** Kesimpulan otomatis dari hasil buildAnalysis: [{ type: 'info' | 'warn' | 'good', text }]. */
export function buildInsights(d) {
  const out = [];
  const o = d.overall;
  const sm = o.sum;
  if (!sm.n) return out;
  const add = (type, text) => out.push({ type, text });

  add('info', `Rata-rata ${f1(sm.avg)} dari ${sm.n} peserta (median ${f1(sm.median)}, tertinggi ${f1(sm.max)}, terendah ${f1(sm.min)}).`);

  const cs = d.cabang.filter((c) => c.sum.n > 0);
  if (cs.length >= 2) {
    const sorted = [...cs].sort((x, y) => y.sum.avg - x.sum.avg);
    const hi = sorted[0], lo = sorted[sorted.length - 1];
    const gap = hi.sum.avg - lo.sum.avg;
    add(gap >= 10 ? 'warn' : 'info', `Cabang ${hi.branch} tertinggi (${f1(hi.sum.avg)}) dan ${lo.branch} terendah (${f1(lo.sum.avg)}), selisih ${f1(gap)} poin.${gap >= 10 ? ' Kesenjangan antarcabang cukup besar.' : ''}`);
  }

  if (o.materi.length) {
    const ms = [...o.materi].sort((x, y) => x.avg - y.avg);
    const weak = ms[0], strong = ms[ms.length - 1];
    const nWeakC = d.cabang.filter((c) => c.materi.some((m) => m.nama === weak.nama && m.status === 'Lemah')).length;
    const wide = d.cabang.length > 1 && nWeakC >= Math.ceil(d.cabang.length / 2);
    if (weak.status === 'Lemah') {
      add('warn', `Materi ${weak.nama} paling lemah (${f1(weak.avg)}% benar)${d.cabang.length > 1 ? `, berstatus Lemah di ${nWeakC} dari ${d.cabang.length} cabang` : ''}.${wide ? ' Layak dibahas ulang secara klasikal.' : ''}`);
    } else {
      add('info', `Materi terlemah adalah ${weak.nama} (${f1(weak.avg)}% benar), tetapi masih di atas batas Lemah.`);
    }
    if (strong.nama !== weak.nama) add('good', `Materi terkuat: ${strong.nama} (${f1(strong.avg)}% benar).`);
  }

  const listNo = (arr) => (arr.length > 8 ? `${arr.slice(0, 8).join(', ')}, dan ${arr.length - 8} lainnya` : arr.join(', '));
  const hard = o.soal.filter((q) => q.pct != null && q.pct < 30).map((q) => q.no);
  if (hard.length) add('warn', `${hard.length} soal tergolong sulit (kurang dari 30% benar): nomor ${listNo(hard)}.`);

  const odd = o.soal.filter((q) => q.daya != null && q.daya < 0).map((q) => q.no);
  if (odd.length) add('warn', `Soal ${listNo(odd)} punya daya beda negatif: peserta berskor tinggi lebih sering salah daripada yang rendah. Periksa kunci jawaban atau redaksi soalnya.`);

  const blank = o.soal.filter((q) => sm.n && q.kosong / sm.n >= 0.3).map((q) => q.no);
  if (blank.length) add('warn', `Soal ${listNo(blank)} dikosongkan oleh 30% peserta atau lebih.`);

  if (o.soal.length >= 10) {
    const cut = Math.ceil(o.soal.length * 0.8);
    const rate = (list) => (list.length ? list.reduce((t, q) => t + q.kosong / sm.n, 0) / list.length : 0);
    const first = rate(o.soal.slice(0, cut)), last = rate(o.soal.slice(cut));
    if (last >= 0.1 && last >= 2 * first) add('warn', `Soal di bagian akhir lebih sering dikosongkan (${f1(last * 100)}% dibanding ${f1(first * 100)}%). Waktu pengerjaan mungkin kurang.`);
  }

  if (d.attention.length) {
    const names = d.attention.slice(0, 5).map((p) => p.name).join(', ');
    add('warn', `${d.attention.length} siswa perlu perhatian khusus${d.attention.length > 5 ? ` (5 terendah: ${names})` : `: ${names}`}.`);
  } else if (o.materi.length) {
    add('good', 'Tidak ada siswa yang lemah di separuh lebih materi.');
  }
  return out;
}

/* ---------------- Bandingkan dua ujian ---------------- */

const BIN_LABELS = ['Turun > 20', 'Turun 10–20', 'Turun 1–10', 'Hampir tetap', 'Naik 1–10', 'Naik 10–20', 'Naik > 20'];

/** Membandingkan ujian A (sebelum) dan B (sesudah) untuk peserta yang ikut keduanya (dicocokkan lewat email). */
export function buildComparison(aA, rowsA, aB, rowsB) {
  const mapA = new Map(rowsA.map((r) => [String(r.email).toLowerCase(), r]));
  const pairs = [];
  rowsB.forEach((rb) => {
    const ra = mapA.get(String(rb.email).toLowerCase());
    if (!ra) return;
    pairs.push({
      email: rb.email, name: rb.name || ra.name, branch: rb.branch || ra.branch,
      a: Number(ra.score), b: Number(rb.score), delta: Number(rb.score) - Number(ra.score),
    });
  });
  pairs.sort((x, y) => y.delta - x.delta || x.name.localeCompare(y.name));

  const eps = 0.05;
  const bins = BIN_LABELS.map((label) => ({ label, n: 0 }));
  pairs.forEach((p) => {
    const d = p.delta;
    const i = d < -20 ? 0 : d < -10 ? 1 : d < -1 ? 2 : d <= 1 ? 3 : d <= 10 ? 4 : d <= 20 ? 5 : 6;
    bins[i].n++;
  });

  const g = {};
  pairs.forEach((p) => { (g[p.branch] = g[p.branch] || []).push(p); });
  const cabang = Object.keys(g).sort().map((c) => ({
    branch: c, n: g[c].length, avgA: avg(g[c].map((p) => p.a)), avgB: avg(g[c].map((p) => p.b)), avgDelta: avg(g[c].map((p) => p.delta)),
  }));

  const matA = materiOf(aA), matB = materiOf(aB);
  const avgMateri = (a, rows, nama) => {
    const idx = materiOf(a).findIndex((m) => m.nama === nama);
    return idx < 0 ? null : avg(rows.map((r) => skorMateri(r, a)[idx].pct));
  };
  const materi = matA.filter((m) => matB.some((x) => x.nama === m.nama)).map((m) => {
    const a = avgMateri(aA, rowsA, m.nama), b = avgMateri(aB, rowsB, m.nama);
    return { nama: m.nama, a, b, delta: b - a };
  });

  return {
    a: { name: aA.name, n: rowsA.length, avg: avg(rowsA.map((r) => Number(r.score))) },
    b: { name: aB.name, n: rowsB.length, avg: avg(rowsB.map((r) => Number(r.score))) },
    both: pairs.length,
    avgBothA: avg(pairs.map((p) => p.a)), avgBothB: avg(pairs.map((p) => p.b)), avgDelta: avg(pairs.map((p) => p.delta)),
    up: pairs.filter((p) => p.delta > eps).length,
    down: pairs.filter((p) => p.delta < -eps).length,
    same: pairs.filter((p) => Math.abs(p.delta) <= eps).length,
    bins, cabang, materi, pairs,
  };
}
