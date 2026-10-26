import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Modal } from '../components/Modal';

const Ctx = createContext(null);
export const useFeedback = () => useContext(Ctx);

/** Toast di bawah layar dan lapisan "Memuat..." untuk proses yang lama. */
export function FeedbackProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [loading, setLoading] = useState(null);
  const id = useRef(0);
  const depth = useRef(0);
  const [dialog, setDialog] = useState(null);

  /** Dialog konfirmasi: await confirm({ title, message, okText, danger }) -> true / false. */
  const confirm = useCallback((opts) => new Promise((resolve) => setDialog({ kind: 'confirm', ...opts, resolve })), []);
  /** Dialog info satu tombol: await notice({ title, message, lines }). */
  const notice = useCallback((opts) => new Promise((resolve) => setDialog({ kind: 'notice', ...opts, resolve })), []);
  const close = (v) => { dialog.resolve(v); setDialog(null); };

  const toast = useCallback((message, type = '') => {
    const key = ++id.current;
    setToasts((t) => [...t, { key, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.key !== key)), 3200);
  }, []);

  /** Menjalankan fn sambil menampilkan lapisan pemuatan. Error diteruskan ke pemanggil. */
  const busy = useCallback(async (message, fn) => {
    depth.current++;
    setLoading(message || 'Memuat...');
    try {
      return await fn();
    } finally {
      depth.current--;
      if (depth.current === 0) setLoading(null);
    }
  }, []);

  const value = useMemo(() => ({ toast, busy, confirm, notice }), [toast, busy, confirm, notice]);
  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="toast-container" role="status" aria-live="polite">
        {toasts.map((t) => <div key={t.key} className={`toast ${t.type}`}>{t.message}</div>)}
      </div>
      {dialog ? (
        <Modal
          title={dialog.title || 'Konfirmasi'} onClose={() => close(false)}
          actions={dialog.kind === 'confirm' ? (
            <>
              <button className="btn secondary" onClick={() => close(false)}>Batal</button>
              <button className={`btn${dialog.danger ? ' danger' : ''}`} autoFocus onClick={() => close(true)}>{dialog.okText || 'Ya, lanjutkan'}</button>
            </>
          ) : <button className="btn" autoFocus onClick={() => close(true)}>{dialog.okText || 'Mengerti'}</button>}
        >
          {dialog.message ? <p style={{ margin: '0 0 8px', fontSize: 14, lineHeight: 1.55 }}>{dialog.message}</p> : null}
          {dialog.lines?.length ? (
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, maxHeight: 220, overflow: 'auto', color: 'var(--muted)' }}>
              {dialog.lines.map((l, i) => <li key={i}>{l}</li>)}
            </ul>
          ) : null}
        </Modal>
      ) : null}
      {loading && (
        <div className="loading-overlay"><div className="spinner dark" /><div>{loading}</div></div>
      )}
    </Ctx.Provider>
  );
}
