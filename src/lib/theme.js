// Tema terang/gelap dan warna aksen gaya LifeOS. Tersimpan per perangkat.
import { useSyncExternalStore } from 'react';

export const ACCENTS = { biru: 217, ungu: 262, hijau: 160, mawar: 340, jingga: 28, tosca: 188 };
const listeners = new Set();
let version = 0;

const read = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k, v) => { try { localStorage.setItem(k, v); } catch { /* penyimpanan tidak tersedia */ } };

export function getTheme() {
  const t = read('agrade_theme');
  if (t === 'dark' || t === 'light') return t;
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
export function getAccent() {
  const a = read('agrade_accent');
  return ACCENTS[a] != null ? a : 'biru';
}

export function applyTheme() {
  const theme = getTheme();
  const accent = getAccent();
  const h = ACCENTS[accent];
  const dark = theme === 'dark';
  const r = document.documentElement;
  r.setAttribute('data-theme', theme);
  const v = dark ? {
    '--blue': `hsl(${h} 85% 68%)`, '--blue-strong': `hsl(${h} 75% 58%)`, '--blue-ink': `hsl(${h} 90% 82%)`,
    '--soft': `hsl(${h} 38% 17%)`, '--soft-2': `hsl(${h} 35% 25%)`, '--line': `hsl(${h} 32% 22%)`,
    '--bg': `hsl(${h} 45% 8%)`, '--surface': `hsl(${h} 38% 12%)`, '--side': `hsl(${h} 40% 10%)`,
    '--ink': `hsl(${h} 60% 94%)`, '--muted': `hsl(${h} 20% 70%)`, '--nav-ink': `hsl(${h} 30% 82%)`,
    '--glow': `hsl(${h} 90% 65% / 0.28)`,
  } : {
    '--blue': `hsl(${h} 80% 62%)`, '--blue-strong': `hsl(${h} 70% 52%)`, '--blue-ink': `hsl(${h} 62% 40%)`,
    '--soft': `hsl(${h} 100% 97%)`, '--soft-2': `hsl(${h} 80% 92%)`, '--line': `hsl(${h} 45% 91%)`,
    '--bg': `hsl(${h} 70% 97.5%)`, '--surface': '#ffffff', '--side': `hsl(${h} 100% 98.5%)`,
    '--ink': `hsl(${h} 38% 20%)`, '--muted': `hsl(${h} 17% 47%)`, '--nav-ink': `hsl(${h} 25% 33%)`,
    '--glow': `hsl(${h} 90% 60% / 0.30)`,
  };
  Object.entries(v).forEach(([k, val]) => r.style.setProperty(k, val));
  r.style.setProperty('--hue', h);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? `hsl(${h} 45% 8%)` : `hsl(${h} 80% 62%)`);
}

function emit() { version++; listeners.forEach((l) => l()); }
export function setTheme(t) { write('agrade_theme', t); applyTheme(); emit(); }
export function toggleTheme() { setTheme(getTheme() === 'dark' ? 'light' : 'dark'); }
export function setAccent(k) { write('agrade_accent', k); applyTheme(); emit(); }

/** Hook: komponen dirender ulang saat tema atau aksen berubah. */
export function useTheme() {
  useSyncExternalStore((cb) => { listeners.add(cb); return () => listeners.delete(cb); }, () => version);
  return { theme: getTheme(), accent: getAccent(), setTheme, setAccent, toggleTheme };
}
