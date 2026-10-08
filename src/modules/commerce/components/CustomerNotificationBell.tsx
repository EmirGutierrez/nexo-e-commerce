'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Bell, CheckCheck, PackageCheck, X } from 'lucide-react';
import { useApp } from '../../../contexts/AppContext';
import { customerPortalService, type CustomerNotification } from '../../../services';

const dateLabel = (date: string) => {
  const value = new Date(date);
  return Number.isNaN(value.getTime()) ? '' : new Intl.DateTimeFormat('es-GT', { dateStyle: 'short', timeStyle: 'short' }).format(value);
};

export default function CustomerNotificationBell() {
  const { userType, user } = useApp();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<CustomerNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const result = await customerPortalService.notifications();
      setItems(result.items);
      setUnread(result.unreadCount);
      setError('');
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : 'No se pudieron cargar las notificaciones.');
    }
  }, []);

  useEffect(() => {
    if (!user || userType !== 'customer') return;
    void load();
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void load(); }, 30000);
    const onFocus = () => { if (document.visibilityState === 'visible') void load(); };
    window.addEventListener('focus', onFocus);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', onFocus); };
  }, [user, userType, load]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false); };
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => { document.removeEventListener('pointerdown', onPointerDown); document.removeEventListener('keydown', onKeyDown); };
  }, [open]);

  if (!user || userType !== 'customer') return null;

  const markRead = async (notification: CustomerNotification) => {
    if (!notification.read) {
      try {
        await customerPortalService.markNotificationRead(notification.id);
        setItems((current) => current.map((item) => item.id === notification.id ? { ...item, read: true } : item));
        setUnread((count) => Math.max(0, count - 1));
      } catch (issue) { setError(issue instanceof Error ? issue.message : 'No se pudo actualizar la notificación.'); return; }
    }
    setOpen(false);
  };

  const markAllRead = async () => {
    setLoading(true); setError('');
    try {
      await customerPortalService.markAllNotificationsRead();
      setItems((current) => current.map((item) => ({ ...item, read: true })));
      setUnread(0);
    } catch (issue) { setError(issue instanceof Error ? issue.message : 'No se pudieron actualizar las notificaciones.'); }
    finally { setLoading(false); }
  };

  return <div className="customer-notification" ref={rootRef}>
    <button type="button" className="customer-notification-trigger" aria-label={unread ? `Notificaciones, ${unread} sin leer` : 'Notificaciones'} aria-expanded={open} onClick={() => { setOpen((value) => !value); if (!open) void load(); }}>
      <Bell size={19} />{unread > 0 && <span className="customer-notification-count">{unread > 9 ? '9+' : unread}</span>}
    </button>
    {open && <section className="customer-notification-panel" aria-label="Notificaciones">
      <header><div><span className="eyebrow">Tu cuenta</span><h2>Notificaciones{unread > 0 ? ` · ${unread}` : ''}</h2></div><button type="button" className="customer-notification-close" aria-label="Cerrar notificaciones" onClick={() => setOpen(false)}><X size={17} /></button></header>
      {error && <p className="customer-notification-error" role="alert">{error}</p>}
      {items.some((item) => !item.read) && <button type="button" className="customer-notification-read-all" onClick={() => void markAllRead()} disabled={loading}><CheckCheck size={14} />Marcar todo como leído</button>}
      <div className="customer-notification-list" aria-live="polite">
        {loading && items.length === 0 ? <p className="customer-notification-empty">Cargando…</p> : items.length ? items.map((item) => <Link key={item.id} href={item.orderId ? '/account?section=orders' : '/account'} className={`customer-notification-item${item.read ? '' : ' unread'}`} onClick={() => void markRead(item)}>
          <span className={`customer-notification-icon ${item.type.toLowerCase().replaceAll('_', '-')}`}><PackageCheck size={16} /></span>
          <span className="customer-notification-copy"><strong>{item.title}</strong><span>{item.message}</span><time>{dateLabel(item.createdAt)}</time></span>
          {!item.read && <i aria-label="Sin leer" />}
        </Link>) : <p className="customer-notification-empty">Aún no tienes notificaciones. Aquí verás novedades sobre tus pedidos y pagos.</p>}
      </div>
    </section>}
  </div>;
}
