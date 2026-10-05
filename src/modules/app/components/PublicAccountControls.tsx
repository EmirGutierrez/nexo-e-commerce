'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ChevronDown, CircleUserRound, Heart, PackageCheck } from 'lucide-react';
import { useApp } from '../../../contexts/AppContext';

export default function PublicAccountControls({ onAction }: { onAction?: () => void }) {
  const { user, userType, authLoading, logout } = useApp();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  if (authLoading) return <span className="header-login" role="status">Comprobando sesión…</span>;
  if (user && userType === 'admin') return <Link href="/admin/dashboard" className="header-login header-account-name" title="Abrir panel" onClick={onAction}>{user.name}</Link>;
  if (user && userType === 'customer') return <div className="public-account-menu">
    <button type="button" className="header-login header-account-name" title={user.name} aria-expanded={open} onClick={() => setOpen((value) => !value)}>{user.name}<ChevronDown size={14} /></button>
    {open && <div className="public-account-dropdown">
      <Link href="/account" onClick={() => { setOpen(false); onAction?.(); }}><CircleUserRound size={16} />Mi perfil</Link>
      <Link href="/account?section=orders" onClick={() => { setOpen(false); onAction?.(); }}><PackageCheck size={16} />Mis compras</Link>
      <Link href="/account?section=wishlist" onClick={() => { setOpen(false); onAction?.(); }}><Heart size={16} />Mi wishlist</Link>
      <button type="button" onClick={() => { setOpen(false); onAction?.(); void logout().then(() => router.push('/access')).catch(() => window.alert('No se pudo cerrar la sesión. Inténtalo de nuevo.')); }}>Salir</button>
    </div>}
  </div>;
  return <Link href="/access" className="header-login" onClick={onAction}>Ingresar</Link>;
}
