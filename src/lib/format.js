/** Angka satu desimal dengan koma, mis. 72,5. */
export function f1(x) {
  return x == null || Number.isNaN(x) ? '-' : String(Math.round(x * 10) / 10).replace('.', ',');
}
export function greeting() {
  const h = new Date().getHours();
  return h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 19 ? 'Selamat sore' : 'Selamat malam';
}
export function todayLong() {
  return new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}
export function firstName(n) {
  return String(n || '').trim().split(/\s+/)[0] || '';
}
export function scoreColor(p) {
  return p < 50 ? 'var(--rose)' : p < 75 ? 'var(--peach)' : 'var(--mint)';
}
export function validEmail(e) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || '').trim());
}
