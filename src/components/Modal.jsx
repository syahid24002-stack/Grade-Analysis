import { useEffect } from 'react';

export function Modal({ title, onClose, children, actions }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal-box">
        <h3>{title}</h3>
        {children}
        {actions ? <div className="modal-actions">{actions}</div> : null}
      </div>
    </div>
  );
}
