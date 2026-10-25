import { useAuth } from './lib/auth';
import { isConfigured } from './lib/supabase';
import { Login } from './views/Login';
import { StudentApp } from './views/StudentApp';
import { AdminShell } from './admin/AdminShell';

function Setup() {
  return (
    <div id="page-login">
      <div className="auth-box">
        <div className="auth-brand"><div className="brand-mark">A</div><div><h1>Agrade</h1><p className="sub">Aplikasi belum tersambung ke Supabase.</p></div></div>
        <p style={{ fontSize: 14 }}>
          Isi <code>VITE_SUPABASE_URL</code> dan <code>VITE_SUPABASE_ANON_KEY</code> (di berkas <code>.env</code> saat lokal, atau di
          <b> Vercel › Settings › Environment Variables</b>), lalu jalankan ulang atau deploy ulang. Langkah lengkap ada di README.
        </p>
      </div>
    </div>
  );
}

export default function App() {
  const { ready, profile } = useAuth();
  if (!isConfigured) return <Setup />;
  if (!ready) return <div className="loading-overlay"><div className="spinner dark" /><div>Memuat sesi...</div></div>;
  if (!profile) return <Login />;
  return profile.role === 'ADMIN' ? <AdminShell /> : <StudentApp />;
}
