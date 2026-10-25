import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { useFeedback } from '../lib/feedback';
import { supabase } from '../lib/supabase';
import { useTheme } from '../lib/theme';
import { BRANCHES, MIN_PASSWORD } from '../lib/constants';
import { ThemeIcon } from '../components/Icon';
import { PasswordField } from '../components/PasswordField';

export function Login() {
  const { signIn, register, notice, setNotice } = useAuth();
  const { busy } = useFeedback();
  const { theme, toggleTheme } = useTheme();
  const [tab, setTab] = useState('login');
  const [allowReg, setAllowReg] = useState(true);
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);
  const [f, setF] = useState({ email: '', password: '', name: '', branch: '' });
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }));

  useEffect(() => {
    supabase.from('app_settings').select('value').eq('key', 'allow_self_registration').maybeSingle()
      .then(({ data }) => { if (data && data.value === false) setAllowReg(false); }, () => {});
  }, []);

  const shown = error || notice;
  const switchTab = (t) => { setTab(t); setError(''); setNotice(''); };

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setNotice('');
    if (tab === 'register' && !f.branch) return setError('Pilih cabang terlebih dahulu.');
    setWorking(true);
    try {
      if (tab === 'login') await signIn(f.email, f.password);
      else await busy('Membuat akun...', () => register({ name: f.name, email: f.email, password: f.password, branch: f.branch }));
    } catch (err) {
      setError(err.message);
    } finally {
      setWorking(false);
    }
  };

  return (
    <div id="page-login">
      <button type="button" className="icon-btn auth-theme" onClick={toggleTheme} title="Ganti tema"><ThemeIcon theme={theme} /></button>
      <div className="auth-box">
        <div className="auth-brand">
          <div className="brand-mark">A</div>
          <div>
            <h1>Agrade</h1>
            <p className="sub">Masuk untuk melihat hasil asesmen atau mengelola nilai.</p>
          </div>
        </div>
        {shown ? <div className="auth-error" role="alert">{shown}</div> : null}

        {allowReg ? (
          <div className="auth-tabs">
            <div className={`auth-tab${tab === 'login' ? ' active' : ''}`} onClick={() => switchTab('login')}>Masuk</div>
            <div className={`auth-tab${tab === 'register' ? ' active' : ''}`} onClick={() => switchTab('register')}>Daftar</div>
          </div>
        ) : null}

        <form onSubmit={submit}>
          {tab === 'register' ? (
            <div className="field"><label>Nama lengkap</label><input type="text" required value={f.name} onChange={(e) => set('name')(e.target.value)} placeholder="Nama Anda" autoComplete="name" /></div>
          ) : null}
          <div className="field"><label>Email</label><input type="email" required value={f.email} onChange={(e) => set('email')(e.target.value)} placeholder="nama@email.com" autoComplete="email" /></div>
          <div className="field">
            <label>Password</label>
            <PasswordField
              value={f.password} onChange={set('password')} required minLength={tab === 'register' ? MIN_PASSWORD : undefined}
              placeholder={tab === 'register' ? `Minimal ${MIN_PASSWORD} karakter` : 'Password'} autoComplete={tab === 'register' ? 'new-password' : 'current-password'}
            />
          </div>
          {tab === 'register' ? (
            <div className="field">
              <label>Cabang</label>
              <select required value={f.branch} onChange={(e) => set('branch')(e.target.value)}>
                <option value="">-- Pilih cabang --</option>
                {BRANCHES.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
          ) : null}
          <button className="btn block" type="submit" disabled={working}>
            {working ? <span className="spinner" /> : tab === 'login' ? 'Masuk' : 'Daftar'}
          </button>
        </form>
        {!allowReg ? <p className="auth-note">Pendaftaran mandiri dimatikan. Hubungi admin untuk dibuatkan akun.</p> : null}
      </div>
    </div>
  );
}

