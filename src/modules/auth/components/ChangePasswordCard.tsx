'use client';

import { useState } from 'react';
import { Eye, EyeOff, KeyRound, ShieldCheck } from 'lucide-react';
import { authService } from '../../../services';

type PasswordFieldProps = {
  id: string;
  label: string;
  autoComplete: string;
  value: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  minLength?: number;
  hint?: string;
};

function PasswordField({ id, label, autoComplete, value, onChange, minLength, hint }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const VisibilityIcon = visible ? EyeOff : Eye;

  return <div className="field password-field">
    <label htmlFor={id}><span>{label}</span></label>
    <div className="password-input-wrap">
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        autoComplete={autoComplete}
        required
        minLength={minLength}
        maxLength={128}
        value={value}
        onChange={onChange}
      />
      <button
        className="password-visibility-toggle"
        type="button"
        aria-label={`${visible ? 'Ocultar' : 'Mostrar'} ${label.toLowerCase()}`}
        aria-pressed={visible}
        onClick={() => setVisible((wasVisible) => !wasVisible)}
      >
        <VisibilityIcon size={17} aria-hidden="true" />
      </button>
    </div>
    {hint && <small>{hint}</small>}
  </div>;
}

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
      <PasswordField id="current-password" label="Contraseña actual" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
      <PasswordField id="new-password" label="Nueva contraseña" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={12} hint="Usa 12 o más caracteres; el máximo compatible es 72 bytes UTF-8." />
      <PasswordField id="confirm-new-password" label="Confirmar nueva contraseña" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} minLength={12} />
      <label className="field"><span>Código MFA o de recuperación, si está activada</span><input type="text" autoComplete="one-time-code" autoCapitalize="characters" maxLength={32} value={mfaCode} onChange={(event) => setMfaCode(event.target.value)} /></label>
      {message && <p className="mfa-settings-message" role="status"><ShieldCheck size={15} />{message}</p>}
      {error && <p className="mfa-settings-error" role="alert">{error}</p>}
      <button className="button button-primary" type="submit" disabled={busy}>{busy ? 'Actualizando…' : 'Actualizar contraseña'}</button>
    </form>
  </section>;
}
