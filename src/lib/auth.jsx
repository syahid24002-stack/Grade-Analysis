import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase, isConfigured } from './supabase';
import { api } from './api';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

function translate(error) {
  const m = String(error?.message || '');
  if (/invalid login|invalid credentials/i.test(m)) return 'Email atau password salah.';
  if (/banned/i.test(m)) return 'Akun Anda tidak aktif. Hubungi admin.';
  if (/fetch|network/i.test(m)) return 'Koneksi ke server gagal. Periksa internet Anda.';
  return 'Login gagal. Coba lagi.';
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined); // undefined = sesi belum dicek
  const [profile, setProfile] = useState(null);
  const [ready, setReady] = useState(!isConfigured);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!isConfigured) return undefined;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const checked = session !== undefined;
  const userId = session?.user?.id || null;

  useEffect(() => {
    if (!checked) return undefined;
    if (!userId) {
      setProfile(null);
      setReady(true);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      let p = null;
      // Profil dibuat otomatis oleh trigger saat akun dibuat; beri jeda singkat bila belum muncul.
      for (let i = 0; i < 3 && !p; i++) {
        const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
        p = data;
        if (!p) await new Promise((r) => setTimeout(r, 400));
      }
      if (cancelled) return;
      if (!p) { setNotice('Profil akun tidak ditemukan. Hubungi admin.'); await supabase.auth.signOut(); return; }
      if (p.status !== 'ACTIVE') { setNotice('Akun Anda tidak aktif. Hubungi admin.'); await supabase.auth.signOut(); return; }
      setProfile(p);
      setReady(true);
    })();
    return () => { cancelled = true; };
  }, [checked, userId]);

  const signIn = useCallback(async (email, password) => {
    setNotice('');
    const { error } = await supabase.auth.signInWithPassword({ email: String(email).trim().toLowerCase(), password });
    if (error) throw new Error(translate(error));
    supabase.rpc('touch_login').then(() => {}, () => {});
  }, []);

  const register = useCallback(async ({ name, email, password, branch }) => {
    await api('register', { body: { name, email, password, branch } });
    await signIn(email, password);
  }, [signIn]);

  const signOut = useCallback(async () => {
    setProfile(null);
    await supabase.auth.signOut();
  }, []);

  const changePassword = useCallback(async (oldPassword, newPassword) => {
    const { error: e1 } = await supabase.auth.signInWithPassword({ email: profile.email, password: oldPassword });
    if (e1) throw new Error('Password lama tidak sesuai.');
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw new Error('Gagal mengubah password. Coba lagi.');
  }, [profile]);

  const value = useMemo(
    () => ({ session, profile, ready, notice, setNotice, signIn, register, signOut, changePassword }),
    [session, profile, ready, notice, signIn, register, signOut, changePassword],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
