// Daftar ujian yang sudah terbit beserta nilai dan peringkat milik siswa yang login.
import { service, requireUser, handler, fetchScores } from './_lib.js';
import { buildMyAssessments } from '../src/lib/score.js';

export default handler(['GET'], async (req) => {
  const user = await requireUser(req);
  const { data: list, error } = await service().from('assessments').select('*').eq('published', true).order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  const rowsById = {};
  for (const a of list) rowsById[a.id] = await fetchScores(a.id);
  return buildMyAssessments(list, rowsById, user);
});
