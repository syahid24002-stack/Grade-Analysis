import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../lib/auth';
import { useTheme } from '../lib/theme';
import { Icon, ThemeIcon } from '../components/Icon';
import { Palette } from '../components/Palette';
import { ChangePasswordModal } from '../components/ChangePasswordModal';
import { Dashboard } from './Dashboard';
import { Analysis } from './Analysis';
import { Scores } from './Scores';
import { Users } from './Users';
import { Settings } from './Settings';
import { History } from './History';
import { Compare } from './Compare';
import { ActivityLog } from './ActivityLog';

const VIEWS = {
  dashboard: { title: 'Dashboard', Comp: Dashboard },
  analysis: { title: 'Analisis', Comp: Analysis },
  compare: { title: 'Bandingkan ujian', Comp: Compare },
  scores: { title: 'Ujian & Nilai', Comp: Scores },
  history: { title: 'Riwayat siswa', Comp: History },
  users: { title: 'Users', Comp: Users },
  log: { title: 'Log aktivitas', Comp: ActivityLog },
  settings: { title: 'Pengaturan', Comp: Settings },
};
const NAV = [
  { label: 'Ringkasan', items: [['dashboard', 'dashboard', 'Dashboard'], ['analysis', 'chart', 'Analisis'], ['compare', 'chart', 'Bandingkan ujian']] },
  { label: 'Data', items: [['scores', 'upload', 'Ujian & Nilai'], ['history', 'chart', 'Riwayat siswa'], ['users', 'users', 'Users']] },
  { label: 'Sistem', items: [['log', 'file', 'Log aktivitas'], ['settings', 'sliders', 'Pengaturan']] },
];

const viewFromHash = () => {
  const v = window.location.hash.replace(/^#\/?/, '');
  return VIEWS[v] ? v : 'dashboard';
};

export function AdminShell() {
  const { profile, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [view, setView] = useState(viewFromHash);
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('agrade_collapsed') === '1' && window.innerWidth > 900; } catch { return false; }
  });
  const [open, setOpen] = useState(false);
  const [palette, setPalette] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [intent, setIntent] = useState(null);
  const sideRef = useRef(null);

  useEffect(() => {
    const onHash = () => setView(viewFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const go = useCallback((v, why = null) => {
    setIntent(why);
    window.location.hash = `#/${v}`;
    setView(v);
    setOpen(false);
  }, []);

  const toggleCollapse = () => {
    setCollapsed((c) => {
      try { localStorage.setItem('agrade_collapsed', c ? '0' : '1'); } catch { /* abaikan */ }
      return !c;
    });
  };

  // Ctrl K dan Esc
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette(true); }
      else if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // Geser dari tepi kiri untuk membuka menu (ponsel), geser ke kiri untuk menutup
  useEffect(() => {
    let sx = null, sy = null;
    const start = (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; };
    const end = (e) => {
      if (sx == null) return;
      const dx = e.changedTouches[0].clientX - sx;
      const dy = Math.abs(e.changedTouches[0].clientY - sy);
      if (window.innerWidth <= 900 && dy < 60) {
        if (sx < 24 && dx > 70) setOpen(true);
        else if (sideRef.current?.classList.contains('open') && dx < -70) setOpen(false);
      }
      sx = null;
    };
    document.addEventListener('touchstart', start, { passive: true });
    document.addEventListener('touchend', end, { passive: true });
    return () => { document.removeEventListener('touchstart', start); document.removeEventListener('touchend', end); };
  }, []);

  const paletteItems = useMemo(() => [
    { t: 'Dashboard', i: 'dashboard', f: () => go('dashboard') },
    { t: 'Analisis', i: 'chart', f: () => go('analysis') },
    { t: 'Bandingkan ujian', i: 'chart', f: () => go('compare') },
    { t: 'Ujian & Nilai', i: 'upload', f: () => go('scores') },
    { t: 'Riwayat siswa', i: 'chart', f: () => go('history') },
    { t: 'Users', i: 'users', f: () => go('users') },
    { t: 'Log aktivitas', i: 'file', f: () => go('log') },
    { t: 'Pengaturan', i: 'sliders', f: () => go('settings') },
    { t: 'Unggah nilai baru', i: 'plus', f: () => go('scores', 'upload') },
    { t: 'Tambah user', i: 'plus', f: () => go('users', 'add-user') },
    { t: 'Ganti tema terang/gelap', i: 'moon', f: toggleTheme },
    { t: 'Keluar', i: 'logout', f: signOut },
  ], [go, signOut]); // eslint-disable-line react-hooks/exhaustive-deps

  const { title, Comp } = VIEWS[view];

  return (
    <div id="page-admin" className={collapsed ? 'collapsed' : ''}>
      <div className={`drawer-backdrop${open ? ' open' : ''}`} onClick={() => setOpen(false)} />
      <aside className={`sidebar${open ? ' open' : ''}`} ref={sideRef}>
        <div className="brand">
          <div className="brand-mark">A</div>
          <div><strong>Agrade</strong><small>Ruang admin</small></div>
        </div>
        <button type="button" className="search-trigger" onClick={() => setPalette(true)}>
          <Icon name="search" /><span>Cari &amp; pindah halaman</span><kbd>Ctrl K</kbd>
        </button>
        <nav>
          {NAV.map((g) => (
            <div className="nav-group" key={g.label}>
              <div className="nav-label">{g.label}</div>
              {g.items.map(([key, icon, label]) => (
                <a key={key} href={`#/${key}`} className={view === key ? 'active' : ''} onClick={(e) => { e.preventDefault(); go(key); }}>
                  <Icon name={icon} /><span>{label}</span>
                </a>
              ))}
            </div>
          ))}
        </nav>
        <div className="account">
          <div className="avatar">{(profile.name || 'A').charAt(0).toUpperCase()}</div>
          <div className="account-info"><b>{profile.name || 'Admin'}</b><small>{profile.email}</small></div>
          <button className="icon-btn" onClick={() => setShowPw(true)} title="Ubah password"><Icon name="lock" /></button>
          <button className="icon-btn" onClick={signOut} title="Keluar"><Icon name="logout" /></button>
        </div>
      </aside>

      <main className="main-content">
        <div className="topbar">
          <div className="topbar-left">
            <button className="icon-btn mobile-menu-btn" onClick={() => setOpen(true)} title="Menu"><Icon name="menu" /></button>
            <button className="icon-btn only-desktop" onClick={toggleCollapse} title="Ciutkan menu"><Icon name="panel" /></button>
            <h2>{title}</h2>
          </div>
          <div className="topbar-actions">
            <button className="icon-btn" onClick={() => setPalette(true)} title="Cari (Ctrl K)"><Icon name="search" /></button>
            <button className="icon-btn" onClick={toggleTheme} title="Ganti tema"><ThemeIcon theme={theme} /></button>
          </div>
        </div>
        <div className="admin-view" key={view}>
          <Comp go={go} intent={intent} clearIntent={() => setIntent(null)} />
        </div>
      </main>

      {palette ? <Palette items={paletteItems} onClose={() => setPalette(false)} /> : null}
      {showPw ? <ChangePasswordModal onClose={() => setShowPw(false)} /> : null}
    </div>
  );
}
