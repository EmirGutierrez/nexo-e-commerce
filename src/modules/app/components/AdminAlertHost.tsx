'use client';

import { useRouter } from 'next/navigation';
import { useApp } from '../../../contexts/AppContext';

export function AdminAlertHost() {
  const { adminAlert, dismissAdminAlert, userType } = useApp();
  const router = useRouter();
  if (!adminAlert || userType !== 'admin') return null;

  return <aside className="admin-alert-host" aria-label="Avisos administrativos">
    <section className={`admin-alert-card ${adminAlert.type}`} role="status" aria-live="polite" aria-atomic="true" aria-labelledby="admin-alert-title" aria-describedby="admin-alert-description">
      <div className={`admin-alert-icon ${adminAlert.type}`} aria-hidden="true">{adminAlert.type === 'warning' ? '!' : adminAlert.type === 'success' ? '✓' : 'i'}</div>
      <div className="admin-alert-content">
        <span className="eyebrow">{adminAlert.type === 'warning' ? 'Advertencia' : adminAlert.type === 'success' ? 'Operación completada' : 'Actualización'}</span>
        <h2 id="admin-alert-title">{adminAlert.title}</h2>
        <p className="admin-alert-entity">{adminAlert.entity}</p>
        <p id="admin-alert-description">{adminAlert.message}</p>
        <p className="admin-alert-next"><strong>Siguiente acción:</strong> {adminAlert.nextAction}</p>
        <div className="admin-alert-actions">
          <button type="button" className="button button-outline" onClick={dismissAdminAlert}>Descartar aviso</button>
          {adminAlert.actionTo && <button type="button" className="button button-primary" onClick={() => { dismissAdminAlert(); router.push(adminAlert.actionTo!); }}>Revisar productos</button>}
        </div>
      </div>
    </section>
  </aside>;
}
