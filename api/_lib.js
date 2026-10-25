// Pembantu bersama untuk fungsi server Vercel. Berkas berawalan "_" tidak dijadikan endpoint.
import { createClient } from '@supabase/supabase-js';

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

let cached = null;
/** Klien Supabase dengan service role key: melewati RLS, HANYA dipakai di server. */
export function service() {
  if (cached) return cached;
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new HttpError(500, 'Server belum dikonfigurasi (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).');
  cached = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return cached;
}

export const adminEmails = () =>
  String(process.env.ADMIN_EMAILS || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);

/** Memastikan pemanggil login (dan admin bila diminta). Mengembalikan profil dari tabel profiles. */
export async function requireUser(req, { admin = false } = {}) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) throw new HttpError(401, 'Sesi tidak valid. Silakan login kembali.');
  const sb = service();
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data?.user) throw new HttpError(401, 'Sesi telah berakhir. Silakan login kembali.');
  const { data: profile } = await sb.from('profiles').select('*').eq('id', data.user.id).maybeSingle();
  if (!profile) throw new HttpError(401, 'Akun tidak ditemukan.');
  if (profile.status !== 'ACTIVE') throw new HttpError(403, 'Akun Anda tidak aktif. Hubungi admin.');
  if (admin && profile.role !== 'ADMIN') {
    await sb.from('activity_log').insert({ user_id: profile.id, action: 'UNAUTHORIZED_ADMIN_ACCESS_ATTEMPT', details: { path: req.url } });
    throw new HttpError(403, 'Anda tidak memiliki akses admin untuk aksi ini.');
  }
  return profile;
}

/** Membungkus handler: cek metode HTTP, tangkap error, kirim JSON { data } atau { message }. */
export function handler(methods, fn) {
  return async (req, res) => {
    try {
      if (!methods.includes(req.method)) throw new HttpError(405, 'Metode tidak didukung.');
      const data = await fn(req);
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json({ data });
    } catch (e) {
      const status = e instanceof HttpError ? e.status : 500;
      if (!(e instanceof HttpError)) console.error(e);
      res.status(status).json({ message: e instanceof HttpError || e?.isUser ? e.message : 'Terjadi kesalahan pada server.' });
    }
  };
}

/** Error yang pesannya aman ditampilkan ke pengguna. */
export function userError(message, status = 400) {
  return new HttpError(status, message);
}

export async function log(userId, action, details = {}) {
  try {
    await service().from('activity_log').insert({ user_id: userId, action, details });
  } catch (e) {
    console.error('Gagal mencatat log', e);
  }
}

/** Mengambil semua baris nilai satu ujian (halaman 1000 baris, sesuai batas Supabase). */
export async function fetchScores(assessmentId) {
  const sb = service();
  const out = [];
  const size = 1000;
  for (let from = 0; ; from += size) {
    const { data, error } = await sb.from('scores').select('*').eq('assessment_id', assessmentId).order('id').range(from, from + size - 1);
    if (error) throw new Error(error.message);
    out.push(...data);
    if (data.length < size) break;
  }
  return out;
}
