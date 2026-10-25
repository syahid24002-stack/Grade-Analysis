import { supabase } from './supabase';

const fail = (error) => { throw new Error(error.message || 'Terjadi kesalahan pada server.'); };

/** Semua baris nilai satu ujian (Supabase membatasi 1000 baris per permintaan, jadi diambil per halaman). */
export async function fetchAllScores(assessmentId) {
  const out = [];
  const size = 1000;
  for (let from = 0; ; from += size) {
    const { data, error } = await supabase.from('scores').select('*').eq('assessment_id', assessmentId).order('id').range(from, from + size - 1);
    if (error) fail(error);
    out.push(...data);
    if (data.length < size) break;
  }
  return out;
}

export async function listAssessments() {
  const { data, error } = await supabase.rpc('admin_assessments');
  if (error) fail(error);
  return data.map((a) => ({ ...a, participants: Number(a.participants), avg_score: a.avg_score == null ? null : Number(a.avg_score) }));
}

export async function getAssessment(id) {
  const { data, error } = await supabase.from('assessments').select('*').eq('id', id).single();
  if (error) fail(error);
  return data;
}

export async function listProfiles() {
  const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
  if (error) fail(error);
  return data;
}

export async function logActivity(action, details = {}) {
  await supabase.rpc('log_activity', { p_action: action, p_details: details });
}

/** Daftar orang unik yang punya nilai (dari semua ujian), untuk pencarian riwayat. */
export async function listPeople() {
  const map = new Map();
  const size = 1000;
  for (let from = 0; ; from += size) {
    const { data, error } = await supabase.from('scores').select('email,name,branch').order('id').range(from, from + size - 1);
    if (error) fail(error);
    data.forEach((r) => map.set(r.email, { email: r.email, name: r.name, branch: r.branch }));
    if (data.length < size) break;
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export async function scoresOfEmail(email) {
  const { data, error } = await supabase.from('scores').select('*').eq('email', email);
  if (error) fail(error);
  return data;
}

export async function listActivity(limit = 300) {
  const { data, error } = await supabase.from('activity_log').select('*').order('created_at', { ascending: false }).limit(limit);
  if (error) fail(error);
  return data;
}

export { fail };
