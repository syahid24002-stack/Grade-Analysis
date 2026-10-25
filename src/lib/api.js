import { supabase } from './supabase';

/** Memanggil fungsi server Vercel (/api/...) dengan token login. Melempar Error berpesan Indonesia bila gagal. */
export async function api(path, { method = 'POST', body, query } = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const qs = query ? `?${new URLSearchParams(query)}` : '';
  let res;
  try {
    res = await fetch(`/api/${path}${qs}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: method === 'GET' ? undefined : JSON.stringify(body || {}),
    });
  } catch {
    throw new Error('Koneksi ke server gagal. Periksa internet Anda.');
  }
  let json = null;
  try { json = await res.json(); } catch { /* respons bukan JSON */ }
  if (!res.ok) throw new Error(json?.message || 'Terjadi kesalahan pada server.');
  return json?.data;
}
