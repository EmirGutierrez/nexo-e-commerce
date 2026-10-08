'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { ArrowRight, Heart, PackageCheck, UserRound, X } from 'lucide-react';
import { formatQ } from '../../../data/mockData';
import { useApp } from '../../../contexts/AppContext';
import { customerPortalService, type CustomerOrder } from '../../../services';
import type { Product } from '../../../types';

type Section = 'profile' | 'orders' | 'wishlist';
const navigation: { id: Section; label: string; icon: typeof UserRound }[] = [
  { id: 'profile', label: 'Mi perfil', icon: UserRound },
  { id: 'orders', label: 'Mis compras', icon: PackageCheck },
  { id: 'wishlist', label: 'Mi wishlist', icon: Heart },
];

export default function CustomerAccountPage() {
  const { user, userType, authLoading, updateProfile } = useApp();
  const [section, setSection] = useState<Section>('profile');
  const [name, setName] = useState('');
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [wishlist, setWishlist] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setName(user?.name || '');
    const query = new URLSearchParams(window.location.search).get('section');
    if (query === 'orders' || query === 'wishlist') setSection(query);
  }, [user]);
  useEffect(() => {
    if (!user || userType !== 'customer') return;
    let active = true;
    setLoading(true); setError('');
    Promise.all([customerPortalService.orders(), customerPortalService.wishlist()])
      .then(([nextOrders, nextWishlist]) => { if (active) { setOrders(nextOrders); setWishlist(nextWishlist); } })
      .catch((issue) => { if (active) setError(issue instanceof Error ? issue.message : 'No se pudo cargar tu cuenta.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user, userType]);

  const saveName = async (event: FormEvent) => {
    event.preventDefault(); setError(''); setMessage('');
    try { await updateProfile(name); setMessage('Tu perfil se actualizó correctamente.'); }
    catch (issue) { setError(issue instanceof Error ? issue.message : 'No se pudo guardar tu perfil.'); }
  };
  const removeWishlist = async (id: string) => {
    setError('');
    try { await customerPortalService.removeWishlist(id); setWishlist((current) => current.filter((product) => product.id !== id)); }
    catch (issue) { setError(issue instanceof Error ? issue.message : 'No se pudo actualizar tu wishlist.'); }
  };

  if (authLoading) return <main className="customer-account"><p role="status">Comprobando sesión…</p></main>;
  if (!user || userType !== 'customer') return <main className="customer-account customer-account-locked"><UserRound size={30} /><h1>Inicia sesión para ver tu cuenta</h1><p>Consulta tus pedidos, actualiza tu perfil y guarda tus productos favoritos.</p><Link className="button button-primary" href="/access">Ingresar a mi cuenta <ArrowRight size={16} /></Link></main>;

  return <main className="customer-account">
    <header className="customer-account-heading"><span className="eyebrow">Tu espacio NEXO</span><h1>Hola, <em>{user.name.split(' ')[0]}</em></h1><p>Administra tu perfil y sigue cada compra desde un solo lugar.</p></header>
    <div className="customer-account-layout">
      <nav className="customer-account-nav" aria-label="Secciones de mi cuenta">{navigation.map(({ id, label, icon: Icon }) => <button type="button" key={id} className={section === id ? 'active' : ''} onClick={() => { setSection(id); window.history.replaceState(null, '', id === 'profile' ? '/account' : `/account?section=${id}`); }}><Icon size={17} />{label}<ArrowRight size={14} /></button>)}</nav>
      <section className="customer-account-content">
        {error && <p role="alert" className="commerce-notice">{error}</p>}{message && <p role="status" className="commerce-notice">{message}</p>}
        {section === 'profile' && <div className="customer-panel"><div className="customer-panel-title"><span className="account-icon"><UserRound size={20} /></span><div><span className="eyebrow">Información personal</span><h2>Mi perfil</h2></div></div><form onSubmit={saveName} className="customer-profile-form"><label className="form-field">Nombre completo<input required minLength={2} maxLength={160} value={name} onChange={(event) => setName(event.target.value)} /></label><label className="form-field">Correo electrónico<input value={user.email} readOnly disabled /></label><p>El correo identifica tu cuenta y se usa para relacionar tus compras.</p><button className="button button-primary" type="submit">Guardar cambios</button></form></div>}
        {section === 'orders' && <div className="customer-panel"><div className="customer-panel-title"><span className="account-icon"><PackageCheck size={20} /></span><div><span className="eyebrow">Historial de compras</span><h2>Mis compras</h2></div><strong className="customer-count">{orders.length}</strong></div>{loading ? <p className="customer-empty">Cargando tus pedidos…</p> : orders.length ? <div className="customer-order-list">{orders.map(({ id, data }) => <article className="customer-order-card" key={id}><div className="customer-order-top"><div><span className="eyebrow">{data.date ? new Date(data.date).toLocaleDateString('es-GT') : 'Pedido'}</span><h3>{data.orderNumber || `NX-${id.slice(0, 8).toUpperCase()}`}</h3></div><span className="customer-order-status">{data.status || 'Registrado'}</span></div><div className="customer-order-bottom"><span>{data.items?.reduce((sum, item) => sum + Number(item.quantity || 0), 0) || 0} productos · pago {data.paymentStatus || 'registrado'}</span><strong>{formatQ(Number(data.total || 0))}</strong></div></article>)}</div> : <div className="customer-empty"><PackageCheck size={26} /><h3>Aún no tienes compras</h3><p>Cuando realices un pedido, su estado aparecerá aquí.</p><Link className="text-link" href="/store">Explorar la tienda <ArrowRight size={15} /></Link></div>}</div>}
        {section === 'wishlist' && <div className="customer-panel"><div className="customer-panel-title"><span className="account-icon"><Heart size={20} /></span><div><span className="eyebrow">Tus favoritos</span><h2>Mi wishlist</h2></div><strong className="customer-count">{wishlist.length}</strong></div>{loading ? <p className="customer-empty">Cargando tu wishlist…</p> : wishlist.length ? <div className="customer-wishlist">{wishlist.map((product) => <article key={product.id} className="customer-wishlist-item"><Link href={`/product/${product.id}`} className="customer-wishlist-image">{product.image && <img src={product.image} alt={product.name} />}</Link><div><span className="eyebrow">{product.category}</span><Link href={`/product/${product.id}`}><h3>{product.name}</h3></Link><strong>{formatQ(product.price)}</strong></div><button type="button" className="customer-remove" aria-label={`Quitar ${product.name} de wishlist`} onClick={() => void removeWishlist(product.id)}><X size={17} /></button></article>)}</div> : <div className="customer-empty"><Heart size={26} /><h3>Tu wishlist está vacía</h3><p>Guarda tus productos favoritos para encontrarlos fácilmente.</p><Link className="text-link" href="/store">Ver productos <ArrowRight size={15} /></Link></div>}</div>}
      </section>
    </div>
  </main>;
}
