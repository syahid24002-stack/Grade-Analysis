/**
 * Grafik garis sederhana (SVG, tanpa pustaka).
 * points: [{ label, a, b }]  a = garis utama, b = garis pembanding (boleh kosong).
 */
export function TrendChart({ points, aName = 'Nilaimu', bName = 'Rata-rata semua', height = 220 }) {
  const W = 640, H = height, L = 40, R = 30, T = 12, B = 38;
  const vals = points.flatMap((p) => [p.a, p.b]).filter((v) => v != null);
  const max = Math.max(100, ...vals);
  const x = (i) => (points.length === 1 ? (L + W - R) / 2 : L + (i * (W - L - R)) / (points.length - 1));
  const y = (v) => T + (H - T - B) * (1 - v / max);
  const line = (key) => points.map((p, i) => (p[key] == null ? null : `${x(i)},${y(p[key])}`)).filter(Boolean).join(' ');
  const hasB = points.some((p) => p.b != null);
  const step = Math.ceil(points.length / 6);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(max * t));

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }} role="img" aria-label="Grafik nilai">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth="1" />
            <text x={L - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--muted)">{t}</text>
          </g>
        ))}
        {hasB ? <polyline points={line('b')} fill="none" stroke="var(--muted)" strokeWidth="2" strokeDasharray="5 4" strokeLinejoin="round" /> : null}
        <polyline points={line('a')} fill="none" stroke="var(--blue)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <g key={i}>
            {p.b != null ? <circle cx={x(i)} cy={y(p.b)} r="3" fill="var(--muted)"><title>{`${p.label}: ${bName} ${Math.round(p.b * 10) / 10}`}</title></circle> : null}
            {p.a != null ? <circle cx={x(i)} cy={y(p.a)} r="5" fill="var(--surface)" stroke="var(--blue)" strokeWidth="3"><title>{`${p.label}: ${aName} ${Math.round(p.a * 10) / 10}`}</title></circle> : null}
            {i % step === 0 ? (
              <text x={x(i)} y={H - 14} textAnchor="middle" fontSize="11" fill="var(--muted)">{p.label.length > 14 ? `${p.label.slice(0, 13)}…` : p.label}</text>
            ) : null}
          </g>
        ))}
      </svg>
      <div style={{ display: 'flex', gap: 16, fontSize: 12.5, color: 'var(--muted)', flexWrap: 'wrap', marginTop: 4 }}>
        <span><b style={{ color: 'var(--blue)' }}>━</b> {aName}</span>
        {hasB ? <span><b>╌</b> {bName}</span> : null}
      </div>
    </div>
  );
}
