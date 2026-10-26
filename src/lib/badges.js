// Pencapaian siswa, dihitung dari daftar ujian (urut dari yang terlama) dan nilai miliknya.

/** list: [{ name, my_score, my_rank, avg_all, participants }] diurutkan dari ujian terlama ke terbaru. */
export function buildBadges(list) {
  const scored = list.filter((a) => a.my_score != null);
  const out = [];

  scored.filter((a) => a.my_rank != null && a.my_rank <= 3 && a.participants >= 3)
    .sort((x, y) => x.my_rank - y.my_rank).slice(0, 3)
    .forEach((a) => out.push({ key: `rank-${a.name}`, title: `Peringkat ${a.my_rank}`, text: a.name }));

  let streak = 0;
  for (let i = scored.length - 1; i > 0; i--) {
    if (scored[i].my_score > scored[i - 1].my_score) streak++; else break;
  }
  if (streak >= 2) out.push({ key: 'streak', title: `Naik ${streak} ujian berturut-turut`, text: 'Pertahankan ritmenya' });

  if (scored.length >= 2 && scored.every((a) => a.avg_all != null && a.my_score > a.avg_all)) {
    out.push({ key: 'above', title: 'Selalu di atas rata-rata', text: `${scored.length} ujian` });
  }
  const best = scored.reduce((m, a) => (a.my_score > (m?.my_score ?? -1) ? a : m), null);
  if (best && best.my_score >= 90) out.push({ key: 'high', title: 'Nilai 90 ke atas', text: best.name });
  return out;
}
