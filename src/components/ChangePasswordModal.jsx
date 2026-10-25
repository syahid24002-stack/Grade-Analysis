import { useState } from 'react';
import { Modal } from './Modal';
import { PasswordField } from './PasswordField';
import { useAuth } from '../lib/auth';
import { useFeedback } from '../lib/feedback';
import { MIN_PASSWORD } from '../lib/constants';

export function ChangePasswordModal({ onClose }) {
  const { changePassword } = useAuth();
  const { toast, busy } = useFeedback();
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');

  const submit = async () => {
    if (!oldPw) return toast('Isi password lama.', 'error');
    if (newPw.length < MIN_PASSWORD) return toast(`Password baru minimal ${MIN_PASSWORD} karakter.`, 'error');
    try {
      await busy('Menyimpan...', () => changePassword(oldPw, newPw));
      toast('Password berhasil diubah.', 'success');
      onClose();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  return (
    <Modal
      title="Ubah password" onClose={onClose}
      actions={<><button className="btn secondary" onClick={onClose}>Batal</button><button className="btn" onClick={submit}>Simpan</button></>}
    >
      <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 10 }}>Masukkan password lama dan password baru Anda.</div>
      <div className="field"><label>Password lama</label><PasswordField value={oldPw} onChange={setOldPw} autoComplete="current-password" /></div>
      <div className="field"><label>Password baru</label><PasswordField value={newPw} onChange={setNewPw} minLength={MIN_PASSWORD} placeholder={`Minimal ${MIN_PASSWORD} karakter`} autoComplete="new-password" /></div>
    </Modal>
  );
}
