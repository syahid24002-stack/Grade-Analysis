// Pendaftaran mandiri. Dibuat lewat server agar tombol "Izinkan orang mendaftar sendiri" benar-benar berlaku
// (pendaftaran langsung dari browser ke Supabase sebaiknya dimatikan, lihat README).
import { service, adminEmails, handler, userError, log } from './_lib.js';
import { BRANCHES, MIN_PASSWORD } from '../src/lib/constants.js';
import { validEmail } from '../src/lib/format.js';

export default handler(['POST'], async (req) => {
  const sb = service();
  const { data: setting } = await sb.from('app_settings').select('value').eq('key', 'allow_self_registration').maybeSingle();
  if (setting && setting.value === false) {
    throw userError('Pendaftaran mandiri sedang tidak diaktifkan. Hubungi admin untuk dibuatkan akun.', 403);
  }

  const b = req.body || {};
  const name = String(b.name || '').trim();
  const email = String(b.email || '').trim().toLowerCase();
  const password = String(b.password || '');
  const branch = String(b.branch || '').trim();
  if (!name) throw userError('Nama tidak boleh kosong.');
  if (name.length > 100) throw userError('Nama terlalu panjang (maks 100 karakter).');
  if (!validEmail(email)) throw userError('Format email tidak valid.');
  if (password.length < MIN_PASSWORD) throw userError(`Password minimal ${MIN_PASSWORD} karakter.`);
  if (!BRANCHES.includes(branch)) throw userError('Cabang tidak valid. Pilih salah satu cabang yang tersedia.');

  const role = adminEmails().includes(email) ? 'ADMIN' : 'USER';
  const { data, error } = await sb.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { name, branch },
    app_metadata: { role },
  });
  if (error) {
    if (error.code === 'email_exists' || /already|registered/i.test(error.message)) throw userError('Email sudah terdaftar. Silakan login.', 409);
    throw userError('Pendaftaran gagal. Coba lagi.', 500);
  }
  await log(data.user.id, 'USER_REGISTERED', { email, branch, role });
  return { ok: true };
});
