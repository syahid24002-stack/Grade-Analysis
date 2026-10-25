// Kelola akun (butuh service role, jadi lewat server): tambah, impor, reset password, hapus, ubah role/status.
import { randomBytes } from 'node:crypto';
import { service, requireUser, handler, userError, log } from './_lib.js';
import { BRANCHES, MIN_PASSWORD } from '../src/lib/constants.js';
import { validEmail } from '../src/lib/format.js';

const BAN_FOREVER = '876000h'; // sekitar 100 tahun

/** Memvalidasi satu data user. Melempar userError bila tidak valid. */
function cleanUser(p) {
  const name = String(p.name || '').trim();
  const email = String(p.email || '').trim().toLowerCase();
  const password = String(p.password || '');
  const branch = String(p.branch || '').trim();
  if (!name) throw userError('Nama tidak boleh kosong.');
  if (name.length > 100) throw userError('Nama terlalu panjang (maks 100 karakter).');
  if (!validEmail(email)) throw userError('Format email tidak valid.');
  if (password.length < MIN_PASSWORD) throw userError(`Password minimal ${MIN_PASSWORD} karakter.`);
  if (!BRANCHES.includes(branch)) throw userError(p.__csv ? `Cabang tidak valid: "${branch}"` : 'Cabang tidak valid.');
  return { name, email, password, branch, role: String(p.role || '').toUpperCase() === 'ADMIN' ? 'ADMIN' : 'USER' };
}

async function createOne(u) {
  const { data, error } = await service().auth.admin.createUser({
    email: u.email, password: u.password, email_confirm: true,
    user_metadata: { name: u.name, branch: u.branch },
    app_metadata: { role: u.role },
  });
  if (error) {
    if (error.code === 'email_exists' || /already|registered/i.test(error.message)) throw userError(`Email sudah terdaftar: ${u.email}`, 409);
    throw userError('Gagal membuat akun.', 500);
  }
  return data.user;
}

/** Menjalankan tugas dengan batas paralel agar tidak membanjiri Supabase Auth. */
async function pool(items, limit, worker) {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      await worker(items[i], i);
    }
  }));
}

export default handler(['POST'], async (req) => {
  const me = await requireUser(req, { admin: true });
  const sb = service();
  const { action } = req.body || {};
  const b = req.body || {};

  if (action === 'create') {
    const u = cleanUser(b);
    const created = await createOne(u);
    await log(me.id, 'ADMIN_CREATED_USER', { email: u.email, role: u.role });
    return { user_id: created.id };
  }

  if (action === 'import') {
    // Browser mengirim sebagian baris (maks ± 50) per panggilan; startRow = nomor baris CSV pertama di bagian ini.
    const rows = Array.isArray(b.rows) ? b.rows.slice(0, 100) : [];
    const startRow = Number(b.startRow) || 2;
    const errors = [];
    let created = 0;
    await pool(rows, 5, async (row, i) => {
      try {
        await createOne(cleanUser({ ...row, __csv: true }));
        created++;
      } catch (e) {
        errors.push({ row: startRow + i, message: e?.status ? e.message : 'Gagal membuat akun.' });
      }
    });
    await log(me.id, 'ADMIN_IMPORTED_USERS', { count: created });
    return { created_count: created, errors: errors.sort((x, y) => x.row - y.row).map((e) => `Baris ${e.row}: ${e.message}`) };
  }

  const id = String(b.user_id || '');
  if (!id) throw userError('User tidak ditemukan.');
  const { data: target } = await sb.from('profiles').select('*').eq('id', id).maybeSingle();
  if (!target) throw userError('User tidak ditemukan.', 404);

  if (action === 'reset-password') {
    const newPassword = randomBytes(9).toString('base64url').slice(0, 8);
    const { error } = await sb.auth.admin.updateUserById(id, { password: newPassword });
    if (error) throw userError('Gagal mereset password.', 500);
    await log(me.id, 'ADMIN_RESET_USER_PASSWORD', { user_id: id });
    return { new_password: newPassword };
  }

  if (action === 'delete') {
    if (id === me.id) throw userError('Anda tidak dapat menghapus akun Anda sendiri.');
    // Nilai peserta tetap ada (tabel scores dikunci dengan email, bukan akun), jadi laporan lama tidak rusak.
    const { error } = await sb.auth.admin.deleteUser(id);
    if (error) throw userError('Gagal menghapus user.', 500);
    await log(me.id, 'ADMIN_DELETED_USER', { user_id: id, email: target.email });
    return true;
  }

  if (action === 'set-role') {
    if (!['ADMIN', 'USER'].includes(b.role)) throw userError('Role tidak valid.');
    if (id === me.id) throw userError('Anda tidak dapat mengubah role akun Anda sendiri.');
    const { error } = await sb.from('profiles').update({ role: b.role }).eq('id', id);
    if (error) throw userError('Gagal mengubah role.', 500);
    // Role di app_metadata ikut diperbarui agar konsisten bila profil dibuat ulang.
    await sb.auth.admin.updateUserById(id, { app_metadata: { role: b.role } });
    await log(me.id, 'ADMIN_SET_USER_ROLE', { user_id: id, role: b.role });
    return true;
  }

  if (action === 'set-status') {
    if (!['ACTIVE', 'INACTIVE'].includes(b.status)) throw userError('Status tidak valid.');
    if (id === me.id) throw userError('Anda tidak dapat menonaktifkan akun Anda sendiri.');
    const { error } = await sb.from('profiles').update({ status: b.status }).eq('id', id);
    if (error) throw userError('Gagal mengubah status.', 500);
    // Akun nonaktif juga dicegah login di Supabase Auth.
    await sb.auth.admin.updateUserById(id, { ban_duration: b.status === 'INACTIVE' ? BAN_FOREVER : 'none' });
    await log(me.id, 'ADMIN_SET_USER_STATUS', { user_id: id, status: b.status });
    return true;
  }

  throw userError('Aksi tidak dikenal.');
});
