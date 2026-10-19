'use client';

import { useState } from 'react';
import { KeyRound, ShieldCheck } from 'lucide-react';
import { authService } from '../../../services';

export default function ChangePasswordCard() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setMessage('');
    if (newPassword !== confirmation) {
      setError('La contraseña nueva y su confirmación no coinciden.');
      return;
    }
    if (newPassword.length < 12) {
      setError('Usa una contraseña nueva de al menos 12 caracteres.');
      return;
    }

    setBusy(true);
    try {
      await authService.changePassword(currentPassword, newPassword, mfaCode.trim() || undefined);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmation('');
      setMfaCode('');
      setMessage('Contraseña actualizada. Cerrando todas las sesiones por seguridad…');
      window.setTimeout(() => window.location.assign('/access'), 1200);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo actualizar la contraseña.');
    } finally {
      setBusy(false);
    }
  };

  return <section className="panel mfa-settings-card" aria-labelledby="change-password-title">
    <div className="mfa-settings-heading"><span className="mfa-settings-icon"><KeyRound size={19} /></span><div><span className="eyebrow">Seguridad de la cuenta</span><h2 id="change-password-title">Cambiar contraseña</h2><p>Confirma tu contraseña actual. Al guardar, se cerrarán las sesiones abiertas de esta cuenta.</p></div></div>
    <form className="mfa-enrollment-form" onSubmit={submit}>
      <label className="field"><span>Contraseña actual</span><input type="password" autoComplete="current-password" required maxLength={128} value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></label>
      <label className="field"><span>Nueva contraseña</span><input type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /><small>Usa 12 o más caracteres; el máximo compatible es 72 bytes UTF-8.</small></label>
      <label className="field"><span>Confirmar nueva contraseña</span><input type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label>
      <label className="field"><span>Código MFA o de recuperación, si está activada</span><input type="text" autoComplete="one-time-code" autoCapitalize="characters" maxLength={32} value={mfaCode} onChange={(event) => setMfaCode(event.target.value)} /></label>
      {message && <p className="mfa-settings-message" role="status"><ShieldCheck size={15} />{message}</p>}
      {error && <p className="mfa-settings-error" role="alert">{error}</p>}
      <button className="button button-primary" type="submit" disabled={busy}>{busy ? 'Actualizando…' : 'Actualizar contraseña'}</button>
    </form>
  </section>;
}
