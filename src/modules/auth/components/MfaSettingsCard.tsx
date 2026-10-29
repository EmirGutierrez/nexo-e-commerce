'use client';

import { useCallback, useEffect, useState } from 'react';
import { KeyRound, ShieldCheck } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useApp } from '../../../contexts/AppContext';
import { mfaService, type MfaEnrollment, type MfaStatus } from '../../../services';

export default function MfaSettingsCard({ hidden = false }: { hidden?: boolean }) {
  const { refreshCurrentUser } = useApp();
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

  const retryStatus = async () => {
    setLoading(true);
    setError('');
    try { setStatus(await mfaService.status()); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo consultar la seguridad de la cuenta.'); }
    finally { setLoading(false); }
  };

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
      setMessage('La verificación en dos pasos quedó activa. Guarda los códigos de recuperación.');
      try { await refresh(); await refreshCurrentUser(); }
      catch { setError('MFA quedó activa, pero no se actualizó el estado de la sesión. Recarga la página después de guardar los códigos.'); }
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo confirmar el código.'); }
    finally { setBusy(false); }
  };

  const disable = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      await mfaService.disable(currentPassword, disableCode.trim());
      setCurrentPassword(''); setDisableCode(''); setRecoveryCodes([]); setEnrollment(null);
      setMessage('La verificación en dos pasos se desactivó.');
      try { await refresh(); await refreshCurrentUser(); }
      catch { setError('MFA se desactivó, pero no se actualizó el estado de la sesión. Recarga la página para continuar.'); }
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
    {loading ? <p className="mfa-settings-muted" role="status">Consultando configuración…</p> : !status ? <div className="mfa-status-unavailable"><p className="mfa-settings-error" role="alert">{error || 'No se pudo consultar la configuración de seguridad.'}</p><button type="button" className="button button-secondary" onClick={() => void retryStatus()}>Reintentar</button></div> : status.enabled ? <>
      <div className="mfa-settings-state is-enabled"><span />Activa{status.required ? ' · obligatoria' : ''} · {status.recoveryCodesRemaining} códigos de recuperación disponibles</div>
      {recoveryCodes.length > 0 && <div className="mfa-recovery-panel"><strong>Guarda estos códigos en un lugar seguro</strong><p>Cada código sirve una sola vez. Esta lista no volverá a mostrarse.</p><ul>{recoveryCodes.map((code) => <li key={code}><code>{code}</code></li>)}</ul><button type="button" className="button button-secondary" onClick={() => setRecoveryCodes([])}>Ya los guardé</button></div>}
      <form className="mfa-disable-form" onSubmit={rotate}><p>Si perdiste tus códigos, puedes reemplazarlos con tu contraseña y el segundo factor. Los anteriores quedarán revocados.</p><label className="field"><span>Contraseña actual</span><input type="password" autoComplete="current-password" required maxLength={128} value={rotatePassword} onChange={(event) => setRotatePassword(event.target.value)} /></label><label className="field"><span>Código de autenticación o recuperación</span><input type="text" autoComplete="one-time-code" autoCapitalize="characters" required maxLength={32} value={rotateCode} onChange={(event) => setRotateCode(event.target.value)} /></label><button className="button button-secondary" type="submit" disabled={busy}>{busy ? 'Verificando…' : 'Regenerar códigos'}</button></form>
      <form className="mfa-disable-form" onSubmit={disable}><p>Para desactivarla confirma tu contraseña y un código actual o de recuperación.</p><label className="field"><span>Contraseña actual</span><input type="password" autoComplete="current-password" required maxLength={128} value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></label><label className="field"><span>Código de autenticación o recuperación</span><input type="text" autoComplete="one-time-code" autoCapitalize="characters" required maxLength={32} value={disableCode} onChange={(event) => setDisableCode(event.target.value)} /></label><button className="button button-secondary" type="submit" disabled={busy}>{busy ? 'Verificando…' : 'Desactivar verificación'}</button></form>
    </> : <>
      <div className="mfa-settings-state"><span />{status.required ? 'Obligatoria · pendiente de activación' : 'No está activa'}</div>
      {status.required && <p className="mfa-settings-error" role="alert">Activa la verificación en dos pasos para habilitar las funciones de tu cuenta de equipo. Mientras tanto solo podrás configurar MFA o cerrar sesión.</p>}
      {enrollment ? <form className="mfa-enrollment-form" onSubmit={completeEnrollment}>
        <div className="mfa-qr-panel"><QRCodeSVG data-testid="mfa-enrollment-qr" value={enrollment.otpauthUri} size={216} level="M" marginSize={4} role="img" aria-label="Código QR para configurar la verificación en dos pasos" /><div><strong>Escanea este código con tu aplicación autenticadora</strong><p>Agrega una cuenta nueva y escanea el QR. El código de seis dígitos cambia cada 30 segundos.</p><small>Este QR contiene el secreto de tu cuenta. No lo compartas ni envíes una captura.</small></div></div>
        <details className="mfa-manual-key"><summary>¿No puedes escanear el QR? Configúrala manualmente</summary><div className="mfa-enrollment-key"><KeyRound size={16} /><div><strong>Clave para tu aplicación</strong><code>{enrollment.secret}</code><small>En tu aplicación elige introducir una clave de configuración. Usa tipo TOTP, 6 dígitos y periodo de 30 segundos.</small></div></div></details>
        <details className="mfa-otpauth-details"><summary>Ver enlace otpauth</summary><code>{enrollment.otpauthUri}</code></details>
        <label className="field"><span>Código de seis dígitos</span><input type="text" inputMode="numeric" autoComplete="one-time-code" required pattern="[0-9]{6}" maxLength={6} value={verificationCode} onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" /></label>
        <button className="button button-primary" type="submit" disabled={busy || verificationCode.length !== 6}>{busy ? 'Confirmando…' : 'Activar verificación'}</button>
      </form> : <form className="mfa-enrollment-form" onSubmit={startEnrollment}><p>Confirma tu contraseña actual de NEXO para iniciar el enrolamiento. No es la contraseña de GitHub, Cloudflare ni de tu correo.</p><label className="field"><span>Contraseña actual</span><input type="password" autoComplete="current-password" required maxLength={128} value={startPassword} onChange={(event) => setStartPassword(event.target.value)} /></label><button className="button button-primary" type="submit" disabled={busy}>{busy ? 'Preparando…' : 'Configurar verificación en dos pasos'}</button></form>}
    </>}
    {message && <p className="mfa-settings-message" role="status">{message}</p>}
    {error && status && <p className="mfa-settings-error" role="alert">{error}</p>}
  </section>;
}
