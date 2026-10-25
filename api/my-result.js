// Hasil lengkap satu ujian untuk siswa yang login. Nama siswa lain disamarkan di sini, di server.
import { service, requireUser, handler, userError, fetchScores } from './_lib.js';
import { buildMyResult } from '../src/lib/score.js';

export default handler(['GET'], async (req) => {
  const user = await requireUser(req);
  const id = String(req.query?.id || '');
  if (!id) throw userError('Ujian tidak ditemukan.', 404);
  const { data: a } = await service().from('assessments').select('*').eq('id', id).maybeSingle();
  if (!a) throw userError('Ujian tidak ditemukan.', 404);
  try {
    return buildMyResult(a, await fetchScores(id), user);
  } catch (e) {
    if (/belum diumumkan/.test(e.message)) throw userError(e.message, 403);
    throw e;
  }
});
