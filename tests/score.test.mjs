import assert from 'node:assert/strict';
import {
  rngSoal, fmtSoal, parseScoresCsv, validateMateri, validateBatas, buildDetail, buildAnalysis,
  buildMyAssessments, buildMyResult, findMine,
} from '../src/lib/score.js';

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

console.log('score.test OK');
