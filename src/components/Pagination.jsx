export function Pagination({ page, total, size, onPage }) {
  if (!total) return null;
  const pages = Math.max(1, Math.ceil(total / size));
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, flexWrap: 'wrap', gap: 8 }}>
      <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Halaman {page} dari {pages} ({total} data)</span>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn small secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>Sebelumnya</button>
        <button className="btn small secondary" disabled={page >= pages} onClick={() => onPage(page + 1)}>Berikutnya</button>
      </div>
    </div>
  );
}
