'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useParams, useRouter } from 'next/navigation';
import {
  Activity, ArrowDownToLine, ArrowLeft, ArrowRight, ArrowUpRight, BarChart3, Box, Boxes, Check, CheckCircle2,
  ChevronDown, ChevronLeft, ChevronRight, CircleDollarSign, Clock3, CreditCard, Download, Eye, Filter,
  Grid2X2, Headphones, House, LayoutDashboard, LogIn, LogOut, Menu, Minus, Package, Plus, Search, Settings, ShieldCheck,
  ShoppingBag, ShoppingCart, SlidersHorizontal, Sparkles, Tag, Trash2, Truck, Upload, UserCircle, Users, Wallet, X,
} from 'lucide-react';
import { categories, formatQ, orders, products, suppliers, users } from '../../../data/mockData';
import { useApp } from '../../../contexts/AppContext';
import { fetchCatalogFromApi, productService } from '../../products/services/productService';
import { authService, businessSettingsService, checkoutService, dashboardService, productInventoryService, type BusinessProfileSettings } from '../../../services';
import type { PaymentMethod, Product, Role, User } from '../../../types';
import AccountingPage from '../../accounting/components/AccountingPage';
import PurchasesPage from '../../purchases/components/PurchasesPage';
import SalesPage from '../../sales/components/SalesPage';
import BrandsPage from '../../brands/components/BrandsPage';
import SuppliersPage from '../../suppliers/components/SuppliersPage';
import AdminCrudModule, { type AdminModuleConfig } from '../../products/components/AdminCrudModule';
import RolesPermissionsPage from '../../roles/components/RolesPermissionsPage';
import { roleService } from '../../../services/roleService';
import { roleLabels } from '../../../types';
import { OffersAdminPage, TransferReceiptsPage } from '../../commerce/components/CommerceAdminPages';
import { SeasonalSpotlight } from '../../commerce/components/CommercePages';

const Icon = ({ name, size = 18 }: { name: string; size?: number }) => {
  const icons: Record<string, typeof Box> = { arrow: ArrowUpRight, box: Box, user: UserCircle, check: CheckCircle2 };
  const Component = icons[name] || Box;
  return <Component size={size} />;
};

function Brand({ light = false }: { light?: boolean }) {
  return <Link href="/" className={`brand ${light ? 'brand-light' : ''}`}><span className="brand-mark"><span /></span><span>NEXO</span></Link>;
}

function PublicHeader() {
  const { cartCount, userType, logout } = useApp();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    if (!menuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [menuOpen]);
  const closeMenu = () => setMenuOpen(false);
  const signOut = () => {
    closeMenu();
    void logout().then(() => router.push('/access')).catch(() => window.alert('No se pudo cerrar la sesión. Inténtalo de nuevo.'));
  };
  const accountAction = (className: string) => userType === 'customer'
    ? <button type="button" className={className} onClick={signOut}>Salir</button>
    : userType === 'admin'
      ? <Link href="/admin/dashboard" className={className} onClick={closeMenu}>Panel</Link>
      : <Link href="/access" className={className} onClick={closeMenu}>Ingresar</Link>;

  return <header className="public-header">
    <Brand />
    <nav id="public-navigation" className={`public-nav${menuOpen ? ' is-open' : ''}`} aria-label="Navegación principal">
      <Link href="/store" onClick={closeMenu}>Tienda</Link>
      <Link href="/#benefits" onClick={closeMenu}>Beneficios</Link>
      <Link href="/#about" onClick={closeMenu}>Nosotros</Link>
      <div className="public-nav-account">{accountAction('public-nav-account-action')}</div>
    </nav>
    <div className="header-actions">
      {accountAction('header-login')}
      <button type="button" className="public-menu-toggle" aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'} aria-expanded={menuOpen} aria-controls="public-navigation" onClick={() => setMenuOpen((open) => !open)}>
        {menuOpen ? <X size={20} /> : <Menu size={20} />}
      </button>
      <Link href="/cart" className="cart-button"><ShoppingCart size={18} /><span className="cart-label">Carrito</span>{cartCount > 0 && <b>{cartCount}</b>}</Link>
    </div>
  </header>;
}

export function Landing() {
  return <div className="landing">
    <PublicHeader />
    <main className="landing-main">
      <section className="landing-copy">
        <div className="eyebrow"><Sparkles size={15} /> Catálogo y pedidos en un solo lugar</div>
        <h1>Compra mejor.<br /><em>Vive en NEXO.</em></h1>
        <p>Explora productos, consulta su disponibilidad y revisa el total en quetzales antes de confirmar tu pedido.</p>
        <div className="landing-actions">
          <Link href="/store" className="button button-primary">Explorar tienda <ArrowRight size={17} /></Link>
          <Link href="/access" className="text-link">Conoce nuestra plataforma <ArrowRight size={16} /></Link>
        </div>
        <div className="trust-row"><span>Precios en quetzales</span><span className="dot-divider" /><span className="rating">Existencias validadas al confirmar</span></div>
      </section>
      <section className="landing-art" aria-label="Compra en NEXO">
        <div className="art-glow" />
        <div className="hero-image">
          <img loading="eager" decoding="async" onError={(event) => { event.currentTarget.hidden = true; event.currentTarget.parentElement?.classList.add('image-fallback'); }} src="https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=1100&q=85" alt="Persona explorando una tienda en línea" />
          <div className="floating-card floating-order"><div className="mini-icon green"><Check size={16} /></div><div><strong>Pedido informado</strong><small>Precios y existencias revisados</small></div></div>
          <div className="floating-card floating-price"><small>Compra con claridad</small><strong>Montos en Q</strong><span>Total visible antes de confirmar</span></div>
        </div>
        <div className="shape shape-a" /><div className="shape shape-b" />
      </section>
    </main>
    <SeasonalSpotlight />
    <section id="benefits" className="benefits-section">
      <div className="section-heading"><div><span className="eyebrow">La experiencia NEXO</span><h2>Comprar también puede<br /><em>sentirse bien.</em></h2></div><p>Consulta el catálogo y conoce el total antes de completar un pedido. La disponibilidad se vuelve a comprobar durante el checkout.</p></div>
      <div className="benefits-grid">
        <div><span className="benefit-number">01</span><ShoppingBag size={22} /><strong>Catálogo conectado</strong><p>Productos activos y sus precios llegan desde el sistema de comercio.</p></div>
        <div><span className="benefit-number">02</span><ShieldCheck size={22} /><strong>Existencias validadas</strong><p>El sistema vuelve a revisar la disponibilidad al registrar tu pedido.</p></div>
        <div><span className="benefit-number">03</span><CreditCard size={22} /><strong>Pago transparente</strong><p>La tarjeta funciona en modo de demostración; el equipo revisa las transferencias.</p></div>
      </div>
    </section>
    <section id="about" className="about-section">
      <div className="about-photo"><img loading="lazy" decoding="async" onError={(event) => { event.currentTarget.hidden = true; event.currentTarget.parentElement?.classList.add('image-fallback'); }} src="https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=1100&q=85" alt="Equipo de comercio trabajando" /></div>
      <div className="about-copy"><span className="eyebrow">Nosotros · NEXO COMMERCE</span><h2>Conectamos buenas ideas con <em>personas reales.</em></h2><p>NEXO reúne una tienda en línea y herramientas para operar un negocio minorista. El catálogo, los pedidos y las promociones se gestionan desde el sistema comercial.</p><div className="about-points"><span><strong>Catálogo</strong> conectado al sistema</span><span><strong>Checkout</strong> con stock validado</span><span><strong>Pago</strong> en modo demostración</span></div><Link href="/access" className="button button-outline">Conoce la plataforma <ArrowRight size={16} /></Link></div>
    </section>
    <section className="landing-stats" aria-label="Información de la compra">
      <div><strong>Precios en Q</strong><span>Montos visibles en quetzales</span></div>
      <div><strong>Checkout claro</strong><span>Revisa tu selección antes de confirmar</span></div>
      <div><strong>Datos conectados</strong><span>Pedidos y promociones en el sistema</span></div>
    </section>
  </div>;
}

function HeartIcon() { return <Sparkles size={22} />; }

export function Access() { return <LoginPage />; }
export function CustomerLogin() { return <LoginPage initialKind="customer" />; }
export function AdminLogin() { return <LoginPage initialKind="admin" />; }

function AuthPending() {
  return <main className="auth-pending" role="status" aria-live="polite"><strong>NEXO</strong><p>Comprobando acceso…</p></main>;
}

function LoginPage({ initialKind }: { initialKind?: 'admin' | 'customer' }) {
  const { login, user, userType, role, authLoading } = useApp();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const requested = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('redirect');
  const alreadyAtDestination = Boolean(user && userType);
  useEffect(() => {
    if (!authLoading && alreadyAtDestination && userType) router.replace(resolveLoginDestination(userType, role, requested, user?.permissions));
  }, [authLoading, alreadyAtDestination, userType, role, user?.permissions, requested, router]);
  if (authLoading || alreadyAtDestination) return <AuthPending />;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setError('');
    setSubmitting(true);
    try {
      const session = await login(email, password);
      if (!session) {
        setError('Correo o contraseña incorrectos.');
        return;
      }
      router.push(resolveLoginDestination(session.kind, session.user.role, requested, session.user.permissions));
    } catch {
      setError('No fue posible conectar con el servicio de acceso. Inténtalo de nuevo.');
    } finally {
      setSubmitting(false);
    }
  };

  const adminMode = initialKind === 'admin';
  return <div className="admin-login-page"><div className="admin-login-panel"><Brand /><div className="security-pill"><ShieldCheck size={15} /> Acceso protegido</div><div className="admin-login-copy"><span className="eyebrow">NEXO · {adminMode ? 'Administración' : 'Tienda'}</span><h1>{adminMode ? <>Haz que tu negocio<br /><em>avance.</em></> : <>Todo lo que buscas,<br /><em>en un solo lugar.</em></>}</h1><p>Ingresa con tu cuenta para continuar.</p></div><div className="admin-login-footer"><span>© 2025 NEXO COMMERCE</span><span>Acceso seguro</span></div></div><div className="admin-login-form"><Link href="/" className="back-link"><ArrowLeft size={16} /> Volver al inicio</Link><div className="admin-form-inner"><div className="admin-icon"><LockIcon /></div><h2>Iniciar sesión</h2><p>Usa tus credenciales para acceder a tu espacio.</p><form onSubmit={submit}>
    <Field label="Correo electrónico" type="email" value={email} onChange={setEmail} placeholder={adminMode ? 'personal@nexo.gt' : 'tu@correo.com'} /><Field label="Contraseña" type="password" value={password} onChange={setPassword} placeholder="Ingresa tu contraseña" />
    {error && <div className="error-message" role="alert"><X size={15} />{error}</div>}<button className={`button ${adminMode ? 'button-dark' : 'button-primary'} full`} type="submit" disabled={submitting}>{submitting ? 'Ingresando…' : <>Ingresar <ArrowRight size={16} /></>}</button></form>
    <p className="auth-bottom">Tu cuenta y sus permisos determinan a dónde ingresas.</p>
    <Link className="auth-bottom login-switch" href="/register">Crear cuenta de cliente</Link>
  </div></div></div>;
}

export function RegisterPage() {
  const { registerCustomer, user, userType, role, authLoading } = useApp();
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && user && userType) router.replace(resolveLoginDestination(userType, role, null, user.permissions));
  }, [authLoading, user, userType, role, router]);
  if (authLoading || (user && userType)) return <AuthPending />;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (password !== confirmation) { setError('Las contraseñas no coinciden.'); return; }
    setSubmitting(true);
    try {
      await registerCustomer(name, email, password);
      router.replace('/store');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No fue posible crear la cuenta.');
    } finally {
      setSubmitting(false);
    }
  };

  return <div className="admin-login-page"><div className="admin-login-panel"><Brand /><div className="security-pill"><ShieldCheck size={15} /> Acceso protegido</div><div className="admin-login-copy"><span className="eyebrow">NEXO · TIENDA</span><h1>Comienza aquí,<br /><em>a tu manera.</em></h1><p>Crea tu cuenta para comprar en NEXO.</p></div><div className="admin-login-footer"><span>© 2025 NEXO COMMERCE</span><span>Cuenta de cliente</span></div></div><div className="admin-login-form"><Link href="/access" className="back-link"><ArrowLeft size={16} /> Volver al inicio de sesión</Link><div className="admin-form-inner"><div className="admin-icon"><LockIcon /></div><h2>Crear cuenta</h2><p>Usa un correo propio y una contraseña de al menos 12 caracteres.</p><form onSubmit={submit}>
    <Field label="Nombre" type="text" value={name} onChange={setName} placeholder="Tu nombre" />
    <Field label="Correo electrónico" type="email" value={email} onChange={setEmail} placeholder="tu@correo.com" />
    <Field label="Contraseña" type="password" value={password} onChange={setPassword} placeholder="Mínimo 12 caracteres" />
    <Field label="Confirmar contraseña" type="password" value={confirmation} onChange={setConfirmation} placeholder="Repite tu contraseña" />
    {error && <div className="error-message" role="alert"><X size={15} />{error}</div>}
    <button className="button button-primary full" type="submit" disabled={submitting}>{submitting ? 'Creando cuenta…' : <>Crear cuenta <ArrowRight size={16} /></>}</button>
  </form><Link className="auth-bottom login-switch" href="/access">Ya tengo una cuenta</Link></div></div></div>;
}

export function InvitationAcceptancePage() {
  const router = useRouter();
  const [token, setToken] = useState(''); const [password, setPassword] = useState(''); const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState(''); const [done, setDone] = useState(false); const [busy, setBusy] = useState(false);
  useEffect(() => { setToken(new URLSearchParams(window.location.search).get('token') || ''); }, []);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setError('');
    if (!token) { setError('El enlace no contiene una invitación válida.'); return; }
    if (password !== confirmation) { setError('Las contraseñas no coinciden.'); return; }
    setBusy(true);
    try { await authService.acceptInvitation(token, password); setDone(true); window.setTimeout(() => router.replace('/access'), 1800); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo aceptar la invitación. Solicita un nuevo enlace.'); }
    finally { setBusy(false); }
  };
  return <div className="admin-login-page"><div className="admin-login-panel"><Brand /><div className="security-pill"><ShieldCheck size={15} /> Acceso protegido</div><div className="admin-login-copy"><span className="eyebrow">NEXO · EQUIPO</span><h1>Tu espacio de trabajo<br /><em>te espera.</em></h1><p>Establece una contraseña para activar tu cuenta.</p></div><div className="admin-login-footer"><span>© 2026 NEXO COMMERCE</span><span>Invitación de un solo uso</span></div></div><div className="admin-login-form"><Link href="/access" className="back-link"><ArrowLeft size={16} /> Volver al inicio</Link><div className="admin-form-inner"><div className="admin-icon"><LockIcon /></div><h2>{done ? 'Cuenta activada' : 'Aceptar invitación'}</h2><p>{done ? 'Ya puedes ingresar con tu correo y contraseña.' : 'Crea una contraseña propia de al menos 12 caracteres.'}</p>{!done && <form onSubmit={submit}><Field label="Contraseña" type="password" value={password} onChange={setPassword} placeholder="Mínimo 12 caracteres" /><Field label="Confirmar contraseña" type="password" value={confirmation} onChange={setConfirmation} placeholder="Repite tu contraseña" />{error && <div className="error-message" role="alert"><X size={15} />{error}</div>}<button className="button button-primary full" type="submit" disabled={busy || !token}>{busy ? 'Activando cuenta…' : 'Activar cuenta'}</button></form>}{!token && <div className="error-message" role="alert">El enlace está incompleto o venció. Pide al administrador una nueva invitación.</div>}</div></div></div>;
}

export function ProfilePage() {
  const { user, updateProfile } = useApp();
  const [name, setName] = useState(user?.name || ''); const [busy, setBusy] = useState(false); const [message, setMessage] = useState(''); const [error, setError] = useState('');
  useEffect(() => { setName(user?.name || ''); }, [user?.name]);
  const save = async (event: React.FormEvent) => { event.preventDefault(); setBusy(true); setError(''); setMessage(''); try { await updateProfile(name); setMessage('Tu nombre se guardó en PostgreSQL.'); } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo guardar tu perfil.'); } finally { setBusy(false); } };
  return <div className="module-page"><div className="admin-page-heading"><div><span className="eyebrow">Mi cuenta · Perfil de usuario</span><h1>Mi perfil</h1><p>Actualiza tu nombre visible y consulta tu acceso.</p></div></div><section className="panel profile-panel"><form className="crud-form" onSubmit={save}><div className="crud-fields"><label className="field"><span>Nombre</span><input required minLength={2} maxLength={160} value={name} onChange={(event) => setName(event.target.value)} /></label><label className="field"><span>Correo electrónico</span><input value={user?.email || ''} readOnly disabled /></label><label className="field"><span>Rol</span><input value={user ? roleLabels[user.role] : ''} readOnly disabled /></label></div>{message && <div className="crud-feedback" role="status">{message}</div>}{error && <div className="crud-error" role="alert">{error}</div>}<p className="crud-form-note">El correo y los permisos solo se cambian desde los procesos administrativos correspondientes.</p><div className="modal-actions"><button className="button button-primary" type="submit" disabled={busy || name.trim() === user?.name}>{busy ? 'Guardando…' : 'Guardar perfil'}</button></div></form></section></div>;
}

function LockIcon() { return <ShieldCheck size={25} />; }
function Field({ label, type, value, onChange, placeholder }: { label: string; type: string; value: string; onChange: (value: string) => void; placeholder: string }) { return <label className="field"><span>{label}</span><input required type={type} defaultValue={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} /></label>; }

const adminRoleHome: Record<Role, string> = {
  superadmin: '/admin/dashboard', admin: '/admin/dashboard', sales: '/admin/sales', warehouse: '/admin/inventory', employee: '/admin/dashboard', customer: '/store',
};
const adminRoleRoutes: Record<Role, string[]> = {
  superadmin: ['/admin'], admin: ['/admin'],
  sales: ['/admin/dashboard', '/admin/sales', '/admin/customers', '/admin/transfers', '/admin/payments', '/admin/invoices', '/admin/reports'],
  warehouse: ['/admin/dashboard', '/admin/inventory', '/admin/purchases', '/admin/suppliers'],
  employee: ['/admin/profile'],
  customer: [],
};

function hasUserPermission(role: Role, user: User | null | undefined, module: 'dashboard'|'products'|'inventory'|'orders'|'sales'|'customers'|'suppliers'|'reports'|'settings'|'users', action: 'view'|'create'|'edit'|'delete'|'approve' = 'view') {
  if (role === 'customer') return false;
  if (role === 'superadmin') return true;
  if (user?.permissions !== undefined) return user.permissions.includes(`${module}:${action}`);
  return roleService.can(role, module, action);
}

function canVisitAdminPath(role: Role, pathname: string, permissions?: string[]) {
  if (pathname.includes('\\') || /%2f|%5c/i.test(pathname) || pathname.split('/').some((segment) => segment === '.' || segment === '..')) return false;
  if (pathname.split('/').filter(Boolean)[1] === 'offers') return permissions !== undefined ? permissions.includes('promotions:view') : roleService.can(role, 'promotions', 'view');
  if (pathname === '/admin/profile') return role !== 'customer';
  const moduleMap: Record<string, 'dashboard'|'products'|'inventory'|'orders'|'sales'|'customers'|'suppliers'|'reports'|'accounting'|'settings'|'users'> = { dashboard: 'dashboard', products: 'products', categories: 'products', inventory: 'inventory', purchases: 'inventory', orders: 'orders', sales: 'sales', customers: 'customers', suppliers: 'suppliers', reports: 'reports', settings: 'settings', users: 'users', 'roles-permissions': 'users', transfers: 'orders', payments: 'orders', invoices: 'sales', accounting: 'accounting', profile: 'settings', brands: 'products' };
  const requestedModule = moduleMap[pathname.split('/').filter(Boolean)[1] || 'dashboard'];
  if (role === 'customer') return false;
  if (role === 'superadmin' && permissions === undefined) return true;
  return Boolean(requestedModule && (permissions !== undefined ? permissions.includes(`${requestedModule}:view`) : roleService.can(role, requestedModule, 'view')));
}

function resolveLoginDestination(kind: 'admin' | 'customer', role: Role | null, requested: unknown, permissions?: string[]) {
  if (kind === 'customer') return '/store';
  const safeRole = role || 'employee';
  const requestedPath = typeof requested === 'string' ? requested : requested && typeof requested === 'object' && 'pathname' in requested ? (requested as { pathname?: unknown }).pathname : undefined;
  if (typeof requestedPath === 'string' && requestedPath.startsWith('/admin/') && canVisitAdminPath(safeRole, requestedPath, permissions)) {
    const search = requested && typeof requested === 'object' && 'search' in requested && typeof requested.search === 'string' && requested.search.startsWith('?') ? requested.search : '';
    const hash = requested && typeof requested === 'object' && 'hash' in requested && typeof requested.hash === 'string' && requested.hash.startsWith('#') ? requested.hash : '';
    return `${requestedPath}${search}${hash}`;
  }
  const preferred = adminRoleHome[safeRole];
  if (canVisitAdminPath(safeRole, preferred, permissions)) return preferred;
  const firstAllowed = ['/admin/dashboard', '/admin/products', '/admin/inventory', '/admin/sales', '/admin/customers', '/admin/suppliers', '/admin/purchases', '/admin/reports', '/admin/settings', '/admin/users']
    .find((path) => canVisitAdminPath(safeRole, path, permissions));
  return firstAllowed || '/admin/profile';
}

function PublicShell({ children }: { children: React.ReactNode }) { return <div className="public-app"><PublicHeader />{children}</div>; }

export function Store() {
  const [search, setSearch] = useState(''); const [category, setCategory] = useState('Todos'); const [sort, setSort] = useState('featured'); const [page, setPage] = useState(1); const [catalog, setCatalog] = useState<Product[]>([]); const [loading, setLoading] = useState(true); const [catalogError, setCatalogError] = useState('');
  useEffect(() => { let active = true; fetchCatalogFromApi().then((result) => { if (active) setCatalog(result.products); }).catch((cause) => { if (active) setCatalogError(cause instanceof Error ? cause.message : 'No se pudo conectar con el catálogo.'); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, []);
  const availableCategories = ['Todos', ...Array.from(new Set(catalog.map((product) => product.category)))];
  const filtered = useMemo(() => catalog.filter((product) => (category === 'Todos' || product.category === category) && product.name.toLowerCase().includes(search.toLowerCase())).sort((a, b) => sort === 'price-low' ? a.price - b.price : sort === 'price-high' ? b.price - a.price : Number(b.featured) - Number(a.featured)), [catalog, category, search, sort]);
  useEffect(() => { setPage(1); }, [search, category, sort]);
  const pageSize = 24; const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize)); const visibleProducts = filtered.slice((page - 1) * pageSize, page * pageSize);
  return <PublicShell><main className="store-page"><section className="store-hero"><div><span className="eyebrow">Catálogo de NEXO</span><h1>Encuentra algo<br /><em>que te inspire.</em></h1><p>Productos útiles, bonitos y elegidos para acompañarte todos los días.</p></div><div className="store-hero-badge"><Sparkles size={17} /><span>Catálogo de PostgreSQL</span><strong>{catalog.length} productos</strong></div></section><section className="store-toolbar"><div className="search-box"><Search size={18} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar productos..." />{search && <button onClick={() => setSearch('')}><X size={16} /></button>}</div><div className="category-pills">{availableCategories.map((item) => <button key={item} className={category === item ? 'active' : ''} onClick={() => setCategory(item)}>{item}</button>)}</div><label className="sort-select"><SlidersHorizontal size={16} /><select value={sort} onChange={(e) => setSort(e.target.value)}><option value="featured">Destacados</option><option value="price-low">Precio menor</option><option value="price-high">Precio mayor</option></select><ChevronDown size={15} /></label></section><div className="catalog-meta"><span>{loading ? 'Cargando catálogo...' : `${filtered.length} productos · página ${page} de ${totalPages}`}</span><span className="catalog-tip"><Sparkles size={14} /> Los cambios del panel se reflejan aquí</span></div>{catalogError ? <div className="empty-state" role="alert"><h3>No se pudo cargar el catálogo</h3><p>{catalogError}</p><button className="button button-outline" onClick={() => window.location.reload()}>Reintentar</button></div> : visibleProducts.length > 0 ? <><div className="product-grid">{visibleProducts.map((product) => <ProductCard key={product.id} product={product} />)}</div><div className="catalog-pagination"><button disabled={page === 1} onClick={() => setPage((current) => current - 1)}><ChevronLeft size={16} /> Anterior</button><span>Página <strong>{page}</strong> de {totalPages}</span><button disabled={page === totalPages} onClick={() => setPage((current) => current + 1)}>Siguiente <ChevronRight size={16} /></button></div></> : !loading ? <EmptyState search={search} /> : null}</main></PublicShell>;
}

function EmptyState({ search }: { search: string }) { return <div className="empty-state"><Search size={30} /><h3>No encontramos resultados</h3><p>Prueba con otra búsqueda{search ? ` diferente a “${search}”` : ''}.</p></div>; }

function ProductCard({ product }: { product: Product }) { const { addToCart } = useApp(); const [added, setAdded] = useState(false); const click = () => { if (!product.stock) return; addToCart(product); setAdded(true); setTimeout(() => setAdded(false), 1400); }; return <article className="product-card"><Link href={`/product/${product.id}`} className="product-image-wrap"><img src={product.image} alt={product.name} />{product.compareAt && <span className="sale-tag">Oferta</span>}{product.status === 'Bajo stock' && <span className="stock-tag">Últimas unidades</span>}<span className="quick-view">Ver producto <ArrowUpRight size={14} /></span></Link><div className="product-info"><span className="product-category">{product.category}</span><Link href={`/product/${product.id}`}><h3>{product.name}</h3></Link><div className="product-bottom"><div><strong>{formatQ(product.price)}</strong>{product.compareAt && <del>{formatQ(product.compareAt)}</del>}</div><button className={added ? 'add-button added' : 'add-button'} disabled={!product.stock} onClick={click}>{added ? <Check size={17} /> : <Plus size={18} />}</button></div></div></article>; }

export function ProductDetailApi() {
  const { id } = useParams<{ id: string }>();
  const { addToCart } = useApp(); const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null); const [related, setRelated] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [quantity, setQuantity] = useState(1); const [added, setAdded] = useState(false);
  useEffect(() => { let active = true; Promise.all([productService.getById(id), fetchCatalogFromApi()]).then(([item, catalog]) => {
    if (!active) return; setProduct(item); setRelated(catalog.products.filter((candidate) => candidate.id !== id).slice(0, 4));
  }).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'No se pudo cargar el producto.'); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [id]);
  if (loading) return <PublicShell><main className="detail-page"><p role="status">Cargando producto…</p></main></PublicShell>;
  if (error || !product) return <PublicShell><main className="detail-page"><Link href="/store" className="back-link"><ArrowLeft size={16} /> Volver al catálogo</Link><div className="empty-state" role="alert"><h2>Producto no disponible</h2><p>{error || 'Este producto fue retirado o no existe.'}</p></div></main></PublicShell>;
  const add = () => { for (let i = 0; i < quantity; i += 1) addToCart(product); setAdded(true); };
  return <PublicShell><main className="detail-page"><Link href="/store" className="back-link"><ArrowLeft size={16} /> Volver al catálogo</Link><div className="detail-layout"><div className="detail-image"><img src={product.image} alt={product.name} />{product.compareAt && <span className="sale-tag">Oferta especial</span>}</div><div className="detail-copy"><span className="eyebrow">{product.category} · {product.sku}</span><h1>{product.name}</h1><div className="detail-price"><strong>{formatQ(product.price)}</strong>{product.compareAt && <del>{formatQ(product.compareAt)}</del>}<span>{product.compareAt ? `Ahorra ${formatQ(product.compareAt - product.price)}` : 'Precio especial'}</span></div><p>{product.description}</p><div className="detail-stock"><span className={product.stock < 10 ? 'orange-dot' : 'green-dot'} />{product.stock ? `${product.stock} unidades disponibles` : 'Producto agotado'}</div><div className="detail-buy"><div className="quantity"><button onClick={() => setQuantity(Math.max(1, quantity - 1))}><Minus size={15} /></button><span>{quantity}</span><button onClick={() => setQuantity(Math.min(product.stock || 1, quantity + 1))}><Plus size={15} /></button></div><button className="button button-primary" disabled={!product.stock} onClick={add}>{added ? <><Check size={17} /> Agregado al carrito</> : <><ShoppingCart size={17} /> Agregar al carrito</>}</button></div>{added && <button className="text-link detail-go-cart" onClick={() => router.push('/cart')}>Ir al carrito <ArrowRight size={16} /></button>}<div className="detail-benefits"><div><Truck size={17} /><span>Envío nacional<br /><small>2–4 días hábiles</small></span></div><div><ShieldCheck size={17} /><span>Compra segura<br /><small>Datos protegidos</small></span></div><div><RefreshIcon /><span>Devolución fácil<br /><small>30 días</small></span></div></div></div></div><section className="related"><div className="section-heading"><div><span className="eyebrow">También te puede gustar</span><h2>Más para descubrir</h2></div><Link href="/store" className="text-link">Ver catálogo completo <ArrowRight size={16} /></Link></div><div className="product-grid related-grid">{related.map((item) => <ProductCard key={item.id} product={item} />)}</div></section></main></PublicShell>;
}
function RefreshIcon() { return <Activity size={17} />; }

export function CartPage() { const { cart, cartTotal, updateQuantity, removeFromCart } = useApp(); const router = useRouter(); return <PublicShell><main className="cart-page"><div className="page-title-row"><div><span className="eyebrow">Tu selección</span><h1>Mi carrito <span>({cart.length})</span></h1></div><Link href="/store" className="text-link"><ArrowLeft size={16} /> Seguir comprando</Link></div>{cart.length === 0 ? <div className="empty-state cart-empty"><ShoppingCart size={34} /><h3>Tu carrito está esperando</h3><p>Agrega productos que te gusten y aparecerán aquí.</p><Link href="/store" className="button button-primary">Explorar productos <ArrowRight size={16} /></Link></div> : <div className="cart-layout"><div className="cart-items">{cart.map((item) => <div className="cart-item" key={item.id}><img src={item.image} alt={item.name} /><div className="cart-item-info"><span>{item.category}</span><h3>{item.name}</h3><strong>{formatQ(item.price)}</strong></div><div className="quantity"><button onClick={() => updateQuantity(item.id, item.quantity - 1)}><Minus size={14} /></button><span>{item.quantity}</span><button onClick={() => updateQuantity(item.id, item.quantity + 1)}><Plus size={14} /></button></div><button className="icon-button danger" onClick={() => removeFromCart(item.id)} aria-label="Eliminar"><Trash2 size={17} /></button></div>)}</div><aside className="summary-card"><h2>Resumen del pedido</h2><div><span>Subtotal</span><strong>{formatQ(cartTotal)}</strong></div><div><span>Envío</span><strong className="free">Gratis</strong></div><div className="summary-total"><span>Total</span><strong>{formatQ(cartTotal)}</strong></div><button className="button button-primary full" onClick={() => router.push('/checkout')}>Continuar al checkout <ArrowRight size={16} /></button><small><ShieldCheck size={14} /> Compra segura y protegida</small></aside></div>}</main></PublicShell>; }

export function Checkout() {
  const { cart, cartTotal, paymentMethods, clearCart } = useApp();
  const router = useRouter();
  const availableMethods = (['card', 'transfer'] as const).filter((method) => paymentMethods[method]);
  const [payment, setPayment] = useState<PaymentMethod>('card');
  const [done, setDone] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [address, setAddress] = useState('');

  useEffect(() => {
    if (!paymentMethods[payment]) setPayment(availableMethods[0] || 'card');
  }, [paymentMethods, payment, availableMethods]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setPaymentError('');
    if (!paymentMethods[payment]) {
      setPaymentError('Este método ya no está disponible. Elige una de las opciones activas.');
      return;
    }
    try {
      const result = await checkoutService.create({ customerName, customerEmail, customerPhone, address, paymentMethod: payment,
        items: cart.map((item) => ({ productId: item.id, quantity: item.quantity })) });
      setDone(true);
      window.sessionStorage.setItem('nexo-confirmation-result', JSON.stringify({ paymentMethod: payment,
        paymentStatus: payment === 'transfer' ? 'pending_verification' : 'approved', total: result.total, reference: result.reference }));
      clearCart();
      window.setTimeout(() => router.push('/confirmation'), 700);
    } catch (cause) {
      setPaymentError(cause instanceof Error ? cause.message : 'No se pudo crear el pedido. Revisa tus datos e inténtalo de nuevo.');
    }
  };

  useEffect(() => { if (!cart.length) router.replace('/cart'); }, [cart.length, router]);
  if (!cart.length) return null;
  if (done) return <div className="processing"><div className="loader" /><h2>Procesando tu pedido...</h2><p>Simulación de pago en curso; no se realizará ningún cobro.</p></div>;
  return <PublicShell><main className="checkout-page"><Link href="/cart" className="back-link"><ArrowLeft size={16} /> Volver al carrito</Link><div className="checkout-heading"><div><span className="eyebrow">Último paso</span><h1>Finaliza tu pedido</h1></div><div className="checkout-steps"><span className="done"><Check size={13} /> Carrito</span><i /><span className="current">2. Checkout</span><i /><span>3. Confirmación</span></div></div>
    <form className="checkout-layout" onSubmit={submit}><div className="checkout-form"><section className="form-section"><div className="section-title"><span>01</span><div><h2>Información de entrega</h2><p>¿Dónde enviamos tu pedido?</p></div></div><div className="form-grid"><Field label="Nombre completo" type="text" value={customerName} onChange={setCustomerName} placeholder="Tu nombre" /><Field label="Teléfono" type="tel" value={customerPhone} onChange={setCustomerPhone} placeholder="5555 5555" /></div><Field label="Correo electrónico" type="email" value={customerEmail} onChange={setCustomerEmail} placeholder="tu@correo.com" /><Field label="Dirección de entrega" type="text" value={address} onChange={setAddress} placeholder="Calle, avenida, zona y ciudad" /></section>
    <section className="form-section"><div className="section-title"><span>02</span><div><h2>Método de pago</h2><p>Opciones disponibles · solo demostración</p></div></div><div className="payment-options">{paymentMethods.card && <button type="button" className={payment === 'card' ? 'payment-option active' : 'payment-option'} onClick={() => { if (paymentMethods.card) { setPayment('card'); setPaymentError(''); } }}><CreditCard size={19} /><span><strong>Tarjeta simulada</strong><small>No se solicitan datos de tarjeta</small></span><span className="radio" /></button>}{paymentMethods.transfer && <button type="button" className={payment === 'transfer' ? 'payment-option active' : 'payment-option'} onClick={() => { if (paymentMethods.transfer) { setPayment('transfer'); setPaymentError(''); } }}><ArrowDownToLine size={19} /><span><strong>Transferencia bancaria</strong><small>Pendiente de verificación</small></span><span className="radio" /></button>}</div>
    {!availableMethods.length ? <div className="payment-error" role="alert">No hay métodos de pago activos. Contacta al administrador antes de continuar.</div> : payment === 'card' ? <div className="transfer-hint"><CreditCard size={18} /><p>Pago de tarjeta simulado para esta demostración. <strong>No se realiza ningún cargo y no guardamos información financiera.</strong></p></div> : <div className="transfer-hint"><Wallet size={18} /><p>El pedido quedará <strong>pendiente de verificación</strong>. Esta demostración no procesa transferencias reales.</p></div>}
    {paymentError && <div className="payment-error" role="alert">{paymentError}</div>}</section></div><aside className="summary-card checkout-summary"><h2>Tu pedido</h2>{cart.map((item) => <div className="mini-line" key={item.id}><span>{item.quantity} × {item.name}</span><strong>{formatQ(item.price * item.quantity)}</strong></div>)}<div className="summary-total"><span>Total a pagar</span><strong>{formatQ(cartTotal)}</strong></div><button className="button button-primary full" type="submit" disabled={!availableMethods.length}>Confirmar pedido <ArrowRight size={16} /></button><small><ShieldCheck size={14} /> Simulación únicamente. No se realizan cargos reales.</small></aside></form></main></PublicShell>;
}

export function Confirmation() {
  const [result, setResult] = useState<{ paymentMethod?: PaymentMethod; paymentStatus?: string; total?: number; reference?: string } | null>(null);
  useEffect(() => {
    const saved = window.sessionStorage.getItem('nexo-confirmation-result');
    if (saved) { setResult(JSON.parse(saved)); window.sessionStorage.removeItem('nexo-confirmation-result'); }
    }, []);
  const transferPending = result?.paymentMethod === 'transfer' && result.paymentStatus === 'pending_verification';
  const statusLabel = transferPending ? 'Pendiente de verificación' : result?.paymentStatus === 'approved' ? 'Pago simulado' : 'Demostración';
  return <PublicShell><main className="confirmation"><div className="success-icon"><Check size={34} /></div><span className="eyebrow">Pedido registrado</span><h1>{transferPending ? <>Pedido recibido<br /><em>pendiente.</em></> : <>Simulación<br /><em>completada.</em></>}</h1><p>{transferPending ? 'La transferencia simulada queda pendiente de verificación. No se procesó ningún pago real.' : 'El pedido se guardó. El pago se simuló únicamente; no se realizó ningún cargo.'}</p><div className="confirmation-card"><div><span>Estado de pago</span><strong>{statusLabel}</strong></div><div><span>Total del pedido</span><strong>{formatQ(result?.total || 0)}</strong></div><div><span>Referencia del pedido</span><strong>{result?.reference || '—'}</strong></div></div><div className="landing-actions"><Link href="/store" className="button button-primary">Seguir comprando <ArrowRight size={16} /></Link></div></main></PublicShell>;
}

function AdminShell({ children }: { children: React.ReactNode }) { const { user, logout, role } = useApp(); const pathname = usePathname(); const router = useRouter(); const [mobile, setMobile] = useState(false); const navItems = [{ label: 'Resumen', icon: LayoutDashboard, path: '/admin/dashboard' }, { label: 'Catálogo', icon: Package, path: '/admin/products' }, { label: 'Marcas', icon: Tag, path: '/admin/brands' }, { label: 'Proveedores', icon: Truck, path: '/admin/suppliers' }, { label: 'Ventas', icon: CircleDollarSign, path: '/admin/sales' }, { label: 'Contabilidad', icon: Wallet, path: '/admin/accounting' }, { label: 'Inventario', icon: Boxes, path: '/admin/inventory' }, { label: 'Clientes', icon: Users, path: '/admin/customers' }]; const manage = [{ label: 'Compras de mercancía', icon: Package, path: '/admin/purchases' }, { label: 'Transferencias', icon: ArrowDownToLine, path: '/admin/transfers' }, { label: 'Usuarios', icon: UserCircle, path: '/admin/users' }, { label: 'Reportes', icon: BarChart3, path: '/admin/reports' }]; const isActive = (path: string) => pathname === path || (path === '/admin/products' && pathname.includes('/admin/categories')); const links = (items: typeof navItems) => items.filter(({ path }) => { const key = path.split('/')[2]; const map: Record<string, 'dashboard'|'products'|'inventory'|'orders'|'sales'|'customers'|'suppliers'|'reports'|'accounting'|'settings'|'users'> = { dashboard:'dashboard', products:'products', brands:'products', suppliers:'suppliers', sales:'sales', accounting:'accounting', inventory:'inventory', customers:'customers', purchases:'inventory', transfers:'orders', users:'users', reports:'reports' }; const permissionModule = key === 'accounting' ? 'accounting' : map[key] || 'dashboard'; return Boolean(role && roleService.can(role, permissionModule, 'view')); }).map(({ label, icon: NavIcon, path }) => <Link key={path} href={path} className={isActive(path) ? 'side-link active' : 'side-link'} onClick={() => setMobile(false)}><NavIcon size={17} /><span>{label}</span></Link>); return <div className="admin-app"><aside className={mobile ? 'admin-sidebar mobile-open' : 'admin-sidebar'}><div className="side-top"><Brand /><button className="close-mobile" onClick={() => setMobile(false)}><X size={20} /></button></div><div className="workspace-selector"><span className="workspace-logo">N</span><div><strong>NEXO Commerce</strong><small>Operación principal</small></div><ChevronDown size={15} /></div><nav><span className="side-label">Principal</span>{links(navItems)}<span className="side-label">Gestionar</span>{links(manage)}{role === 'superadmin' && links([{ label: 'Ofertas y anuncios', icon: Tag, path: '/admin/offers' }])}<span className="side-label">Sistema</span>{role && roleService.can(role, 'settings', 'view') && <Link href="/admin/settings" className={isActive('/admin/settings') ? 'side-link active' : 'side-link'}><Settings size={17} /><span>Configuración</span></Link>}</nav><div className="side-bottom"><div className="help-card"><Sparkles size={18} /><strong>¿Necesitas ayuda?</strong><span>Visita nuestro centro de soporte</span><a href="#help">Ir al centro <ArrowUpRight size={14} /></a></div><button className="user-mini" onClick={() => router.push('/admin/profile')}><span className="avatar">{user?.initials || 'NX'}</span><span><strong>{user?.name || 'María Fernanda'}</strong><small>{role ? roleLabels[role] : 'Administración'}</small></span><MoreDots /></button></div></aside><div className="admin-content"><header className="admin-header"><button className="mobile-menu" onClick={() => setMobile(true)}><Menu size={20} /></button><div className="admin-breadcrumb"><span>Panel</span><ChevronRight size={14} /><strong>{getModuleLabel(pathname)}</strong></div><div className="admin-header-actions"><button className="user-header" onClick={() => router.push('/admin/profile')}><span className="avatar">{user?.initials || 'NX'}</span><span><strong>{user?.name || 'María Fernanda'}</strong><small>{role ? roleLabels[role] : 'Administración'}</small></span><ChevronDown size={15} /></button><button className="logout-button" onClick={() => { void logout().then(() => router.push('/')).catch(() => window.alert('No se pudo cerrar la sesión. Verifica la conexión y vuelve a intentarlo.')); }}><LogOut size={17} /></button></div></header><div className="admin-main">{children}</div></div></div>; }
function MoreDots() { return <span className="more-dots">•••</span>; }
function getModuleLabel(path: string) { const labels: Record<string, string> = { dashboard: 'Resumen', products: 'Productos', brands: 'Marcas', categories: 'Categorías', sales: 'Ventas', inventory: 'Inventario', customers: 'Clientes', transfers: 'Transferencias', users: 'Usuarios', reports: 'Reportes', purchases: 'Compras de mercancía', accounting: 'Contabilidad', settings: 'Configuración', profile: 'Mi perfil', invoices: 'Facturación', payments: 'Pagos', suppliers: 'Proveedores', offers: 'Ofertas y anuncios', 'roles-permissions': 'Roles y permisos' }; return labels[path.split('/')[2]] || 'Resumen'; }

export function AdminSection({ section }: { section: string }) {
  const router = useRouter();
  useEffect(() => { if (section === 'orders') router.replace('/admin/dashboard'); }, [section, router]);
  if (section === 'orders') return null;
  return section === 'dashboard' ? <Dashboard /> : section === 'profile' ? <ProfilePage /> : section === 'accounting' ? <AccountingPage /> : section === 'purchases' ? <PurchasesPage /> : section === 'sales' ? <SalesPage /> : section === 'brands' ? <BrandsPage /> : section === 'suppliers' ? <SuppliersPage /> : section === 'roles-permissions' ? <RolesPermissionsPage /> : section === 'offers' ? <OffersAdminPage /> : section === 'transfers' ? <TransferReceiptsPage /> : section === 'settings' ? <><BusinessSettingsPanel /><PaymentMethodsSettings /></> : <ModulePage section={section} />;
}

export function AdminWorkspace({ children }: { children: React.ReactNode }) {
  const { user, userType, role, authLoading } = useApp();
  const pathname = usePathname();
  const router = useRouter();
  const authorized = Boolean(user && userType === 'admin' && role && canVisitAdminPath(role, pathname, user.permissions));
  useEffect(() => {
    if (authLoading) return;
    if (!user || !userType) router.replace(`/access?redirect=${encodeURIComponent(pathname)}`);
    else if (userType !== 'admin' || !role || !canVisitAdminPath(role, pathname, user.permissions)) router.replace(resolveLoginDestination(userType, role, null, user.permissions));
  }, [authLoading, user, userType, role, pathname, router]);
  if (authLoading || !authorized) return <AuthPending />;
  return <AdminShell>{children}</AdminShell>;
}

function BusinessSettingsPanel() {
  const [settings, setSettings] = useState<BusinessProfileSettings | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [message, setMessage] = useState('');
  useEffect(() => { let active = true; businessSettingsService.load().then((value) => { if (active) setSettings(value); }).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'No se pudo cargar la configuración.'); }); return () => { active = false; }; }, []);
  const save = async (event: React.FormEvent) => { event.preventDefault(); if (!settings) return; setBusy(true); setError(''); setMessage(''); try { setSettings(await businessSettingsService.save(settings)); setMessage('La información y las preferencias quedaron guardadas en PostgreSQL.'); } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo guardar la configuración.'); } finally { setBusy(false); } };
  return <section className="panel business-settings-panel"><div className="panel-heading"><div><h2>Datos del negocio</h2><span>Información y avisos persistidos en PostgreSQL.</span></div></div>{error && <div className="crud-error" role="alert">{error}</div>}{settings ? <form className="crud-form" onSubmit={save}><div className="crud-fields"><label className="field"><span>Nombre comercial</span><input required maxLength={160} value={settings.businessName} onChange={(event) => setSettings({ ...settings, businessName: event.target.value })} /></label><label className="field"><span>Correo de contacto</span><input required type="email" value={settings.contactEmail} onChange={(event) => setSettings({ ...settings, contactEmail: event.target.value })} /></label><label className="field"><span>Teléfono</span><input maxLength={40} value={settings.phone} onChange={(event) => setSettings({ ...settings, phone: event.target.value })} /></label><label className="field crud-field-wide"><span>Dirección</span><input maxLength={500} value={settings.address} onChange={(event) => setSettings({ ...settings, address: event.target.value })} /></label></div><div className="settings-checkboxes"><label><input type="checkbox" checked={settings.notifications.orders} onChange={(event) => setSettings({ ...settings, notifications: { ...settings.notifications, orders: event.target.checked } })} /> Avisos de pedidos</label><label><input type="checkbox" checked={settings.notifications.stock} onChange={(event) => setSettings({ ...settings, notifications: { ...settings.notifications, stock: event.target.checked } })} /> Avisos de bajo inventario</label></div>{message && <div className="crud-feedback" role="status">{message}</div>}<div className="modal-actions"><button className="button button-primary" type="submit" disabled={busy}>{busy ? 'Guardando…' : 'Guardar configuración'}</button></div></form> : !error ? <div className="empty-state">Cargando configuración…</div> : null}</section>;
}

function PaymentMethodsSettings() {
  const { paymentMethods, updatePaymentMethod } = useApp();
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const options = [
    { id: 'card' as const, label: 'Tarjeta simulada', description: 'Opción de demostración. No solicita ni guarda datos de tarjeta.', Icon: CreditCard },
    { id: 'transfer' as const, label: 'Transferencia bancaria', description: 'El pedido queda pendiente de verificación manual.', Icon: ArrowDownToLine },
  ];
  const toggle = async (method: 'card' | 'transfer') => {
    setPending(true); setError(''); setFeedback('');
    try {
      const next = await updatePaymentMethod(method, !paymentMethods[method]);
      setFeedback(`${options.find((option) => option.id === method)?.label} ${next[method] ? 'activado' : 'desactivado'} y guardado en PostgreSQL.`);
    } catch {
      setError('Debe quedar al menos un método de pago activo.');
    } finally { setPending(false); }
  };
  return <section className="panel payment-settings"><div className="panel-heading"><div><h2>Métodos de pago del sitio</h2><span>Elige cuáles opciones estarán disponibles en el checkout público.</span></div></div>
    <div className="payment-settings-list">{options.map(({ id, label, description, Icon }) => <article className="payment-setting" key={id}><span className="payment-setting-icon"><Icon size={19} /></span><div className="payment-setting-copy"><strong>{label}</strong><span>{description}</span></div><span className={`payment-setting-status ${paymentMethods[id] ? 'active' : ''}`}>{paymentMethods[id] ? 'Activo' : 'Inactivo'}</span><button type="button" role="switch" aria-checked={paymentMethods[id]} aria-label={`${paymentMethods[id] ? 'Desactivar' : 'Activar'} ${label}`} className={`payment-switch ${paymentMethods[id] ? 'on' : ''}`} disabled={pending} onClick={() => void toggle(id)}><span /></button></article>)}</div>
    {feedback && <p className="payment-settings-feedback" role="status">{feedback}</p>}{error && <p className="payment-settings-error" role="alert">{error}</p>}
    <p className="payment-settings-note"><ShieldCheck size={15} /> Los métodos solo simulan el flujo: no se realizan cobros reales ni se solicitan datos de tarjeta.</p>
  </section>;
}

function Dashboard() {
  const [period, setPeriod] = useState<'30d' | '7d' | 'year'>('30d');
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof dashboardService.summary>> | null>(null);
  const [error, setError] = useState('');
  const { reportLowStock, user } = useApp();
  useEffect(() => {
    let active = true;
    setSummary(null);
    setError('');
    dashboardService.summary(period).then((value) => { if (active) { setSummary(value); setError(''); } })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'No se pudieron cargar los indicadores.'); });
    productInventoryService.list().then(reportLowStock).catch(() => undefined);
    return () => { active = false; };
  }, [period, reportLowStock]);
  const exportCsv = () => {
    if (!summary) return;
    const rows = [['Fecha', 'Ventas', 'Operaciones'], ...summary.series.map((item) => [item.date, String(item.sales), String(item.orders)])];
    const url = URL.createObjectURL(new Blob([`\uFEFF${rows.map((row) => row.join(',')).join('\r\n')}`], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = `resumen-nexo-${period}.csv`; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const p = summary?.products || { products: 0, totalUnits: 0, lowStock: 0, outOfStock: 0 };
  const healthy = Math.max(0, p.products - p.lowStock - p.outOfStock);
  const dateLabel = new Intl.DateTimeFormat('es-GT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
  return <div className="dashboard">
    <div className="admin-page-heading"><div><span className="eyebrow">{dateLabel}</span><h1>Buenos días, {user?.name.split(' ')[0] || 'equipo'} <span>✦</span></h1><p>Indicadores calculados con los movimientos guardados en PostgreSQL.</p></div><div className="heading-actions"><button className="button button-outline" onClick={exportCsv} disabled={!summary}><Download size={16} /> Exportar</button></div></div>
    {error && <div className="crud-error" role="alert">{error}</div>}
    <div className="metric-grid"><Metric title="Ventas del periodo" value={summary ? formatQ(summary.sales) : '—'} change="PostgreSQL" positive icon={CircleDollarSign} tone="blue" /><Metric title="Pedidos y ventas" value={summary ? String(summary.orders) : '—'} change="Transacciones" positive icon={ShoppingBag} tone="purple" /><Metric title="Clientes nuevos" value={summary ? String(summary.newCustomers) : '—'} change="En el periodo" positive icon={Users} tone="green" /><Metric title="Ticket promedio" value={summary ? formatQ(summary.averageTicket) : '—'} change="En el periodo" positive icon={BarChart3} tone="orange" /></div>
    <div className="dashboard-grid"><section className="panel sales-panel"><div className="panel-heading"><div><h2>Rendimiento de ventas</h2><span>Ventas registradas diariamente en el periodo.</span></div><select value={period} onChange={(event) => setPeriod(event.target.value as typeof period)}><option value="30d">Últimos 30 días</option><option value="7d">Últimos 7 días</option><option value="year">Último año</option></select></div><div className="chart-legend"><span><i className="legend-blue" /> Ventas (Q)</span><span>{summary ? `${summary.series.length} días del periodo` : 'Actualizando periodo…'}</span></div>{summary ? <SalesChart series={summary.series} /> : <div className="empty-state">{error ? 'No se pudo cargar la actividad.' : 'Cargando actividad…'}</div>}</section>
      <section className="panel inventory-panel"><div className="panel-heading"><div><h2>Estado del inventario</h2><span>Productos activos y existencias reales.</span></div><Link href="/admin/inventory" className="panel-link">Ver inventario <ArrowUpRight size={14} /></Link></div>{summary ? <><InventoryDonut products={p.products} healthy={healthy} lowStock={p.lowStock} outOfStock={p.outOfStock} /><div className="inventory-alert"><div><span className="warning-icon">!</span><span><strong>{p.lowStock + p.outOfStock} productos requieren revisión</strong><small>{p.totalUnits} unidades registradas</small></span></div><Link href="/admin/inventory/alerts">Revisar <ArrowRight size={14} /></Link></div></> : <div className="empty-state">{error ? 'No se pudo cargar el inventario.' : 'Cargando inventario…'}</div>}</section></div>
    <div className="dashboard-grid bottom-grid"><section className="panel activity-panel"><div className="panel-heading"><div><h2>Actividad reciente</h2><span>Últimos pedidos y ventas registradas</span></div></div>{summary?.recentActivity.length ? <div className="activity-list">{summary.recentActivity.map((item) => <div className="activity-item" key={`${item.type}-${item.id}`}><span className={`activity-icon ${item.type === 'sales' ? 'blue' : 'green'}`}><Icon name={item.type === 'sales' ? 'arrow' : 'check'} size={16} /></span><div><strong>{item.title}</strong><span>{item.description}</span></div><time>{item.time}</time></div>)}</div> : <div className="empty-state">Aún no hay actividad registrada.</div>}</section></div>
  </div>;
}
function Metric({ title, value, change, positive, icon: MetricIcon, tone }: { title: string; value: string; change: string; positive: boolean; icon: typeof CircleDollarSign; tone: string }) { return <div className="metric-card"><div className={`metric-icon ${tone}`}><MetricIcon size={20} /></div><div className="metric-content"><span>{title}</span><strong>{value}</strong><small className={positive ? 'positive' : 'negative'}>{change} <em>dato consolidado</em></small></div><div className="metric-spark" aria-hidden="true"><span /><span /><span /><span /><span /><span /></div></div>; }
function SalesChart({ series }: { series: { date: string; sales: number; orders: number }[] }) {
  const max = Math.max(1, ...series.map((item) => item.sales));
  const points = series.map((item, index) => ({ item, x: series.length <= 1 ? 350 : index * 700 / (series.length - 1), y: 190 - item.sales / max * 165 }));
  const line = points.map(({ x, y }) => `${x},${y}`).join(' ');
  const area = points.length ? `0,220 ${line} 700,220` : '';
  return <div className="sales-chart"><div className="y-axis"><span>{formatQ(max)}</span><span>{formatQ(max / 2)}</span><span>Q 0</span></div><div className="chart-body"><div className="grid-lines"><i /><i /><i /><i /><i /><i /></div><svg viewBox="0 0 700 220" preserveAspectRatio="none" role="img" aria-label="Ventas almacenadas por día"><defs><linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#9fbaf1" stopOpacity=".44" /><stop offset="100%" stopColor="#9fbaf1" stopOpacity="0" /></linearGradient></defs>{points.length > 0 && <><polygon points={area} fill="url(#chartFill)" /><polyline points={line} fill="none" stroke="#3d568f" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />{points.map(({ item, x, y }) => <circle key={item.date} cx={x} cy={y} r={series.length > 90 ? 1.8 : 3} fill="#3d568f"><title>{new Date(`${item.date}T00:00:00`).toLocaleDateString('es-GT', { day: 'numeric', month: 'long', year: 'numeric' })}: {formatQ(item.sales)} · {item.orders} transacciones</title></circle>)}</>}</svg><div className="x-axis">{series.filter((_, index) => index === 0 || index === series.length - 1 || index % Math.max(1, Math.floor(series.length / 5)) === 0).map((item) => <span key={item.date}>{new Date(`${item.date}T00:00:00`).toLocaleDateString('es-GT', { day: 'numeric', month: 'short' })}</span>)}</div></div></div>;
}

function InventoryDonut({ products, healthy, lowStock, outOfStock }: { products: number; healthy: number; lowStock: number; outOfStock: number }) {
  const [activeSegment, setActiveSegment] = useState<'healthy' | 'low' | 'empty' | null>(null);
  const segments = [
    { id: 'healthy' as const, label: 'En stock', value: healthy, color: '#3d568f' },
    { id: 'low' as const, label: 'Bajo stock', value: lowStock, color: '#a8bd69' },
    { id: 'empty' as const, label: 'Agotados', value: outOfStock, color: '#f0a44b' },
  ];
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  const active = segments.find((segment) => segment.id === activeSegment);
  const percent = active && products ? (active.value / products) * 100 : 0;
  return <div className="donut-wrap"><div className="inventory-donut" onMouseLeave={() => setActiveSegment(null)}>
    <svg className="donut-chart" viewBox="0 0 120 120" role="group" aria-label="Estado de las existencias de productos activos">
      {segments.map((segment) => {
        const length = products ? (segment.value / products) * circumference : 0;
        const segmentOffset = offset;
        offset += length;
        return <circle key={segment.id} cx="60" cy="60" r={radius} fill="none" stroke={segment.color} strokeWidth="16"
          strokeDasharray={`${length} ${circumference - length}`} strokeDashoffset={-segmentOffset}
          tabIndex={segment.value ? 0 : -1} role="img" aria-label={`${segment.label}: ${segment.value} de ${products} productos`}
          onMouseEnter={() => setActiveSegment(segment.id)} onFocus={() => setActiveSegment(segment.id)} onBlur={() => setActiveSegment(null)} />;
      })}
    </svg>
    <div className="donut-center"><strong>{products}</strong><span>productos</span></div>
    {active && <div className="donut-tooltip" role="status"><strong>{active.label}</strong><span>{active.value} de {products} productos</span><small>{percent.toLocaleString('es-GT', { maximumFractionDigits: 1 })}% del inventario activo</small></div>}
  </div><div className="donut-legend"><span><i className="dot blue-bg" /> En stock <b>{healthy}</b></span><span><i className="dot lime-bg" /> Bajo stock <b>{lowStock}</b></span><span><i className="dot orange-bg" /> Agotados <b>{outOfStock}</b></span></div></div>;
}

function ModulePage({ section }: { section: string }) { const config = moduleConfig[section] || moduleConfig.products; return <AdminCrudModule section={section} config={config} />; }

const moduleConfig: Record<string, AdminModuleConfig> = {
  products: { title: 'Productos', description: 'Administra tu catálogo y mantén la información siempre actualizada.', action: 'Nuevo producto', columns: ['Producto', 'Marca', 'Categoría', 'SKU', 'Valor', 'Existencias', 'Estado'], stats: [{ label: 'Total productos', value: '156', detail: '+12 este mes', tone: 'positive' }, { label: 'Activos', value: '124', detail: '79.5% del catálogo' }, { label: 'Bajo stock', value: '24', detail: 'Requieren atención', tone: 'warning' }, { label: 'Agotados', value: '8', detail: 'Acción recomendada', tone: 'danger' }], rows: products.map((p) => ({ Producto: p.name, Marca: p.brandId || '', Categoría: p.category, SKU: p.sku, Valor: p.price, Existencias: p.stock, Imagen: p.image, Estado: p.status })) },
  inventory: { title: 'Inventario', description: 'Controla existencias, ubicaciones y movimientos de tus productos.', columns: ['Producto', 'Marca', 'SKU', 'Existencias', 'Ubicación', 'Estado'], stats: [{ label: 'Unidades totales', value: '2,486', detail: '+8.6%', tone: 'positive' }, { label: 'Valor inventario', value: 'Q 186k', detail: 'Costo estimado' }, { label: 'Bajo stock', value: '24', detail: 'Requieren atención', tone: 'warning' }, { label: 'Movimientos hoy', value: '36', detail: '8 entradas · 28 salidas' }], rows: products.map((p) => ({ Producto: p.name, Marca: p.brandId || '', Categoría: p.category, SKU: p.sku, Valor: p.price, Existencias: p.stock, Imagen: p.image, Ubicación: 'Bodega central', Estado: p.status === 'Activo' ? 'En stock' : p.status })) },
  customers: { title: 'Clientes', description: 'Conoce y gestiona la relación con las personas que compran en NEXO.', action: 'Nuevo cliente', columns: ['Nombre', 'Correo', 'Pedidos', 'Total comprado', 'Estado'], stats: [{ label: 'Clientes totales', value: '2,504', detail: '+14.2% este mes', tone: 'positive' }, { label: 'Nuevos este mes', value: '184', detail: '+8.4%', tone: 'positive' }, { label: 'Clientes recurrentes', value: '68%', detail: 'Últimos 90 días' }, { label: 'Ticket promedio', value: 'Q 377', detail: '+2.4%', tone: 'positive' }], rows: [{ Nombre: 'Valeria Castillo', Correo: 'valeria@email.com', Pedidos: 12, 'Total comprado': 4280, Estado: 'Activo' }, { Nombre: 'Alejandro Pérez', Correo: 'alejandro@email.com', Pedidos: 8, 'Total comprado': 3120, Estado: 'Activo' }, { Nombre: 'Sofía Rodríguez', Correo: 'sofia@email.com', Pedidos: 5, 'Total comprado': 1840, Estado: 'Activo' }, { Nombre: 'Mateo Estrada', Correo: 'mateo@email.com', Pedidos: 3, 'Total comprado': 2160, Estado: 'Activo' }] },
  users: { title: 'Usuarios y equipo', description: 'Administra accesos, roles y permisos del equipo NEXO.', action: 'Invitar usuario', columns: ['Nombre', 'Correo', 'Rol', 'Último acceso', 'Estado'], stats: [{ label: 'Usuarios activos', value: '8', detail: 'De 10 registrados' }, { label: 'Administradores', value: '2', detail: 'Acceso elevado' }, { label: 'Invitaciones', value: '2', detail: 'Pendientes', tone: 'warning' }, { label: 'Roles configurados', value: '5', detail: 'Permisos activos' }], rows: users.map((u) => ({ Nombre: u.name, Correo: u.email, Rol: roleLabels[u.role], 'Último acceso': 'Hoy, 09:42', Estado: u.status })) },
  transfers: { title: 'Transferencias', description: 'Verifica los comprobantes y confirma los pagos pendientes.', columns: ['Pedido', 'Cliente', 'Fecha', 'Valor', 'Estado de pago'], stats: [{ label: 'Por verificar', value: '7', detail: 'Requieren revisión', tone: 'warning' }, { label: 'Aprobadas hoy', value: '14', detail: '+16.7%', tone: 'positive' }, { label: 'Rechazadas', value: '2', detail: 'Este mes', tone: 'danger' }, { label: 'Monto pendiente', value: 'Q 8,460', detail: 'En verificación' }], rows: orders.filter((o) => o.payment === 'Transferencia').map((o) => ({ Pedido: o.id, Cliente: o.customer, Fecha: o.date, Valor: o.total, 'Estado de pago': o.status === 'Completado' ? 'Aprobada' : 'Pendiente' })) },
  sales: { title: 'Ventas', description: 'Analiza el rendimiento comercial de tu negocio.', action: 'Registrar venta', columns: ['Pedido', 'Cliente', 'Fecha', 'Total', 'Estado'], stats: [{ label: 'Ventas del mes', value: 'Q 48,290', detail: '+18.4%', tone: 'positive' }, { label: 'Transacciones', value: '128', detail: '+12.8%', tone: 'positive' }, { label: 'Ticket promedio', value: 'Q 377', detail: '+2.4%', tone: 'positive' }, { label: 'Devoluciones', value: 'Q 920', detail: '1.9% del total', tone: 'warning' }], rows: orders.map((o) => ({ Pedido: o.id, Cliente: o.customer, Fecha: o.date, Total: o.total, Estado: o.status })) },
  categories: { title: 'Categorías', description: 'Organiza tu catálogo para que tus clientes encuentren lo que buscan.', action: 'Nueva categoría', columns: ['Nombre', 'Productos', 'Ventas del mes', 'Estado'], stats: [{ label: 'Categorías activas', value: '4', detail: 'Todas visibles' }, { label: 'Más productos', value: 'Tecnología', detail: '3 categorías' }, { label: 'Más vendida', value: 'Hogar', detail: '32% de ventas' }, { label: 'Sin productos', value: '0', detail: 'Catálogo organizado' }], rows: [{ Nombre: 'Tecnología', Productos: 42, 'Ventas del mes': 18200, Estado: 'Activo' }, { Nombre: 'Hogar', Productos: 38, 'Ventas del mes': 15480, Estado: 'Activo' }, { Nombre: 'Accesorios', Productos: 45, 'Ventas del mes': 9210, Estado: 'Activo' }, { Nombre: 'Bienestar', Productos: 31, 'Ventas del mes': 5400, Estado: 'Activo' }] },
  reports: { title: 'Reportes', description: 'Convierte los datos de tu operación en decisiones más claras.', action: 'Generar reporte', columns: ['Reporte', 'Periodo', 'Generado por', 'Fecha', 'Estado'], stats: [{ label: 'Reportes generados', value: '24', detail: 'Este mes' }, { label: 'Ventas analizadas', value: 'Q 186k', detail: 'Últimos 90 días' }, { label: 'Productos vendidos', value: '1,284', detail: '+16.2%', tone: 'positive' }, { label: 'Exportaciones', value: '18', detail: 'En formato CSV' }], rows: [{ Reporte: 'Rendimiento de ventas', Periodo: '01–14 sep 2025', 'Generado por': 'María López', Fecha: 'Hoy, 10:20', Estado: 'Completado' }, { Reporte: 'Inventario valorizado', Periodo: 'Septiembre 2025', 'Generado por': 'Carlos Méndez', Fecha: '12 sep, 15:40', Estado: 'Completado' }, { Reporte: 'Clientes recurrentes', Periodo: 'Q3 2025', 'Generado por': 'Ana Sofía', Fecha: '10 sep, 09:12', Estado: 'Completado' }] },
  settings: { title: 'Configuración', description: 'Personaliza la operación y las preferencias de tu cuenta.', action: 'Guardar cambios', columns: ['Configuración', 'Descripción', 'Estado'], stats: [{ label: 'Perfil de negocio', value: 'Completo', detail: 'Información actualizada' }, { label: 'Métodos disponibles', value: '2', detail: 'Se configuran arriba' }, { label: 'Notificaciones', value: 'Activas', detail: 'Preferencias guardadas' }, { label: 'Integraciones', value: '0', detail: 'Preparadas para API' }], rows: [{ Configuración: 'Datos del negocio', Descripción: 'Nombre, dirección y contacto', Estado: 'Activo' }, { Configuración: 'Notificaciones', Descripción: 'Alertas de pedidos y stock', Estado: 'Activo' }] },
};

moduleConfig['inventory/alerts'] = { ...moduleConfig.inventory, title: 'Alertas de stock', description: 'Identifica productos que necesitan reposición antes de afectar tus ventas.', action: undefined, columns: ['Producto', 'SKU', 'Existencias', 'Ubicación', 'Estado'], rows: products.filter((p) => p.stock < 15).map((p) => ({ Producto: p.name, SKU: p.sku, Existencias: p.stock, Ubicación: 'Bodega central', Estado: p.status })) };
moduleConfig['inventory/history'] = { ...moduleConfig.inventory, title: 'Historial de movimientos', description: 'Consulta entradas, salidas y ajustes registrados en tu inventario.', action: undefined, columns: ['Producto', 'SKU', 'Existencias', 'Ubicación', 'Estado'], rows: [{ Producto: 'Auriculares Wave Pro', SKU: 'TEC-WAV-001', Existencias: 12, Ubicación: 'Bodega central', Estado: 'Entrada' }, { Producto: 'Mochila Terra Daily', SKU: 'ACC-TER-003', Existencias: -4, Ubicación: 'Sala de ventas', Estado: 'Salida' }, { Producto: 'Lámpara Aura Mini', SKU: 'HOG-AUR-002', Existencias: 8, Ubicación: 'Bodega central', Estado: 'Entrada' }] };
moduleConfig.invoices = { ...moduleConfig.sales, title: 'Referencias de pedidos', description: 'Consulta referencias de pedidos registrados. No son facturas fiscales.', action: undefined, columns: ['Referencia', 'Cliente', 'Fecha', 'Total', 'Estado'], rows: [] };
moduleConfig.payments = { ...moduleConfig.transfers, title: 'Pagos', description: 'Supervisa los métodos de pago y el estado de cada transacción.', action: undefined, columns: ['Pedido', 'Cliente', 'Fecha', 'Valor', 'Estado de pago'], rows: orders.map((o) => ({ Pedido: o.id, Cliente: o.customer, Fecha: o.date, Valor: o.total, 'Estado de pago': o.payment === 'Tarjeta' ? 'Aprobada' : 'Pendiente' })) };
moduleConfig.suppliers = { ...moduleConfig.products, title: 'Proveedores', description: 'Administra empresas abastecedoras y sus productos asociados.', action: 'Nuevo proveedor', columns: ['Empresa', 'Contacto', 'Teléfono', 'Correo', 'Productos abastecidos', 'Último pedido', 'Estado'], rows: suppliers.map((supplier) => ({ Empresa: supplier.name, Contacto: supplier.contactPerson || '—', Teléfono: supplier.phone || '—', Correo: supplier.email || '—', 'Productos abastecidos': supplier.productIds.length, 'Último pedido': supplier.lastOrder || 'Sin pedidos', Estado: supplier.status })) };
moduleConfig['roles-permissions'] = { ...moduleConfig.users, title: 'Roles y permisos', description: 'Define el acceso de cada perfil a las áreas de NEXO.', action: 'Nuevo rol', columns: ['Nombre', 'Usuarios', 'Permisos', 'Última actualización', 'Estado'], rows: [{ Nombre: 'Súper Administrador', Usuarios: 1, Permisos: 'Acceso completo', 'Última actualización': 'Hoy, 09:42', Estado: 'Activo' }, { Nombre: 'Administrador', Usuarios: 1, Permisos: 'Operación completa', 'Última actualización': '12 sep 2025', Estado: 'Activo' }, { Nombre: 'Vendedor', Usuarios: 2, Permisos: 'Ventas y clientes', 'Última actualización': '08 sep 2025', Estado: 'Activo' }, { Nombre: 'Personal de bodega', Usuarios: 2, Permisos: 'Inventario', 'Última actualización': '08 sep 2025', Estado: 'Activo' }] };
moduleConfig.profile = { ...moduleConfig.settings, title: 'Mi perfil', description: 'Actualiza tus datos personales y preferencias de acceso.', action: 'Guardar perfil', columns: ['Configuración', 'Descripción', 'Estado'], rows: [{ Configuración: 'Información personal', Descripción: 'Nombre y correo del usuario', Estado: 'Activo' }, { Configuración: 'Seguridad', Descripción: 'Contraseña y sesiones activas', Estado: 'Activo' }, { Configuración: 'Preferencias', Descripción: 'Idioma y notificaciones', Estado: 'Activo' }] };

export function AdminAlertHost() {
  const { adminAlert, dismissAdminAlert } = useApp();
  const router = useRouter();
  const closeRef = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!adminAlert) return;
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); dismissAdminAlert(); }
      if (event.key === 'Tab') {
        const dialog = document.querySelector<HTMLElement>('.admin-alert-dialog');
        const focusable = dialog?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]');
        if (!focusable?.length) return;
        const first = focusable[0]; const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => { window.removeEventListener('keydown', onKeyDown); previousFocus.current?.focus(); };
  }, [adminAlert, dismissAdminAlert]);
  if (!adminAlert) return null;
  const close = () => dismissAdminAlert();
  return <div className="admin-alert-backdrop"><section className={`admin-alert-dialog ${adminAlert.type}`} role="alertdialog" aria-modal="true" aria-labelledby="admin-alert-title" aria-describedby="admin-alert-description"><div className={`admin-alert-icon ${adminAlert.type}`} aria-hidden="true">{adminAlert.type === 'warning' ? '!' : adminAlert.type === 'success' ? '✓' : 'i'}</div><div className="admin-alert-content"><span className="eyebrow">{adminAlert.type === 'warning' ? 'Advertencia' : adminAlert.type === 'success' ? 'Operación completada' : 'Actualización'}</span><h2 id="admin-alert-title">{adminAlert.title}</h2><p className="admin-alert-entity">{adminAlert.entity}</p><p id="admin-alert-description">{adminAlert.message}</p><p className="admin-alert-next"><strong>Siguiente acción:</strong> {adminAlert.nextAction}</p><div className="admin-alert-actions"><button type="button" className="button button-outline" ref={closeRef} onClick={close}>Cerrar</button>{adminAlert.actionTo && <button type="button" className="button button-primary" onClick={() => { close(); router.push(adminAlert.actionTo!); }}>Ir al módulo</button>}</div></div></section></div>;
}
