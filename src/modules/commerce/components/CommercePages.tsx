'use client';

import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowDownToLine, ArrowLeft, ArrowRight, Check, ChevronDown, ChevronLeft, ChevronRight, CreditCard, Gift, Heart, Menu, Minus, Plus, Search, ShieldCheck, ShoppingCart, SlidersHorizontal, Sparkles, Tag, Trash2, Truck, Wallet, X } from 'lucide-react';
import { formatQ, products } from '../../../data/mockData';
import { useApp } from '../../../contexts/AppContext';
import { fetchCatalogFromApi } from '../../products/services/productService';
import { checkoutService, customerPortalService } from '../../../services';
import type { PaymentMethod, Product } from '../../../types';
import { applyPromotion, emptyPromotionData, isPromotionActive, loadPromotionData, loadRecentlyViewed, recordRecentlyViewed, validateDiscountCode } from '../services/commerceDataService';
import PublicAccountControls from '../../app/components/PublicAccountControls';
import CustomerNotificationBell from './CustomerNotificationBell';

function SafeImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  if (!src?.trim()) return null;
  return <img className={className} src={src} alt={alt} loading="lazy" decoding="async" onError={(event) => {
    event.currentTarget.hidden = true;
    event.currentTarget.parentElement?.classList.add('image-fallback');
  }} />;
}

function PublicShell({ children }: { children: React.ReactNode }) {
  const { cartCount } = useApp();
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

  return <div className="public-app"><header className="public-header"><Link href="/" className="brand"><span className="brand-mark"><span /></span><span>NEXO</span></Link><nav id="commerce-navigation" className={`public-nav${menuOpen ? ' is-open' : ''}`} aria-label="Navegación principal"><Link href="/store" onClick={closeMenu}>Tienda</Link><Link href="/#benefits" onClick={closeMenu}>Beneficios</Link><Link href="/#about" onClick={closeMenu}>Nosotros</Link><div className="public-nav-account"><PublicAccountControls onAction={closeMenu} /></div></nav><div className="header-actions"><CustomerNotificationBell /><PublicAccountControls onAction={closeMenu} /><button type="button" className="public-menu-toggle" aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'} aria-expanded={menuOpen} aria-controls="commerce-navigation" onClick={() => setMenuOpen((open) => !open)}>{menuOpen ? <X size={20} /> : <Menu size={20} />}</button><Link href="/cart" className="cart-button"><ShoppingCart size={18} /><span className="cart-label">Carrito</span>{cartCount > 0 && <b>{cartCount}</b>}</Link></div></header>{children}</div>;
}

function ProductCard({ product }: { product: Product }) {
  const { addToCart, userType } = useApp();
  const [added, setAdded] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const add = () => {
    if (!product.stock) return;
    addToCart(product);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1200);
  };
  const save = async () => {
    try { await customerPortalService.addWishlist(product.id); setSaved(true); setSaveMessage('Guardado en Mi wishlist'); }
    catch (issue) { setSaveMessage(issue instanceof Error ? issue.message : 'No se pudo guardar.'); }
  };
  return <article className="product-card"><Link href={`/product/${product.id}`} className="product-image-wrap"><SafeImage src={product.image} alt={product.name} />{product.compareAt && <span className="sale-tag">Oferta</span>}{product.status === 'Bajo stock' && <span className="stock-tag">Últimas unidades</span>}<span className="quick-view">Ver producto <ArrowRight size={14} /></span></Link><div className="product-info"><span className="product-category">{product.category}</span><Link href={`/product/${product.id}`}><h3>{product.name}</h3></Link>{userType === 'customer' && <button type="button" className="wishlist-save" onClick={() => void save()} disabled={saved} aria-label={`Guardar ${product.name} en wishlist`}>{saved ? <Check size={14} /> : <Heart size={14} />}{saved ? 'Guardado' : 'Guardar favorito'}</button>}{saveMessage && <span className="wishlist-message" role="status">{saveMessage}</span>}<div className="product-bottom"><div><strong>{formatQ(product.price)}</strong>{product.compareAt && <del>{formatQ(product.compareAt)}</del>}</div><button type="button" className={added ? 'add-button added' : 'add-button'} disabled={!product.stock} onClick={add} aria-label={`Agregar ${product.name} al carrito`}>{added ? <Check size={17} /> : <Plus size={18} />}</button></div></div></article>;
}

export function Storefront() {
  const [catalog, setCatalog] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('Todos');
  const [sort, setSort] = useState('featured');
  const [page, setPage] = useState(1);
  const [catalogError, setCatalogError] = useState('');
  const [loading, setLoading] = useState(true);
  const [promotions, setPromotions] = useState(emptyPromotionData);
  const [recentIds, setRecentIds] = useState<string[]>([]);

  useEffect(() => {
    loadPromotionData().then(setPromotions).catch(() => setCatalogError('No se pudieron cargar las promociones.'));
    setRecentIds(loadRecentlyViewed());
    fetchCatalogFromApi().then((result) => {
      setCatalog(result.products);
    }).catch(() => setCatalogError('No se pudo cargar el catálogo. Inténtalo de nuevo.')).finally(() => setLoading(false));
  }, []);

  const activeOffers = promotions.offers.filter((offer) => isPromotionActive(offer));
  const categories = ['Todos', ...(activeOffers.length ? ['Ofertas'] : []), ...Array.from(new Set(catalog.map((product) => product.category)))];
  const promotedCatalog = catalog.map((product) => applyPromotion(product, promotions.offers));
  const filtered = useMemo(() => promotedCatalog.filter((product) => {
    const matchesCategory = category === 'Todos' || (category === 'Ofertas' ? Boolean(product.compareAt && product.price < product.compareAt) : product.category === category);
    return matchesCategory && product.name.toLowerCase().includes(search.toLowerCase());
  }).sort((a, b) => sort === 'price-low' ? a.price - b.price : sort === 'price-high' ? b.price - a.price : Number(b.featured) - Number(a.featured)), [promotedCatalog, category, search, sort]);
  useEffect(() => setPage(1), [search, category, sort]);
  const pageSize = 16;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
  const offerProducts = activeOffers.map((offer) => promotedCatalog.find((product) => product.id === offer.productId)).filter((product): product is Product => Boolean(product)).slice(0, 4);
  const announcements = promotions.announcements.filter((item) => item.status === 'Activa');
  const recentlyViewed = recentIds.map((id) => promotedCatalog.find((product) => product.id === id)).filter((product): product is Product => Boolean(product)).slice(0, 4);

  return <PublicShell><main className="store-page"><section className="store-hero"><div><span className="eyebrow">Selección NEXO · {new Date().getFullYear()}</span><h1>Encuentra algo<br /><em>que te inspire.</em></h1><p>Productos útiles, bonitos y elegidos para acompañarte todos los días.</p></div><div className="store-hero-badge"><Sparkles size={17} /><span>Catálogo actualizado</span><strong>{catalog.length} productos</strong></div></section>{catalogError && <p role="alert" className="commerce-notice">{catalogError}</p>}
    {announcements.length > 0 && <section className="store-announcements"><div className="store-announcements-heading"><strong>Novedades NEXO</strong><span className="eyebrow">Anuncios activos</span></div><div className="store-announcement-list">{announcements.slice(0, 3).map((item) => <Link href={item.href || '/store'} key={item.id}><span className="announcement-icon"><Sparkles size={16} /></span><span><strong>{item.title}</strong><small>{item.description}</small></span><ArrowRight size={15} /></Link>)}</div></section>}
    {offerProducts.length > 0 && <section className="store-offers"><div className="store-section-heading"><div><span className="eyebrow">Por tiempo limitado</span><h2>Ofertas para descubrir</h2><p>Precios especiales disponibles ahora.</p></div><Link href="/store" className="text-link" onClick={() => setCategory('Ofertas')}>Ver todas <ArrowRight size={16} /></Link></div><div className="product-grid offer-grid">{offerProducts.map((product) => <ProductCard key={product.id} product={product} />)}</div></section>}
    <section className="store-toolbar"><div className="search-box"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar productos..." aria-label="Buscar productos" />{search && <button type="button" onClick={() => setSearch('')} aria-label="Limpiar búsqueda"><X size={16} /></button>}</div><div className="category-pills">{categories.map((item) => <button type="button" key={item} className={category === item ? 'active' : ''} onClick={() => setCategory(item)}>{item}</button>)}</div><label className="sort-select"><SlidersHorizontal size={16} /><select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Ordenar catálogo"><option value="featured">Destacados</option><option value="price-low">Precio menor</option><option value="price-high">Precio mayor</option></select><ChevronDown size={15} /></label></section>
    <div className="catalog-meta"><span>{loading ? 'Cargando catálogo...' : `${filtered.length} productos · página ${page} de ${totalPages}`}</span><span className="catalog-tip"><Sparkles size={14} />Datos desde PostgreSQL</span></div>{visible.length > 0 ? <><div className="product-grid">{visible.map((product) => <ProductCard key={product.id} product={product} />)}</div><div className="catalog-pagination"><button type="button" disabled={page === 1} onClick={() => setPage((current) => current - 1)}><ChevronLeft size={16} /> Anterior</button><span>Página <strong>{page}</strong> de {totalPages}</span><button type="button" disabled={page === totalPages} onClick={() => setPage((current) => current + 1)}>Siguiente <ChevronRight size={16} /></button></div></> : !loading && !catalogError ? <div className="empty-state"><Search size={30} /><h3>No encontramos resultados</h3><p>Prueba con otra búsqueda o categoría.</p></div> : null}
    {recentlyViewed.length > 0 && <section className="recently-viewed"><div className="section-heading"><div><span className="eyebrow">Tu recorrido</span><h2>Vistos recientemente</h2></div></div><div className="product-grid recent-grid">{recentlyViewed.map((product) => <ProductCard key={product.id} product={product} />)}</div></section>}</main></PublicShell>;
}

export function SeasonalSpotlight() {
  const featured = products.find((product) => product.featured && product.image) || products[0];
  return <section className="seasonal-spotlight"><div className="seasonal-spotlight-image"><SafeImage src={featured.image} alt={featured.name} /></div><div className="seasonal-spotlight-copy"><span className="eyebrow"><Sparkles size={14} /> Selección de temporada</span><h2>Ideas que hacen<br /><em>más simple tu día.</em></h2><p>Encuentra favoritos para renovar tus espacios, organizarte y disfrutar cada momento.</p><Link href="/store" className="button button-primary">Explorar la selección <ArrowRight size={16} /></Link><small>Descubre novedades y ofertas seleccionadas por NEXO.</small></div><div className="seasonal-spotlight-mark" aria-hidden="true">N.</div></section>;
}

export function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [catalog, setCatalog] = useState<Product[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [promotions, setPromotions] = useState(emptyPromotionData);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const { addToCart } = useApp();
  useEffect(() => {
    loadPromotionData().then(setPromotions).catch(() => undefined);
    fetchCatalogFromApi().then((result) => {
      setCatalog(result.products);
    }).catch(() => undefined).finally(() => setLoaded(true));
  }, []);
  const found = catalog.find((item) => item.id === id);
  const product = found ? applyPromotion(found, promotions.offers) : undefined;
  useEffect(() => { if (product) recordRecentlyViewed(product.id); }, [product?.id]);
  if (!product && !loaded) return <PublicShell><main className="detail-page"><p>Cargando producto...</p></main></PublicShell>;
  if (!product) return <PublicShell><main className="detail-page"><div className="empty-state"><h1>Producto no encontrado</h1><Link href="/store" className="button button-primary">Volver a la tienda</Link></div></main></PublicShell>;
  const add = () => { for (let count = 0; count < quantity; count += 1) addToCart(product); setAdded(true); };
  return <PublicShell><main className="detail-page"><Link href="/store" className="back-link"><ArrowLeft size={16} /> Volver al catálogo</Link><div className="detail-layout"><div className="detail-image"><SafeImage src={product.image} alt={product.name} />{product.compareAt && <span className="sale-tag">Oferta especial</span>}</div><div className="detail-copy"><span className="eyebrow">{product.category} · {product.sku}</span><h1>{product.name}</h1><div className="detail-price"><strong>{formatQ(product.price)}</strong>{product.compareAt && <del>{formatQ(product.compareAt)}</del>}{product.compareAt && <span>Ahorra {formatQ(product.compareAt - product.price)}</span>}</div><p>{product.description}</p><div className="detail-stock"><span className={product.stock < 10 ? 'orange-dot' : 'green-dot'} />{product.stock ? `${product.stock} unidades disponibles` : 'Producto agotado'}</div><div className="detail-buy"><div className="quantity"><button type="button" onClick={() => setQuantity((value) => Math.max(1, value - 1))} aria-label="Restar"><Minus size={15} /></button><span>{quantity}</span><button type="button" onClick={() => setQuantity((value) => Math.min(product.stock || 1, value + 1))} aria-label="Sumar"><Plus size={15} /></button></div><button type="button" className="button button-primary" disabled={!product.stock} onClick={add}>{added ? <><Check size={17} /> Agregado al carrito</> : <><ShoppingCart size={17} /> Agregar al carrito</>}</button></div>{added && <button type="button" className="text-link detail-go-cart" onClick={() => router.push('/cart')}>Ir al carrito <ArrowRight size={16} /></button>}<div className="detail-benefits"><div><Truck size={17} /><span>Envío nacional<br /><small>2–4 días hábiles</small></span></div><div><ShieldCheck size={17} /><span>Compra segura<br /><small>Datos protegidos</small></span></div><div><Gift size={17} /><span>Devolución fácil<br /><small>30 días</small></span></div></div></div></div><section className="related"><div className="section-heading"><div><span className="eyebrow">También te puede gustar</span><h2>Más para descubrir</h2></div><Link href="/store" className="text-link">Ver catálogo completo <ArrowRight size={16} /></Link></div><div className="product-grid related-grid">{catalog.filter((item) => item.id !== product.id).slice(0, 4).map((item) => <ProductCard key={item.id} product={applyPromotion(item, promotions.offers)} />)}</div></section></main></PublicShell>;
}

function readAppliedCode() {
  try { return window.sessionStorage.getItem('nexo-applied-discount') || ''; } catch { return ''; }
}

export function CartExperience() {
  const { cart, cartTotal, updateQuantity, removeFromCart } = useApp();
  const router = useRouter();
  const [code, setCode] = useState('');
  const [appliedCode, setAppliedCode] = useState('');
  const [message, setMessage] = useState('');
  const [discount, setDiscount] = useState(0);
  useEffect(() => { const saved = readAppliedCode(); setAppliedCode(saved); setCode(saved); }, []);
  useEffect(() => {
    if (!appliedCode) { setDiscount(0); return; }
    let active = true;
    validateDiscountCode(appliedCode, cartTotal).then((result) => { if (active) setDiscount(result.valid ? Number(result.discount || 0) : 0); }).catch(() => { if (active) setDiscount(0); });
    return () => { active = false; };
  }, [appliedCode, cartTotal]);
  const applyCode = async () => {
    try {
      const result = await validateDiscountCode(code, cartTotal);
      if (!result.valid || !result.code) { setAppliedCode(''); setMessage(result.message || 'Código inválido.'); try { window.sessionStorage.removeItem('nexo-applied-discount'); } catch { /* optional storage */ } return; }
      setAppliedCode(result.code.code);
      setDiscount(Number(result.discount || 0));
      setCode(result.code.code);
      setMessage(`Código aplicado: ${result.code.discountPercent}% de descuento.`);
      try { window.sessionStorage.setItem('nexo-applied-discount', result.code.code); } catch { /* optional storage */ }
    } catch { setMessage('No se pudo comprobar el código. Inténtalo de nuevo.'); }
  };
  return <PublicShell><main className="cart-page"><div className="page-title-row"><div><span className="eyebrow">Tu selección</span><h1>Mi carrito <span>({cart.reduce((sum, item) => sum + item.quantity, 0)})</span></h1></div><Link href="/store" className="text-link"><ArrowLeft size={16} /> Seguir comprando</Link></div>{cart.length === 0 ? <div className="empty-state cart-empty"><ShoppingCart size={34} /><h3>Tu carrito está esperando</h3><p>Agrega productos que te gusten y aparecerán aquí.</p><Link href="/store" className="button button-primary">Explorar productos <ArrowRight size={16} /></Link></div> : <div className="cart-layout"><div className="cart-items">{cart.map((item) => <div className="cart-item" key={item.id}><SafeImage src={item.image} alt={item.name} /><div className="cart-item-info"><span>{item.category}</span><h3>{item.name}</h3><strong>{formatQ(item.price)}</strong></div><div className="quantity"><button type="button" onClick={() => updateQuantity(item.id, item.quantity - 1)} aria-label="Restar"><Minus size={14} /></button><span>{item.quantity}</span><button type="button" onClick={() => updateQuantity(item.id, item.quantity + 1)} aria-label="Sumar"><Plus size={14} /></button></div><button type="button" className="icon-button danger" onClick={() => removeFromCart(item.id)} aria-label="Eliminar"><Trash2 size={17} /></button></div>)}</div><aside className="summary-card"><h2>Resumen del pedido</h2><div><span>Subtotal</span><strong>{formatQ(cartTotal)}</strong></div><div><span>Envío</span><strong className="free">Gratis</strong></div><div className="discount-code-box"><span><Tag size={14} /> Código de descuento</span><div><input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="NEXO10" aria-label="Código de descuento" /><button type="button" className="button button-outline" onClick={applyCode}>Aplicar</button></div>{message && <small role="status">{message}</small>}</div>{discount > 0 && <div><span>Descuento</span><strong>−{formatQ(discount)}</strong></div>}<div className="summary-total"><span>Total</span><strong>{formatQ(Math.max(0, cartTotal - discount))}</strong></div><button type="button" className="button button-primary full" onClick={() => router.push('/checkout')}>Continuar al checkout <ArrowRight size={16} /></button><small><ShieldCheck size={14} /> Compra segura y protegida</small></aside></div>}</main></PublicShell>;
}

async function compressImage(file: File) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Sube una imagen JPG, PNG o WEBP.');
  if (file.size > 5 * 1024 * 1024) throw new Error('La imagen debe pesar menos de 5 MB.');
  const source = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo leer la imagen.')); };
    image.src = url;
  });
  const scale = Math.min(1, 1280 / Math.max(source.width, source.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(source.width * scale));
  canvas.height = Math.max(1, Math.round(source.height * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('No se pudo preparar la imagen.');
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.72);
}

export function CheckoutExperience() {
  const { cart, cartLoaded, cartTotal, paymentMethods, user, removeFromCart } = useApp();
  const router = useRouter();
  const [payment, setPayment] = useState<PaymentMethod>('card');
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [receiptImage, setReceiptImage] = useState('');
  const [receiptFileName, setReceiptFileName] = useState('');
  const [discount, setDiscount] = useState(0);
  const [delivery, setDelivery] = useState({ name: user?.name || '', email: user?.email || '', phone: '', address: '', city: 'Ciudad de Guatemala', reference: '' });
  const availableMethods = (['card', 'transfer'] as const).filter((method) => paymentMethods[method]);
  useEffect(() => { if (!paymentMethods[payment]) setPayment(availableMethods[0] || 'card'); }, [paymentMethods, payment, availableMethods]);
  useEffect(() => {
    const code = readAppliedCode();
    if (code) validateDiscountCode(code, cartTotal).then((check) => setDiscount(check.valid ? Number(check.discount || 0) : 0)).catch(() => setDiscount(0));
  }, [cartTotal]);
  useEffect(() => { if (cartLoaded && !cart.length && !done) router.replace('/cart'); }, [cartLoaded, cart.length, done, router]);
  const updateDelivery = (field: keyof typeof delivery) => (event: ChangeEvent<HTMLInputElement>) => setDelivery((current) => ({ ...current, [field]: event.target.value }));
  const chooseReceipt = async (event: ChangeEvent<HTMLInputElement>) => {
    setError('');
    const file = event.target.files?.[0];
    if (!file) { setReceiptImage(''); setReceiptFileName(''); return; }
    try { setReceiptImage(await compressImage(file)); setReceiptFileName(file.name); } catch (issue) { setReceiptImage(''); setReceiptFileName(''); setError(issue instanceof Error ? issue.message : 'No se pudo cargar el comprobante.'); }
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError('');
    if (!delivery.name.trim() || !delivery.email.trim() || !delivery.phone.trim() || !delivery.address.trim() || !delivery.city.trim()) { setError('Completa tu nombre, correo, teléfono y dirección de entrega.'); return; }
    if (!paymentMethods[payment]) { setError('Este método ya no está disponible. Elige una opción activa.'); return; }
    if (payment === 'transfer' && !receiptImage) { setError('Adjunta el comprobante para continuar con transferencia.'); return; }
    const code = readAppliedCode();
    setSubmitting(true);
    try {
      const result = await checkoutService.create({
        customerName: delivery.name.trim(), customerEmail: delivery.email.trim(), customerPhone: delivery.phone.trim(),
        address: `${delivery.address.trim()}, ${delivery.city.trim()}${delivery.reference.trim() ? ` · ${delivery.reference.trim()}` : ''}`,
        paymentMethod: payment, items: cart.map((item) => ({ productId: item.id, quantity: item.quantity })),
        discountCode: code, receiptImage: payment === 'transfer' ? receiptImage : undefined,
        receiptFileName: payment === 'transfer' ? receiptFileName : undefined,
        receiptReference: payment === 'transfer' ? delivery.reference.trim() : undefined,
      });
      try {
        window.sessionStorage.setItem('nexo-confirmation-result', JSON.stringify({ paymentMethod: payment, paymentStatus: result.paymentStatus, orderId: result.reference, total: result.total }));
        window.sessionStorage.removeItem('nexo-applied-discount');
      } catch { /* El pedido demo sigue su curso aunque el navegador bloquee el almacenamiento de sesión. */ }
      setDone(true);
      cart.forEach((item) => removeFromCart(item.id));
      window.setTimeout(() => router.push('/confirmation'), 700);
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : 'No se pudo guardar el pedido. Verifica la conexión e inténtalo de nuevo.');
    } finally {
      setSubmitting(false);
    }
  };
  if (!cart.length) return null;
  if (done) return <div className="processing"><div className="loader" /><h2>Procesando tu pedido...</h2><p>Simulación de pago en curso; no se realizará ningún cobro.</p></div>;
  return <PublicShell><main className="checkout-page"><Link href="/cart" className="back-link"><ArrowLeft size={16} /> Volver al carrito</Link><div className="checkout-heading"><div><span className="eyebrow">Último paso</span><h1>Finaliza tu pedido</h1></div><div className="checkout-steps"><span className="done"><Check size={13} /> Carrito</span><i /><span className="current">2. Checkout</span><i /><span>3. Confirmación</span></div></div><form className="checkout-layout" onSubmit={submit}><div className="checkout-form"><section className="form-section"><div className="section-title"><span>01</span><div><h2>Información de entrega</h2><p>¿Dónde enviamos tu pedido?</p></div></div><div className="form-grid"><label className="form-field">Nombre completo<input required value={delivery.name} onChange={updateDelivery('name')} autoComplete="name" /></label><label className="form-field">Correo electrónico<input type="email" required value={delivery.email} onChange={updateDelivery('email')} autoComplete="email" /></label><label className="form-field">Teléfono<input required value={delivery.phone} onChange={updateDelivery('phone')} autoComplete="tel" /></label></div><label className="form-field">Dirección de entrega<input required value={delivery.address} onChange={updateDelivery('address')} autoComplete="street-address" /></label><div className="form-grid"><label className="form-field">Ciudad<input required value={delivery.city} onChange={updateDelivery('city')} autoComplete="address-level2" /></label><label className="form-field">Referencia (opcional)<input value={delivery.reference} onChange={updateDelivery('reference')} /></label></div></section><section className="form-section"><div className="section-title"><span>02</span><div><h2>Método de pago</h2><p>Opciones disponibles · solo demostración</p></div></div><div className="payment-options">{paymentMethods.card && <button type="button" className={payment === 'card' ? 'payment-option active' : 'payment-option'} onClick={() => setPayment('card')}><CreditCard size={19} /><span><strong>Tarjeta simulada</strong><small>No se solicitan datos de tarjeta</small></span><span className="radio" /></button>}{paymentMethods.transfer && <button type="button" className={payment === 'transfer' ? 'payment-option active' : 'payment-option'} onClick={() => setPayment('transfer')}><ArrowDownToLine size={19} /><span><strong>Transferencia bancaria</strong><small>Pendiente de verificación</small></span><span className="radio" /></button>}</div>{!availableMethods.length ? <div className="payment-error" role="alert">No hay métodos de pago activos. Contacta al administrador antes de continuar.</div> : payment === 'transfer' ? <div className="transfer-upload"><div className="transfer-hint"><Wallet size={18} /><p>El pedido quedará <strong>pendiente de verificación</strong>. Esta demostración no procesa transferencias reales.</p></div><label className="form-field">Comprobante de transferencia (JPG, PNG o WEBP, máximo 5 MB)<input type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseReceipt} />{receiptImage && <img className="receipt-preview" src={receiptImage} alt="Vista previa del comprobante" />}</label></div> : <div className="transfer-hint"><CreditCard size={18} /><p>Pago de tarjeta simulado. <strong>No se realiza ningún cargo y no guardamos información financiera.</strong></p></div>}{error && <div className="payment-error" role="alert">{error}</div>}</section></div><aside className="summary-card checkout-summary"><h2>Tu pedido</h2>{cart.map((item) => <div className="mini-line" key={item.id}><span>{item.quantity} × {item.name}</span><strong>{formatQ(item.price * item.quantity)}</strong></div>)}<div><span>Subtotal</span><strong>{formatQ(cartTotal)}</strong></div>{discount > 0 && <div><span>Descuento</span><strong>−{formatQ(discount)}</strong></div>}<div className="summary-total"><span>Total a pagar</span><strong>{formatQ(Math.max(0, cartTotal - discount))}</strong></div><button className="button button-primary full" type="submit" disabled={!availableMethods.length || submitting}>{submitting ? 'Procesando…' : 'Confirmar pedido'} <ArrowRight size={16} /></button><small><ShieldCheck size={14} /> Simulación únicamente. No se realizan cargos reales.</small></aside></form></main></PublicShell>;
}

export function ConfirmationExperience() {
  const [result, setResult] = useState<{ paymentMethod?: PaymentMethod; paymentStatus?: string; orderId?: string; total?: number } | null>(null);
  useEffect(() => {
    try {
      const saved = window.sessionStorage.getItem('nexo-confirmation-result');
      if (saved) setResult(JSON.parse(saved));
      else {
        const orderId = window.sessionStorage.getItem('nexo-last-order-id');
        const formattedTotal = window.sessionStorage.getItem('nexo-last-order-total');
        const total = formattedTotal ? Number(formattedTotal.replace(/[^\d,.-]/g, '').replace(/,/g, '')) : undefined;
        if (orderId || Number.isFinite(total)) setResult({ orderId: orderId?.replace(/^#/, ''), total });
        window.sessionStorage.removeItem('nexo-last-order-id');
        window.sessionStorage.removeItem('nexo-last-order-total');
      }
    } catch { setResult(null); }
  }, []);
  const transferPending = result?.paymentMethod === 'transfer' && result.paymentStatus === 'Pendiente de verificación';
  const status = transferPending ? 'Pendiente de verificación' : result?.paymentStatus === 'Simulada' ? 'Pago simulado' : 'Pedido registrado';
  return <PublicShell><main className="confirmation"><div className="success-icon"><Check size={34} /></div><span className="eyebrow">Pedido registrado</span><h1>{transferPending ? <>Pedido recibido<br /><em>pendiente.</em></> : <>Pedido<br /><em>confirmado.</em></>}</h1><p>{transferPending ? 'El pedido y el comprobante quedaron guardados para revisión. No se procesó ningún pago real.' : 'Tu pedido quedó guardado. El pago con tarjeta se simuló; no se realizó ningún cobro.'}</p><div className="confirmation-card"><div><span>Estado</span><strong>{status}</strong></div><div><span>Total del pedido</span><strong>{formatQ(result?.total ?? 0)}</strong></div><div><span>Referencia del pedido</span><strong>#{result?.orderId || 'NX-DEMO'}</strong></div></div><div className="landing-actions"><Link href="/store" className="button button-primary">Seguir comprando <ArrowRight size={16} /></Link></div></main></PublicShell>;
}
