import { useState } from 'react';
import { Icon } from './Icon';

export function PasswordField({ value, onChange, placeholder, minLength, autoComplete, required }) {
  const [show, setShow] = useState(false);
  return (
    <div className="password-field-wrap">
      <input
        type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder} minLength={minLength} autoComplete={autoComplete} required={required}
      />
      <button type="button" className="password-toggle-btn" onClick={() => setShow((s) => !s)} aria-label={show ? 'Sembunyikan password' : 'Lihat password'}>
        <Icon name={show ? 'eyeoff' : 'eye'} />
      </button>
    </div>
  );
}
