/** Cincin nilai (seperti Skor Hidup di LifeOS). value 0..100. */
export function Ring({ value, size = 76, stroke = 8, color, big, small }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, (value || 0) / 100));
  return (
    <div className="ring-wrap" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`}>
        <circle className="ring-bg" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} />
        <circle
          className="ring-fg" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} style={{ '--c': c, strokeDashoffset: c * (1 - p), ...(color ? { stroke: color } : {}) }}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="ring-center">
        <strong style={{ fontSize: Math.round(size / 4) }}>{big}</strong>
        {small ? <span>{small}</span> : null}
      </div>
    </div>
  );
}
