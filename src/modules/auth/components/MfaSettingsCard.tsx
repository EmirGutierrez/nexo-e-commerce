'use client';

import { useCallback, useEffect, useState } from 'react';
import { KeyRound, ShieldCheck } from 'lucide-react';
import { mfaService, type MfaEnrollment, type MfaStatus } from '../../../services';

export default function MfaSettingsCard({ hidden = false }: { hidden?: boolean }) {
  const [status, setStatus] = useState<MfaStatus | null>(null);
  const [enrollment, setEnrollment] = useState<MfaEnrollment | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [startPassword, setStartPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [rotatePassword, setRotatePassword] = useState('');
  const [rotateCode, setRotateCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const refresh = useCallback(async () => {
    setStatus(await mfaService.status());
  }, []);

  useEffect(() => {
    let active = true;
    mfaService.status().then((result) => { if (active) setStatus(result); })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'No se pudo consultar la seguridad de la cuenta.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const startEnrollment = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true); setError(''); setMessage('');
    try { setEnrollment(await mfaService.beginEnrollment(startPassword)); setStartPassword(''); setVerificationCode(''); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo iniciar la configuración MFA.'); }
    finally { setBusy(false); }
  };

  const completeEnrollment = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      const result = await mfaService.completeEnrollment(verificationCode.trim());
      setRecoveryCodes(result.recoveryCodes);
      setEnrollment(null); setVerificationCode('');
      await refresh();
      setMessage('La verificación en dos pasos quedó activa. Guarda los códigos de recuperación.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo confirmar el código.'); }
    finally { setBusy(false); }
  };

  const disable = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      await mfaService.disable(currentPassword, disableCode.trim());
      setCurrentPassword(''); setDisableCode(''); setRecoveryCodes([]); setEnrollment(null);
      await refresh();
      setMessage('La verificación en dos pasos se desactivó.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo desactivar MFA.'); }
    finally { setBusy(false); }
  };

  const rotate = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      const result = await mfaService.rotateRecoveryCodes(rotatePassword, rotateCode.trim());
      setRecoveryCodes(result.recoveryCodes); setRotatePassword(''); setRotateCode('');
      await refresh();
      setMessage('Se generaron nuevos códigos y los anteriores dejaron de funcionar.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudieron regenerar los códigos.'); }
    finally { setBusy(false); }
  };

  return <section hidden={hidden} className="panel mfa-settings-card" aria-labelledby="mfa-settings-title">
    <div className="mfa-settings-heading"><span className="mfa-settings-icon"><ShieldCheck size={19} /></span><div><span className="eyebrow">Seguridad de la cuenta</span><h2 id="mfa-settings-title">Verificación en dos pasos</h2><p>Usa una aplicación de autenticación al iniciar sesión en web o móvil.</p></div></div>
    {loading ? <p className="mfa-settings-muted" role="status">Consultando configuración…</p> : !status ? <p className="mfa-settings-muted">No se pudo consultar la configuración. Recarga la página para intentarlo de nuevo.</p> : status.enabled ? <>
      <div className="mfa-settings-state is-enabled"><span />Activa · {status.recoveryCodesRemaining} códigos de recuperación disponibles</div>
      {recoveryCodes.length > 0 && <div className="mfa-recovery-panel"><strong>Guarda estos códigos en un lugar seguro</strong><p>Cada código sirve una sola vez. Esta lista no volverá a mostrarse.</p><ul>{recoveryCodes.map((code) => <li key={code}><code>{code}</code></li>)}</ul><button type="button" className="button button-secondary" onClick={() => setRecoveryCodes([])}>Ya los guardé</button></div>}
      <form className="mfa-disable-form" onSubmit={rotate}><p>Si perdiste tus códigos, puedes reemplazarlos con tu contraseña y el segundo factor. Los anteriores quedarán revocados.</p><label className="field"><span>Contraseña actual</span><input type="password" autoComplete="current-password" required maxLength={128} value={rotatePassword} onChange={(event) => setRotatePassword(event.target.value)} /></label><label className="field"><span>Código de autenticación o recuperación</span><input type="text" autoComplete="one-time-code" autoCapitalize="characters" required maxLength={32} value={rotateCode} onChange={(event) => setRotateCode(event.target.value)} /></label><button className="button button-secondary" type="submit" disabled={busy}>{busy ? 'Verificando…' : 'Regenerar códigos'}</button></form>
      <form className="mfa-disable-form" onSubmit={disable}><p>Para desactivarla confirma tu contraseña y un código actual o de recuperación.</p><label className="field"><span>Contraseña actual</span><input type="password" autoComplete="current-password" required maxLength={128} value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></label><label className="field"><span>Código de autenticación o recuperación</span><input type="text" autoComplete="one-time-code" autoCapitalize="characters" required maxLength={32} value={disableCode} onChange={(event) => setDisableCode(event.target.value)} /></label><button className="button button-secondary" type="submit" disabled={busy}>{busy ? 'Verificando…' : 'Desactivar verificación'}</button></form>
    </> : <>
      <div className="mfa-settings-state"><span />No está activa</div>
      {enrollment ? <form className="mfa-enrollment-form" onSubmit={completeEnrollment}>
        <div className="mfa-enrollment-key"><KeyRound size={16} /><div><strong>Clave para tu aplicación</strong><code>{enrollment.secret}</code><small>Agrega una cuenta manual en tu aplicación de autenticación con esta clave.</small></div></div>
        <details className="mfa-otpauth-details"><summary>Ver enlace otpauth</summary><code>{enrollment.otpauthUri}</code></details>
        <label className="field"><span>Código de seis dígitos</span><input type="text" inputMode="numeric" autoComplete="one-time-code" required pattern="[0-9]{6}" maxLength={6} value={verificationCode} onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" /></label>
        <button className="button button-primary" type="submit" disabled={busy || verificationCode.length !== 6}>{busy ? 'Confirmando…' : 'Activar verificación'}</button>
      </form> : <form className="mfa-enrollment-form" onSubmit={startEnrollment}><p>Confirma tu contraseña para iniciar el enrolamiento.</p><label className="field"><span>Contraseña actual</span><input type="password" autoComplete="current-password" required maxLength={128} value={startPassword} onChange={(event) => setStartPassword(event.target.value)} /></label><button className="button button-primary" type="submit" disabled={busy}>{busy ? 'Preparando…' : 'Configurar verificación en dos pasos'}</button></form>}
    </>}
    {message && <p className="mfa-settings-message" role="status">{message}</p>}
    {error && <p className="mfa-settings-error" role="alert">{error}</p>}
  </section>;
}
