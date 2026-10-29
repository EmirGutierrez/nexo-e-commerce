'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, CheckCircle2, KeyRound, ShieldCheck, X } from 'lucide-react';
import { authService } from '../../../services';

type PasswordRecoveryPageProps = { token: string | null };

export default function PasswordRecoveryPage({ token }: PasswordRecoveryPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [requestSent, setRequestSent] = useState(false);
  const [completed, setCompleted] = useState(false);

  const requestReset = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      await authService.requestPasswordReset(email.trim());
      setRequestSent(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo procesar la solicitud. Inténtalo de nuevo.');
    } finally {
      setBusy(false);
    }
  };

  const completeReset = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    if (password !== confirmation) {
      setError('La nueva contraseña y su confirmación no coinciden.');
      return;
    }
    if (new TextEncoder().encode(password).length > 72) {
      setError('La contraseña no puede superar 72 bytes UTF-8.');
      return;
    }

    setBusy(true);
    try {
      await authService.completePasswordReset(token ?? '', password);
      setPassword('');
      setConfirmation('');
      setCompleted(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo cambiar la contraseña. Solicita un enlace nuevo.');
    } finally {
      setBusy(false);
    }
  };

  const resetting = Boolean(token);
  const title = completed
    ? 'Contraseña actualizada'
    : resetting ? 'Crea una contraseña nueva' : requestSent ? 'Revisa tu correo' : 'Recupera tu contraseña';

  return <div className="admin-login-page password-recovery-page">
    <div className="admin-login-panel">
      <Link href="/" className="brand"><span className="brand-mark"><span /></span><span>NEXO</span></Link>
      <div className="security-pill"><ShieldCheck size={15} /> Acceso protegido</div>
      <div className="admin-login-copy">
        <span className="eyebrow">NEXO · SEGURIDAD DE CUENTA</span>
        <h1>Vuelve a tu cuenta,<br /><em>con seguridad.</em></h1>
        <p>Recupera el acceso con un enlace temporal enviado a tu correo.</p>
      </div>
      <div className="admin-login-footer"><span>© 2025 NEXO COMMERCE</span><span>Enlace de un solo uso</span></div>
    </div>

    <div className="admin-login-form">
      <Link href="/access" className="back-link"><ArrowLeft size={16} /> Volver al inicio de sesión</Link>
      <div className="admin-form-inner">
        <div className="admin-icon"><KeyRound size={21} /></div>
        <h2>{title}</h2>
        {!resetting && !requestSent && !completed && <p>Ingresa el correo de tu cuenta y te enviaremos instrucciones para elegir otra contraseña.</p>}
        {requestSent && !resetting && <p className="reset-success" role="status">Si existe una cuenta con ese correo, recibirás un enlace para restablecer la contraseña. Revisa también la carpeta de correo no deseado.</p>}
        {completed && <p className="reset-success" role="status"><CheckCircle2 size={16} /> Tu contraseña quedó actualizada. Inicia sesión con ella; cerramos las demás sesiones por seguridad.</p>}
        {resetting && !completed && <p>El enlace vence a los 30 minutos y se puede usar una sola vez. La contraseña debe tener al menos 12 caracteres.</p>}

        {!resetting && !requestSent && !completed && <form onSubmit={requestReset}>
          <label className="field"><span>Correo electrónico</span><input type="email" autoComplete="email" autoCapitalize="none" required maxLength={254} value={email} onChange={(event) => { setEmail(event.target.value); setError(''); }} placeholder="tu@correo.com" /></label>
          {error && <div className="error-message" role="alert"><X size={15} />{error}</div>}
          <button className="button button-primary full" type="submit" disabled={busy}>{busy ? 'Enviando…' : <>Enviar enlace <ArrowRight size={16} /></>}</button>
        </form>}

        {resetting && !completed && <form onSubmit={completeReset}>
          <label className="field"><span>Nueva contraseña</span><input type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={password} onChange={(event) => { setPassword(event.target.value); setError(''); }} placeholder="Mínimo 12 caracteres" /></label>
          <label className="field"><span>Confirmar nueva contraseña</span><input type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={confirmation} onChange={(event) => { setConfirmation(event.target.value); setError(''); }} placeholder="Repite la contraseña" /></label>
          <p className="password-reset-hint">Máximo compatible: 72 bytes UTF-8.</p>
          {error && <div className="error-message" role="alert"><X size={15} />{error}</div>}
          <button className="button button-primary full" type="submit" disabled={busy}>{busy ? 'Actualizando…' : <>Actualizar contraseña <ArrowRight size={16} /></>}</button>
        </form>}

        {(requestSent || completed) && <Link className="button button-primary full reset-return" href="/access" onClick={(event) => {
          if (completed) {
            event.preventDefault();
            window.location.assign('/access');
          }
        }}>Ir a iniciar sesión <ArrowRight size={16} /></Link>}
        {error && !resetting && !requestSent && !completed && <Link className="auth-bottom login-switch" href="/access">Volver al acceso</Link>}
      </div>
    </div>
  </div>;
}
