import { useEffect, useMemo, useState } from 'react';
import { useFeedback } from '../lib/feedback';
import { listActivity, listProfiles } from '../lib/data';
import { Pagination } from '../components/Pagination';

const LABELS = {
  USER_REGISTERED: 'Pendaftaran mandiri',
  ADMIN_CREATED_USER: 'Admin menambah user',
  ADMIN_IMPORTED_USERS: 'Impor user dari CSV',
  ADMIN_RESET_USER_PASSWORD: 'Reset password user',
  ADMIN_DELETED_USER: 'Hapus user',
  ADMIN_SET_USER_ROLE: 'Ubah role user',
  ADMIN_SET_USER_STATUS: 'Ubah status user',
  ADMIN_IMPORT_SCORES: 'Unggah nilai',
  ADMIN_SAVE_ASSESSMENT: 'Simpan pengaturan ujian',
  ADMIN_DELETE_ASSESSMENT: 'Hapus ujian',
  ADMIN_SET_SELF_REGISTRATION: 'Ubah pendaftaran mandiri',
  UNAUTHORIZED_ADMIN_ACCESS_ATTEMPT: 'Percobaan akses admin ditolak',
};

const detailText = (d) => Object.entries(d || {}).filter(([k]) => k !== 'user_id').map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join(' · ');

/** Riwayat aktivitas penting (300 terakhir): siapa melakukan apa dan kapan. */
export function ActivityLog() {
  const { toast } = useFeedback();
  const [log, setLog] = useState(null);
  const [names, setNames] = useState({});
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const size = 25;

  useEffect(() => {
    Promise.all([listActivity(300), listProfiles()]).then(
      ([l, p]) => { setLog(l); setNames(Object.fromEntries(p.map((x) => [x.id, x.name]))); },
      (e) => { setLog([]); toast(e.message, 'error'); },
    );
  }, [toast]);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (log || []).filter((r) => !s || `${LABELS[r.action] || r.action} ${names[r.user_id] || ''} ${detailText(r.details)}`.toLowerCase().includes(s));
  }, [log, names, q]);
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const cur = Math.min(page, pages);

  return (
    <div>
      <div className="search-bar">
        <input type="text" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Cari aktivitas, nama, atau detail..." />
      </div>
      <div className="card table-wrap">
        <table>
          <thead><tr><th>Waktu</th><th>Pengguna</th><th>Aktivitas</th><th>Detail</th></tr></thead>
          <tbody>
            {log === null ? <tr><td colSpan={4}>Memuat...</td></tr> : null}
            {log && !rows.length ? <tr><td colSpan={4} style={{ color: 'var(--text-muted)' }}>Belum ada aktivitas.</td></tr> : null}
            {rows.slice((cur - 1) * size, cur * size).map((r) => (
              <tr key={r.id}>
                <td style={{ whiteSpace: 'nowrap' }}>{new Date(r.created_at).toLocaleString('id-ID')}</td>
                <td>{names[r.user_id] || '-'}</td>
                <td>{LABELS[r.action] || r.action}</td>
                <td style={{ color: 'var(--muted)', fontSize: 12.5 }}>{detailText(r.details)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination page={cur} total={rows.length} size={size} onPage={setPage} />
      </div>
    </div>
  );
}
