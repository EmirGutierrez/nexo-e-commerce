'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useApp } from '../../../contexts/AppContext';

export default function PublicAccountControls({ onAction }: { onAction?: () => void }) {
  const { user, userType, authLoading, logout } = useApp();
  const router = useRouter();

  if (authLoading) return <span className="header-login" role="status">Comprobando sesión…</span>;

  if (user && userType === 'admin') {
    return <Link href="/admin/dashboard" className="header-login header-account-name" title="Abrir panel" onClick={onAction}>{user.name}</Link>;
  }

  if (user && userType === 'customer') {
    return <>
      <span className="header-login header-account-name" title={user.name}>{user.name}</span>
      <button type="button" className="header-login" onClick={() => {
        onAction?.();
        void logout().then(() => router.push('/access'))
          .catch(() => window.alert('No se pudo cerrar la sesión. Inténtalo de nuevo.'));
      }}>Salir</button>
    </>;
  }

  return <Link href="/access" className="header-login" onClick={onAction}>Ingresar</Link>;
}
