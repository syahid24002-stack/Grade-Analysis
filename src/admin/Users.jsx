import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFeedback } from '../lib/feedback';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';
import { listProfiles } from '../lib/data';
import { parseCsv } from '../lib/csv';
import { BRANCHES, MIN_PASSWORD } from '../lib/constants';
import { Modal } from '../components/Modal';
import { Pagination } from '../components/Pagination';
import { PasswordField } from '../components/PasswordField';

const EMPTY = { name: '', email: '', password: '', branch: BRANCHES[0], role: 'USER' };
const CHUNK = 40; // baris per panggilan impor, agar tiap panggilan selesai cepat

export function Users({ intent, clearIntent }) {
  const { profile: me } = useAuth();
  const { toast, busy } = useFeedback();
  const [users, setUsers] = useState(null);
  const [q, setQ] = useState('');
  const [branch, setBranch] = useState('');
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const [form, setForm] = useState(null);
  const [importing, setImporting] = useState(false);
  const [file, setFile] = useState(null);
  const [newPw, setNewPw] = useState(null);

  const load = useCallback(async () => {
    try { setUsers(await listProfiles()); } catch (e) { setUsers([]); toast(e.message, 'error'); }
  }, [toast]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (intent === 'add-user') { setForm({ ...EMPTY }); clearIntent(); }
  }, [intent, clearIntent]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (users || []).filter((u) => (!s || u.name.toLowerCase().includes(s) || u.email.toLowerCase().includes(s)) && (!branch || u.branch === branch));
  }, [users, q, branch]);
  const pages = Math.max(1, Math.ceil(filtered.length / size));
  const cur = Math.min(page, pages);
  const items = filtered.slice((cur - 1) * size, cur * size);

  const act = async (body, okMsg) => {
    try {
      const res = await busy('Memproses...', () => api('admin-users', { body }));
      if (okMsg) toast(okMsg, 'success');
      await load();
      return res;
    } catch (e) {
      toast(e.message, 'error');
      return null;
    }
  };

  const onAction = async (u, action) => {
    if (action === 'status') await act({ action: 'set-status', user_id: u.id, status: u.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' }, 'Status user diperbarui');
    else if (action === 'role') {
      const next = u.role === 'ADMIN' ? 'USER' : 'ADMIN';
      if (window.confirm(`Ubah role ${u.name} menjadi ${next}?`)) await act({ action: 'set-role', user_id: u.id, role: next }, 'Role user diperbarui');
    } else if (action === 'reset') {
      if (!window.confirm(`Reset password untuk ${u.name}? Password lama akan tidak berlaku lagi.`)) return;
      const res = await act({ action: 'reset-password', user_id: u.id });
      if (res) setNewPw({ name: u.name, password: res.new_password });
    } else if (action === 'delete') {
      if (!window.confirm(`Hapus user "${u.name}" secara PERMANEN? Nilai ujiannya tetap tersimpan untuk laporan, tapi akunnya tidak bisa login lagi. Tindakan ini tidak dapat dibatalkan.`)) return;
      await act({ action: 'delete', user_id: u.id }, 'User dihapus');
    }
  };

  const submitForm = async () => {
    const res = await act({ action: 'create', ...form }, 'User berhasil ditambahkan');
    if (res) setForm(null);
  };

  const submitImport = async () => {
    if (!file) return toast('Pilih file CSV terlebih dahulu', 'error');
    try {
      const t = parseCsv(await file.text());
      if (t.length < 2) throw new Error('CSV tidak memiliki data.');
      const header = t[0].map((h) => h.trim().toLowerCase());
      for (const r of ['name', 'email', 'password', 'branch']) {
        if (!header.includes(r)) throw new Error(`Kolom wajib "${r}" tidak ditemukan di CSV.`);
      }
      const rows = t.slice(1).map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
      let created = 0;
      const errors = [];
      await busy('Mengimpor user...', async () => {
        for (let i = 0; i < rows.length; i += CHUNK) {
          const res = await api('admin-users', { body: { action: 'import', rows: rows.slice(i, i + CHUNK), startRow: i + 2 } });
          created += res.created_count;
          errors.push(...res.errors);
        }
      });
      toast(`${created} user berhasil diimpor${errors.length ? `, ${errors.length} baris gagal` : ''}`, errors.length ? '' : 'success');
      if (errors.length) window.alert(`Baris yang gagal:\n\n${errors.slice(0, 20).join('\n')}${errors.length > 20 ? `\n…dan ${errors.length - 20} lainnya` : ''}`);
      setImporting(false); setFile(null);
      load();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const f = (k) => (e) => setForm((s) => ({ ...s, [k]: e.target.value }));

  return (
    <div>
      <div className="search-bar">
        <input type="text" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Cari nama/email..." />
        <select value={branch} onChange={(e) => { setBranch(e.target.value); setPage(1); }}>
          <option value="">Semua cabang</option>
          {BRANCHES.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
        <button className="btn" onClick={() => setForm({ ...EMPTY })}>+ Tambah user</button>
        <button className="btn secondary" onClick={() => setImporting(true)}>Impor CSV</button>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
          <select value={size} style={{ width: 'auto' }} onChange={(e) => { setSize(Number(e.target.value)); setPage(1); }}>
            {[10, 25, 50].map((n) => <option key={n} value={n}>{n} / halaman</option>)}
          </select>
        </div>
        <div className="table-wrap responsive-cards">
          <table>
            <thead><tr><th>Nama</th><th>Email</th><th>Cabang</th><th>Role</th><th>Status</th><th>Aksi</th></tr></thead>
            <tbody>
              {users === null ? <tr><td colSpan={6}>Memuat...</td></tr> : null}
              {users && !items.length ? <tr><td colSpan={6} style={{ color: 'var(--text-muted)' }}>Tidak ada user yang cocok</td></tr> : null}
              {items.map((u) => (
                <tr key={u.id}>
                  <td data-label="Nama">{u.name}</td>
                  <td data-label="Email">{u.email}</td>
                  <td data-label="Cabang">{u.branch || '-'}</td>
                  <td data-label="Role"><span className={`badge ${u.role}`}>{u.role}</span></td>
                  <td data-label="Status"><span className={`badge ${u.status}`}>{u.status}</span></td>
                  <td data-label="Aksi">
                    {u.id === me.id ? <small>Akun Anda</small> : (
                      <select style={{ width: 'auto', minWidth: 150 }} value="" onChange={(e) => onAction(u, e.target.value)}>
                        <option value="">Aksi...</option>
                        <option value="status">{u.status === 'ACTIVE' ? 'Nonaktifkan' : 'Aktifkan'}</option>
                        <option value="role">Jadikan {u.role === 'ADMIN' ? 'USER' : 'ADMIN'}</option>
                        <option value="reset">Reset password</option>
                        <option value="delete">Hapus user</option>
                      </select>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={cur} total={filtered.length} size={size} onPage={setPage} />
      </div>

      {form ? (
        <Modal
          title="Tambah user" onClose={() => setForm(null)}
          actions={<><button className="btn secondary" onClick={() => setForm(null)}>Batal</button><button className="btn" onClick={submitForm}>Simpan</button></>}
        >
          <div className="field"><label>Nama lengkap</label><input type="text" value={form.name} onChange={f('name')} /></div>
          <div className="field"><label>Email</label><input type="email" value={form.email} onChange={f('email')} /></div>
          <div className="field"><label>Password</label>
            <PasswordField value={form.password} onChange={(v) => setForm((s) => ({ ...s, password: v }))} minLength={MIN_PASSWORD} placeholder={`Minimal ${MIN_PASSWORD} karakter`} autoComplete="new-password" />
          </div>
          <div className="grid cols-2">
            <div className="field"><label>Cabang</label>
              <select value={form.branch} onChange={f('branch')}>{BRANCHES.map((b) => <option key={b} value={b}>{b}</option>)}</select>
            </div>
            <div className="field"><label>Role</label>
              <select value={form.role} onChange={f('role')}><option value="USER">USER</option><option value="ADMIN">ADMIN</option></select>
            </div>
          </div>
        </Modal>
      ) : null}

      {importing ? (
        <Modal
          title="Impor user dari CSV" onClose={() => setImporting(false)}
          actions={<><button className="btn secondary" onClick={() => setImporting(false)}>Batal</button><button className="btn" onClick={submitImport}>Impor</button></>}
        >
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Kolom wajib: name, email, password, branch. Kolom opsional: role (isi "ADMIN" untuk menjadikan admin). Untuk file Excel, simpan dulu sebagai .csv.
          </p>
          <input type="file" accept=".csv,text/csv" onChange={(e) => setFile(e.target.files[0] || null)} />
        </Modal>
      ) : null}

      {newPw ? (
        <Modal title="Password baru" onClose={() => setNewPw(null)} actions={<button className="btn" onClick={() => setNewPw(null)}>Selesai</button>}>
          <p style={{ fontSize: 13.5 }}>Password baru untuk <b>{newPw.name}</b>:</p>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input readOnly value={newPw.password} style={{ fontFamily: 'monospace', fontSize: 16 }} onFocus={(e) => e.target.select()} />
            <button className="btn secondary" onClick={() => navigator.clipboard?.writeText(newPw.password).then(() => toast('Disalin', 'success'))}>Salin</button>
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Sampaikan password ini ke user secara manual. Password tidak disimpan di mana pun, jadi catat sekarang.</p>
        </Modal>
      ) : null}
    </div>
  );
}
