import assert from 'node:assert/strict';
import {
  rngSoal, fmtSoal, parseScoresCsv, validateMateri, validateBatas, buildDetail, buildAnalysis,
  buildMyAssessments, buildMyResult, findMine, buildComparison, rankSoal,
} from '../src/lib/score.js';
import { buildBadges } from '../src/lib/badges.js';
import { analysisSheets, comparisonSheets, scoresSheets } from '../src/lib/report.js';
import { makeXlsx, colName, sheetNames, crc32 } from '../src/lib/xlsx.js';
import zlib from 'node:zlib';

// ---- rentang soal ----
assert.deepEqual(rngSoal('1-4, 18'), [1, 2, 3, 4, 18]);
assert.equal(fmtSoal([18, 1, 2, 3, 4]), '1-4, 18');

// ---- impor CSV ----
const csv = [
  'Nama,Email,Cabang,Nilai,Soal 1,Soal 2,Soal 3,Soal 4,Waktu Submit',
  'Ani,ani@x.id,Bandung,75,BENAR,BENAR,BENAR,SALAH,2026-01-02T10:00:00Z',
  'Ani (ulang),ANI@x.id,Bandung,50,SALAH,SALAH,BENAR,KOSONG,2026-01-02T09:00:00Z', // lebih awal -> dipakai
  'Budi,budi@x.id,Bandung,50,BENAR,SALAH,,SALAH,2026-01-02T10:05:00Z',               // sel kosong tetap sejajar
  'Citra,citra@x.id,Cirebon,100,BENAR,BENAR,BENAR,BENAR,',
  'Dodi,dodi@x.id,Cirebon,25,SALAH,SALAH,SALAH,BENAR,',
  'Tanpa nilai,x@x.id,Cirebon,,BENAR,BENAR,BENAR,BENAR,',
].join('\n');
const { rows, total } = parseScoresCsv(csv);
assert.equal(total, 4);
assert.equal(rows.length, 4);
assert.equal(parseScoresCsv(csv).skipped, 1);   // baris tanpa nilai
assert.equal(parseScoresCsv(csv).duplicates, 1); // email ganda
const ani = rows.find((r) => r.email === 'ani@x.id');
assert.equal(ani.name, 'Ani (ulang)');
assert.equal(ani.answers, 'SSBK');
assert.equal(ani.score, 50);
const budi = rows.find((r) => r.email === 'budi@x.id');
assert.equal(budi.answers, 'BS-S');
assert.equal(budi.answers.length, 4);
assert.throws(() => parseScoresCsv('Nama,Email\nA,a@x.id'), /Kolom wajib tidak ada: Cabang/);
assert.throws(() => parseScoresCsv('Nama,Email,Cabang,Nilai'), /File CSV kosong/);

// ---- materi ----
const materi = validateMateri([{ nama: 'Aljabar', soal: '1-2' }, { nama: 'Geometri', soal: '3-4' }, { nama: '', soal: '' }], 4);
assert.deepEqual(materi, [{ nama: 'Aljabar', soal: [1, 2] }, { nama: 'Geometri', soal: [3, 4] }]);
assert.throws(() => validateMateri([{ nama: 'A', soal: '1-2' }, { nama: 'B', soal: '2-3' }], 4), /dipakai dua materi/);
assert.throws(() => validateMateri([{ nama: 'A', soal: '9' }], 4), /di luar jumlah soal/);
assert.throws(() => validateMateri([{ nama: 'A', soal: '' }], 4), /belum lengkap/);
assert.throws(() => validateBatas(80, 60), /Batas harus/);

const A = { id: 'a1', name: 'Logika', total_questions: 4, lemah_pct: 50, kuat_pct: 75, published: true, materi };
const S = rows.map((r, i) => ({ ...r, id: i + 1 }));

// ---- detail admin ----
const det = buildDetail(A, S);
assert.equal(det.stats.n, 4);
assert.equal(det.stats.max, 100);
assert.equal(det.rows[0].name, 'Citra');
assert.equal(det.rows[0].rank, 1);
assert.deepEqual(det.cabang.map((c) => c.branch), ['Bandung', 'Cirebon']);

// ---- analisis ----
const an = buildAnalysis(A, S);
assert.equal(an.overall.sum.n, 4);
assert.equal(an.overall.soal.length, 4);
assert.equal(an.overall.soal[0].benar, 2); // soal 1: Budi, Citra
assert.equal(an.people.length, 4);
const citra = an.people.find((p) => p.name === 'Citra');
assert.equal(citra.materi[0].s, 'Kuat');
assert.equal(an.cabang.length, 2);
assert.equal(an.cabang.find((c) => c.branch === 'Cirebon').rankCabang, 1);
assert.equal(an.overall.dist.reduce((t, b) => t + b.n, 0), 4);

// ---- hasil siswa: privasi ----
const user = { email: 'budi@x.id', name: 'Budi' };
assert.equal(findMine(S, user).email, 'budi@x.id');
assert.equal(findMine(S, { email: 'tidak@ada.id', name: 'dodi' }).email, 'dodi@x.id'); // cocok lewat nama unik
assert.equal(findMine(S, { email: 'tidak@ada.id', name: 'Orang Lain' }), null);

const res = buildMyResult(A, S, user);
assert.equal(res.me.name, 'Budi');
assert.equal(res.me.answers, 'BS-S');
assert.equal(res.board.filter((b) => b.me).length, 1);
const json = JSON.stringify(res);
for (const other of ['Citra', 'Dodi', 'Ani', 'citra@x.id', 'dodi@x.id', 'ani@x.id']) {
  assert.ok(!json.includes(other), `data ${other} bocor ke siswa lain`);
}
assert.ok(res.board.filter((b) => !b.me).every((b) => b.name === 'xxxx'));

// siswa yang tidak ditemukan tetap melihat papan peringkat tanpa nama
const stranger = buildMyResult(A, S, { email: 'z@z.id', name: 'Zed' });
assert.equal(stranger.me, null);
assert.ok(stranger.board.every((b) => b.name === 'xxxx'));

// belum diterbitkan -> ditolak
assert.throws(() => buildMyResult({ ...A, published: false }, S, user), /belum diumumkan/);

// ringkasan daftar ujian
const list = buildMyAssessments([A, { ...A, id: 'a2', name: 'Draf', published: false }], { a1: S }, user);
assert.equal(list.length, 1);
assert.equal(list[0].my_score, 50);
assert.equal(list[0].avg_all, 56.25); // (50+100+25+50)/4
assert.equal(list[0].my_rank, 2 + 0); // Citra 100 > Budi 50 = Ani 50 -> peringkat 2


// ======== Analisis lanjutan: daya beda, insight, perhatian ========
{
  // 10 siswa, 5 soal. Soal 1-4 dijawab benar oleh yang pintar; soal 5 terbalik (kunci bermasalah).
  const mk = (i) => {
    const good = (q) => (q === 5 ? i >= 5 : i < 10 - q * 2); // soal 1 paling mudah ... 4 lebih sulit
    const ans = [1, 2, 3, 4, 5].map((q) => (good(q) ? 'B' : 'S')).join('');
    return {
      id: i + 1, email: `s${i}@x.id`, name: `Siswa ${i}`, branch: i % 2 ? 'Bandung' : 'Cirebon',
      score: 100 - i * 10, correct: ans.split('B').length - 1, wrong: ans.split('S').length - 1, unanswered: 0, answers: ans,
    };
  };
  const rowsX = Array.from({ length: 10 }, (_, i) => mk(i));
  const AX = { id: 'x', name: 'Uji', total_questions: 5, lemah_pct: 50, kuat_pct: 75, published: true, materi: [{ nama: 'M1', soal: [1, 2, 3] }, { nama: 'M2', soal: [4, 5] }] };
  const an = buildAnalysis(AX, rowsX);
  const q = (n) => an.overall.soal.find((x) => x.no === n);
  assert.ok(q(5).daya < 0, 'soal 5 daya beda negatif');
  assert.equal(q(5).dayaLabel, 'Periksa');
  assert.ok(q(3).daya > 0.4);
  assert.equal(q(3).dayaLabel, 'Baik');
  assert.ok(an.insights.some((i) => /daya beda negatif/.test(i.text) && /5/.test(i.text)));
  assert.ok(an.insights[0].text.startsWith('Rata-rata 55'));
  assert.ok(an.insights.some((i) => /Cabang/.test(i.text)));
  assert.ok(an.attention.length > 0 && an.attention[0].name === 'Siswa 9');
  assert.ok(an.attention.every((p) => p.reasons.length));
  assert.equal(rankSoal(an.overall.soal)[0].rk, 1);
  // peserta < 6: daya beda tidak dihitung
  assert.equal(buildAnalysis(AX, rowsX.slice(0, 4)).overall.soal[0].daya, null);

  // ======== Bandingkan dua ujian ========
  const rowsY = rowsX.map((r, i) => ({ ...r, score: Math.min(100, r.score + (i % 2 ? 15 : -5)) })).slice(0, 8); // 2 siswa tidak ikut
  rowsY.push({ ...rowsX[0], email: 'baru@x.id', name: 'Baru', score: 70 });
  const cmp = buildComparison(AX, rowsX, { ...AX, name: 'Uji 2' }, rowsY);
  assert.equal(cmp.both, 8);
  assert.equal(cmp.up + cmp.down + cmp.same, 8);
  assert.equal(cmp.up, 4);
  assert.equal(cmp.down, 4);
  assert.equal(cmp.bins.reduce((t, b) => t + b.n, 0), 8);
  // siswa 1 sudah 90, jadi naik 15 dibatasi 100 (naik 10): (10 + 15*3 - 5*4) / 8
assert.ok(Math.abs(cmp.avgDelta - 4.375) < 1e-9);
  assert.equal(cmp.pairs[0].delta, 15);
  assert.equal(cmp.materi.length, 2);

  // ======== Lencana siswa ========
  const L = [
    { name: 'A', my_score: 50, my_rank: 5, avg_all: 60, participants: 10 },
    { name: 'B', my_score: 70, my_rank: 3, avg_all: 65, participants: 10 },
    { name: 'C', my_score: 92, my_rank: 1, avg_all: 70, participants: 10 },
  ];
  const keys = buildBadges(L).map((b) => b.key);
  assert.ok(keys.includes('streak') && keys.includes('high') && keys.includes('rank-C') && keys.includes('rank-B'));
  assert.ok(!keys.includes('above')); // ujian A di bawah rata-rata
  assert.deepEqual(buildBadges([{ name: 'A', my_score: null, participants: 3 }]), []);

  // ======== Laporan Excel ========
  const sheets = analysisSheets(an);
  assert.deepEqual(sheets.map((s) => s.name), ['Ringkasan', 'Per Cabang', 'Materi', 'Butir Soal', 'Per Individu', 'Perlu Perhatian']);
  assert.equal(sheets.find((s) => s.name === 'Per Individu').rows.length, 11);
  assert.equal(sheets.find((s) => s.name === 'Butir Soal').rows[1][0], 1);
  assert.equal(comparisonSheets(cmp).length, 4); // Ringkasan, Per Siswa, Per Cabang, Materi
  assert.equal(scoresSheets(buildDetail(AX, rowsX)).sheets.length, 2);

  // ======== Berkas xlsx ========
  assert.equal(colName(0), 'A'); assert.equal(colName(25), 'Z'); assert.equal(colName(26), 'AA');
  assert.deepEqual(sheetNames(['a:b', 'A:B', '']), ['a b', 'A B 2', 'Sheet3']);
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
  const bytes = makeXlsx(sheets);
  assert.equal(bytes[0], 0x50); assert.equal(bytes[1], 0x4b); // "PK"
  // CRC setiap entri ZIP harus cocok dengan zlib bawaan Node
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = bytes.length - 22;
  assert.equal(dv.getUint32(eocd, true), 0x06054b50);
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  for (let i = 0; i < count; i++) {
    const crc = dv.getUint32(p + 16, true), size = dv.getUint32(p + 24, true);
    const nameLen = dv.getUint16(p + 28, true), off = dv.getUint32(p + 42, true);
    const lnLen = dv.getUint16(off + 26, true);
    const data = bytes.subarray(off + 30 + lnLen, off + 30 + lnLen + size);
    assert.equal(zlib.crc32(data), crc);
    p += 46 + nameLen;
  }
}

console.log('score.test OK');
