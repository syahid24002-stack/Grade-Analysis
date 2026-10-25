import { useEffect, useState } from 'react';
import { useFeedback } from '../lib/feedback';
import { supabase } from '../lib/supabase';
import { logActivity } from '../lib/data';
import { ACCENTS, useTheme } from '../lib/theme';

export function Settings() {
  const { toast } = useFeedback();
  const { theme, accent, setTheme, setAccent } = useTheme();
  const [allow, setAllow] = useState(true);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    supabase.from('app_settings').select('value').eq('key', 'allow_self_registration').maybeSingle()
      .then(({ data }) => { setAllow(!data || data.value !== false); setLoaded(true); });
  }, []);

  const save = async () => {
    const { error } = await supabase.from('app_settings').upsert({ key: 'allow_self_registration', value: allow });
    if (error) return toast('Gagal menyimpan pengaturan.', 'error');
    logActivity('ADMIN_SET_SELF_REGISTRATION', { allow });
    toast('Pengaturan disimpan', 'success');
  };

  return (
    <div>
      <div className="card" style={{ maxWidth: 520, marginBottom: 16 }}>
        <h4>Tampilan</h4>
        <p style={{ color: 'var(--muted)', fontSize: 13, margin: '0 0 12px' }}>Tema dan warna aksen tersimpan di perangkat ini.</p>
        <div className="seg" style={{ marginBottom: 14 }}>
          <button type="button" className={theme === 'light' ? 'on' : ''} onClick={() => setTheme('light')}>Terang</button>
          <button type="button" className={theme === 'dark' ? 'on' : ''} onClick={() => setTheme('dark')}>Gelap</button>
        </div>
        <label>Warna aksen</label>
        <div className="swatches">
          {Object.entries(ACCENTS).map(([k, h]) => (
            <button key={k} type="button" title={k} className={`swatch${k === accent ? ' on' : ''}`} style={{ background: `hsl(${h} 80% 62%)` }} onClick={() => setAccent(k)} />
          ))}
        </div>
      </div>

      <div className="card" style={{ maxWidth: 520, marginBottom: 16 }}>
        <h4>Pendaftaran mandiri</h4>
        <p style={{ color: 'var(--muted)', fontSize: 13 }}>Kalau dimatikan, tab "Daftar" di halaman login disembunyikan dan user baru hanya bisa ditambahkan manual oleh admin.</p>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="checkbox" checked={allow} disabled={!loaded} onChange={(e) => setAllow(e.target.checked)} /> Izinkan orang mendaftar sendiri
        </label>
        <button className="btn" style={{ marginTop: 12 }} onClick={save} disabled={!loaded}>Simpan</button>
      </div>

      <div className="card" style={{ maxWidth: 520 }}>
        <h4>Privasi papan peringkat</h4>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>
          Di halaman siswa, nama siswa lain selalu tampil sebagai "xxxx". Hanya nama siswa yang sedang login yang tampil. Penyamaran dilakukan di server,
          jadi nama asli tidak pernah terkirim ke browser siswa. Halaman Analisis (admin) tetap menampilkan nama asli.
        </p>
      </div>
    </div>
  );
}
