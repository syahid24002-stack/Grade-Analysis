import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

const Ctx = createContext(null);
export const useFeedback = () => useContext(Ctx);

/** Toast di bawah layar dan lapisan "Memuat..." untuk proses yang lama. */
export function FeedbackProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [loading, setLoading] = useState(null);
  const id = useRef(0);
  const depth = useRef(0);

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

  const value = useMemo(() => ({ toast, busy }), [toast, busy]);
  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="toast-container" role="status" aria-live="polite">
        {toasts.map((t) => <div key={t.key} className={`toast ${t.type}`}>{t.message}</div>)}
      </div>
      {loading && (
        <div className="loading-overlay"><div className="spinner dark" /><div>{loading}</div></div>
      )}
    </Ctx.Provider>
  );
}
