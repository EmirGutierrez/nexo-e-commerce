'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Banknote, Barcode, Check, ChevronDown, CreditCard, Minus, Plus, Printer, Search, ShoppingBag, Trash2, UserRound, X } from 'lucide-react';
import { formatQ } from '../../../data/mockData';
import { productInventoryService } from '../../../services';
import { useApp } from '../../../contexts/AppContext';
import { roleService } from '../../../services/roleService';
import type { Product } from '../../../types';

type PosItem = { productId: string; name: string; sku: string; unitPrice: number; quantity: number; stock: number; image: string };
type LocalSale = {
  id: string;
  date: string;
  seller: string;
  customerName: string;
  nit: string;
  paymentMethod: 'cash' | 'card';
  total: number;
  amountReceived?: number;
  change?: number;
  items: PosItem[];
};
const sessionSalesKey = 'nexo.pos.sales.v1';
const MAX_RESULTS = 8;

export default function SalesPage() {
  const { user, role, paymentMethods } = useApp();
  const canCreateSale = Boolean(role && roleService.can(role, 'sales', 'create'));
  const [catalog, setCatalog] = useState<Product[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState('');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<PosItem[]>([]);
  const [stage, setStage] = useState<'sale' | 'checkout'>('sale');
  const [customerName, setCustomerName] = useState('');
  const [nit, setNit] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card'>('cash');
  const [amountReceived, setAmountReceived] = useState('');
  const [checkoutError, setCheckoutError] = useState('');
  const [receipt, setReceipt] = useState<LocalSale | null>(null);
  const [localSales, setLocalSales] = useState<LocalSale[]>([]);
  const [sessionSalesLoaded, setSessionSalesLoaded] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [saving, setSaving] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const nitRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    productInventoryService.list()
      .then((rows) => { if (active) setCatalog(rows); })
      .catch((cause) => { if (active) setCatalogError(cause instanceof Error ? cause.message : 'No se pudo cargar el catálogo.'); })
      .finally(() => { if (active) setCatalogLoading(false); });
    try {
      const saved = sessionStorage.getItem(sessionSalesKey);
      const parsed: unknown = saved ? JSON.parse(saved) : [];
      if (active && Array.isArray(parsed)) setLocalSales(parsed as LocalSale[]);
    } catch {
      if (active) setHistoryError('No se pudieron recuperar las ventas temporales de esta pestaña.');
    } finally {
      if (active) setSessionSalesLoaded(true);
    }
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!sessionSalesLoaded) return;
    try { sessionStorage.setItem(sessionSalesKey, JSON.stringify(localSales)); }
    catch { setHistoryError('No se pudo guardar la venta temporal en esta pestaña.'); }
  }, [localSales, sessionSalesLoaded]);

  useEffect(() => {
    if (stage === 'sale' && canCreateSale) searchRef.current?.focus();
    if (stage === 'checkout') nitRef.current?.focus();
  }, [stage, canCreateSale]);

  useEffect(() => {
    if (!receipt) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setReceipt(null); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [receipt]);

  const availableProducts = useMemo(() => {
    const sold = new Map<string, number>();
    localSales.forEach((sale) => sale.items.forEach((item) => sold.set(item.productId, (sold.get(item.productId) || 0) + item.quantity)));
    return catalog.map((product) => {
      const stock = Math.max(0, product.stock - (sold.get(product.id) || 0));
      return { ...product, stock, status: stock === 0 && product.status !== 'Inactivo' ? 'Agotado' as const : stock < 10 && product.status !== 'Inactivo' ? 'Bajo stock' as const : product.status };
    }).filter((product) => product.status !== 'Inactivo' && product.stock > 0);
  }, [catalog, localSales]);
  const filteredProducts = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('es-GT');
    if (!query) return availableProducts.slice(0, MAX_RESULTS);
    return availableProducts.filter((product) => [product.sku, product.name, product.category].some((value) => value.toLocaleLowerCase('es-GT').includes(query))).slice(0, MAX_RESULTS);
  }, [availableProducts, search]);
  const total = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const paid = Number(amountReceived);
  const change = Math.max(0, paid - total);
  const exactMatch = useMemo(() => {
    const code = search.trim().toLocaleUpperCase('es-GT');
    return code ? availableProducts.find((product) => product.sku.trim().toLocaleUpperCase('es-GT') === code) : undefined;
  }, [availableProducts, search]);
  const saleHistory = useMemo(() => localSales.map((sale) => ({
    ...sale,
    local: true as const,
    paymentLabel: sale.paymentMethod === 'cash' ? 'Efectivo' : 'Tarjeta',
  })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()), [localSales]);

  const addProduct = useCallback((product: Product) => {
    if (product.status === 'Inactivo' || product.stock < 1) return;
    setCart((current) => {
      const existing = current.find((item) => item.productId === product.id);
      if (existing) return current.map((item) => item.productId === product.id && item.quantity < product.stock ? { ...item, quantity: item.quantity + 1, stock: product.stock } : item);
      return [...current, { productId: product.id, name: product.name, sku: product.sku, unitPrice: product.price, quantity: 1, stock: product.stock, image: product.image }];
    });
    setSearch('');
    setCheckoutError('');
    searchRef.current?.focus();
  }, []);

  const submitProductSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (exactMatch) { addProduct(exactMatch); return; }
    if (filteredProducts.length === 1) { addProduct(filteredProducts[0]); return; }
    if (!filteredProducts.length) setCatalogError('No encontramos un producto disponible con ese código o búsqueda.');
  };

  const setQuantity = (productId: string, requested: number) => {
    setCart((current) => current.flatMap((item) => {
      if (item.productId !== productId) return [item];
      const quantity = Math.min(item.stock, Math.max(0, Math.floor(requested)));
      return quantity ? [{ ...item, quantity }] : [];
    }));
  };

  const openCheckout = () => {
    if (!cart.length) return;
    setCheckoutError('');
    setAmountReceived('');
    setStage('checkout');
  };

  const validateCheckout = () => {
    const cleanNit = nit.trim().toLocaleUpperCase('es-GT');
    if (cleanNit.length < 2 || cleanNit.length > 20 || !/^[A-Z0-9-]+$/.test(cleanNit)) return 'Ingresa un NIT válido (letras, números o guion).';
    if (paymentMethod === 'card' && !paymentMethods.card) return 'El pago con tarjeta está desactivado en la configuración.';
    if (paymentMethod === 'cash' && (!Number.isFinite(paid) || paid < total)) return 'El monto recibido debe cubrir el total de la venta.';
    for (const item of cart) {
      const current = availableProducts.find((product) => product.id === item.productId);
      if (!current || current.status === 'Inactivo' || item.quantity > current.stock) return `No hay existencias suficientes de ${item.name}. Actualiza el carrito.`;
    }
    return '';
  };

  const completeSale = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const error = validateCheckout();
    if (error) { setCheckoutError(error); return; }
    setSaving(true);
    const sale: LocalSale = {
      id: `POS-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`,
      date: new Date().toISOString(),
      seller: user?.name || 'Personal',
      customerName: customerName.trim() || 'Cliente',
      nit: nit.trim().toLocaleUpperCase('es-GT'),
      paymentMethod,
      total,
      ...(paymentMethod === 'cash' ? { amountReceived: paid, change } : {}),
      items: cart.map((item) => ({ ...item })),
    };
    setLocalSales((current) => [sale, ...current]);
    setReceipt(sale);
    setCart([]);
    setStage('sale');
    setCustomerName(''); setNit(''); setPaymentMethod('cash'); setAmountReceived(''); setSearch(''); setCheckoutError('');
    setSaving(false);
  };

  const closeReceipt = () => { setReceipt(null); window.setTimeout(() => searchRef.current?.focus(), 0); };
  const changePaymentMethod = (method: 'cash' | 'card') => { setPaymentMethod(method); setCheckoutError(''); };

  if (!canCreateSale) return <div className="module-page"><div className="admin-page-heading"><div><span className="eyebrow">Punto de venta</span><h1>Ventas</h1><p>Tu rol no tiene permiso para registrar ventas presenciales.</p></div></div></div>;

  return <div className="sales-page pos-page">
    <div className="admin-page-heading pos-heading"><div><span className="eyebrow"><ShoppingBag size={14} /> Punto de venta</span><h1>Nueva venta</h1><p>Busca por código o nombre, agrega productos y cobra en mostrador.</p></div><div className="pos-seller"><span>Atiende</span><strong>{user?.name || 'Personal'}</strong></div></div>
    <div className="pos-demo-notice" role="note"><span className="pos-demo-dot" /><p><strong>Modo de demostración:</strong> estas ventas y existencias son temporales en esta pestaña. No se envían a PostgreSQL ni se procesa ningún cobro.</p></div>
    <div className="pos-layout">
      <section className="pos-catalog panel" aria-label="Buscar productos">
        <div className="pos-section-heading"><div><span className="eyebrow">Catálogo</span><h2>Agrega productos</h2><p>Escanea el SKU o escribe el nombre del producto.</p></div><span className="pos-product-count">{availableProducts.length} disponibles</span></div>
        <form className="pos-search-form" onSubmit={submitProductSearch} role="search"><Barcode size={20} aria-hidden="true" /><label className="sr-only" htmlFor="pos-product-search">Código SKU o nombre del producto</label><input id="pos-product-search" ref={searchRef} value={search} onChange={(event) => { setSearch(event.target.value); setCatalogError(''); }} placeholder="Escanea un código o busca un producto…" autoComplete="off" /><button type="submit" aria-label="Agregar producto buscado"><Plus size={18} /><span>Agregar</span></button></form>
        <div className="pos-search-hint"><span>Usa el lector de código y presiona Enter</span><kbd>↵</kbd></div>
        {catalogError && <div className="sale-form-error" role="alert">{catalogError}</div>}
        {catalogLoading ? <div className="pos-catalog-state">Cargando catálogo…</div> : filteredProducts.length ? <div className="pos-product-results" aria-live="polite">{filteredProducts.map((product) => {
          const inCart = cart.find((item) => item.productId === product.id)?.quantity || 0;
          return <button type="button" className="pos-product-option" key={product.id} onClick={() => addProduct(product)} aria-label={`Agregar ${product.name}, ${formatQ(product.price)}, SKU ${product.sku}`}>
            <span className="pos-product-thumb">{product.image ? <img src={product.image} alt="" loading="lazy" /> : <ShoppingBag size={17} />}</span><span className="pos-product-description"><strong>{product.name}</strong><small>SKU {product.sku} · {product.stock} disponibles</small></span><span className="pos-product-price">{formatQ(product.price)}</span>{inCart > 0 ? <span className="pos-product-in-cart">{inCart} en cuenta</span> : <span className="pos-product-add"><Plus size={17} /></span>}
          </button>;
        })}</div> : <div className="pos-catalog-state"><Search size={21} /><strong>{search ? 'Sin resultados' : 'Catálogo vacío'}</strong><span>{search ? 'Prueba otro código o término de búsqueda.' : 'No hay productos disponibles para vender.'}</span></div>}
      </section>

      <aside className="pos-ticket panel" aria-label="Cuenta de la venta">
        <div className="pos-ticket-heading"><div><span className="eyebrow">Cuenta actual</span><h2>Detalle de venta</h2></div><span className="pos-ticket-count">{cart.reduce((sum, item) => sum + item.quantity, 0)} uds.</span></div>
        {cart.length ? <div className="pos-cart-list">{cart.map((item) => <article className="pos-cart-item" key={item.productId}>
          <div className="pos-cart-item-top"><div><strong>{item.name}</strong><small>SKU {item.sku} · {formatQ(item.unitPrice)} c/u</small></div><button type="button" className="pos-remove-item" aria-label={`Eliminar ${item.name} de la cuenta`} title="Eliminar producto" onClick={() => setQuantity(item.productId, 0)}><Trash2 size={16} /></button></div>
          <div className="pos-cart-item-bottom"><div className="pos-quantity-control"><button type="button" aria-label={`Restar una unidad de ${item.name}`} disabled={item.quantity <= 1} onClick={() => setQuantity(item.productId, item.quantity - 1)}><Minus size={13} /></button><label><span className="sr-only">Cantidad de {item.name}</span><input type="number" min="1" max={item.stock} step="1" value={item.quantity} onChange={(event) => setQuantity(item.productId, Number(event.target.value))} /></label><button type="button" aria-label={`Agregar una unidad de ${item.name}`} disabled={item.quantity >= item.stock} onClick={() => setQuantity(item.productId, item.quantity + 1)}><Plus size={13} /></button></div><strong>{formatQ(item.unitPrice * item.quantity)}</strong></div>
        </article>)}</div> : <div className="pos-cart-empty"><span><ShoppingBag size={22} /></span><strong>Tu cuenta está vacía</strong><p>Escanea o busca un producto para comenzar la venta.</p></div>}
        <div className="pos-total-row"><span>Total</span><strong>{formatQ(total)}</strong></div>
        {stage === 'sale' ? <button type="button" className="button button-primary pos-checkout-button" disabled={!cart.length} onClick={openCheckout}>Continuar al cobro <ChevronDown size={17} /></button> : <form className="pos-checkout" onSubmit={completeSale} noValidate>
          <div className="pos-checkout-title"><div><span className="eyebrow">Finalizar venta</span><h3>Datos del cliente</h3></div><button type="button" className="pos-back-button" onClick={() => { setStage('sale'); setCheckoutError(''); }} aria-label="Volver a la cuenta"><X size={16} /></button></div>
          <label className="pos-field"><span><UserRound size={14} /> Nombre del cliente <small>Opcional</small></span><input value={customerName} onChange={(event) => setCustomerName(event.target.value)} maxLength={120} placeholder="Nombre para el comprobante" /></label>
          <label className="pos-field"><span>NIT <b>Requerido</b></span><input ref={nitRef} value={nit} onChange={(event) => setNit(event.target.value.toLocaleUpperCase('es-GT'))} maxLength={20} autoCapitalize="characters" placeholder="Ej. 1234567-8 o CF" /></label>
          <fieldset className="pos-payment-options"><legend>Método de pago</legend><div className="pos-payment-choice-row">
            <button type="button" className={paymentMethod === 'cash' ? 'pos-payment-choice selected' : 'pos-payment-choice'} onClick={() => changePaymentMethod('cash')} aria-pressed={paymentMethod === 'cash'}><Banknote size={18} /><span><strong>Efectivo</strong><small>Calcula el cambio</small></span></button>
            <button type="button" className={paymentMethod === 'card' ? 'pos-payment-choice selected' : 'pos-payment-choice'} onClick={() => changePaymentMethod('card')} aria-pressed={paymentMethod === 'card'} disabled={!paymentMethods.card}><CreditCard size={18} /><span><strong>Tarjeta</strong><small>{paymentMethods.card ? 'Pago simulado' : 'Desactivada'}</small></span></button>
          </div></fieldset>
          {paymentMethod === 'cash' ? <><label className="pos-field"><span>Efectivo recibido</span><div className="pos-money-input"><span>Q</span><input type="number" min={total} step="0.01" inputMode="decimal" value={amountReceived} onChange={(event) => { setAmountReceived(event.target.value); setCheckoutError(''); }} placeholder="0.00" /></div></label><div className="pos-change-row"><span>Cambio</span><strong className={paid >= total && paid > 0 ? 'ready' : ''}>{formatQ(change)}</strong></div></> : <div className="pos-card-note">El pago se simula para esta demostración. No se pedirán datos de tarjeta ni se realizará un cargo.</div>}
          {checkoutError && <div className="sale-form-error" role="alert">{checkoutError}</div>}
          <button type="submit" className="button button-primary pos-complete-button" disabled={saving}>{saving ? 'Registrando…' : 'Registrar venta y comprobante'} <Check size={16} /></button>
        </form>}
        <p className="pos-ticket-footnote">Verifica cantidades y existencias antes de confirmar.</p>
      </aside>
    </div>

    <section className="panel pos-history"><div className="pos-section-heading"><div><span className="eyebrow">Actividad reciente</span><h2>Ventas de esta sesión</h2><p>Comprobantes temporales creados en esta pestaña.</p></div><span className="pos-product-count">{saleHistory.length} registros</span></div>
      {historyError && <p className="pos-history-note" role="status">{historyError}</p>}
      {saleHistory.length ? <div className="pos-history-scroll"><table className="pos-history-table"><thead><tr><th>Folio</th><th>Fecha</th><th>Cliente / NIT</th><th>Pago</th><th>Total</th><th><span className="sr-only">Comprobante</span></th></tr></thead><tbody>{saleHistory.slice(0, 20).map((sale) => <tr key={sale.id}><td><strong>{sale.id}</strong>{sale.local && <small className="pos-session-tag">Esta sesión</small>}</td><td>{new Date(sale.date).toLocaleString('es-GT', { dateStyle: 'short', timeStyle: 'short' })}</td><td>{sale.nit ? <>{sale.customerName || 'Cliente'}<small>{sale.nit}</small></> : '—'}</td><td>{sale.paymentLabel}</td><td><strong>{formatQ(sale.total)}</strong></td><td>{sale.local && <button type="button" className="pos-view-receipt" onClick={() => setReceipt(sale as LocalSale)} aria-label={`Abrir comprobante ${sale.id}`}><Printer size={16} /> Ver</button>}</td></tr>)}</tbody></table></div> : <div className="pos-history-empty">Las ventas que registres en esta pestaña aparecerán aquí.</div>}
    </section>

    {receipt && <div className="modal-backdrop pos-receipt-backdrop" onClick={closeReceipt}><section className="modal sale-receipt-modal pos-receipt-modal" role="dialog" aria-modal="true" aria-labelledby="pos-receipt-title" onClick={(event) => event.stopPropagation()}><div className="modal-header receipt-modal-header"><div><span className="eyebrow">Comprobante digital de venta</span><h2 id="pos-receipt-title">{receipt.id}</h2></div><div className="receipt-actions"><button type="button" className="button button-outline" onClick={() => window.print()}><Printer size={15} /> Imprimir</button><button type="button" className="icon-button" aria-label="Cerrar comprobante" onClick={closeReceipt}><X size={18} /></button></div></div><PosReceipt sale={receipt} /></section></div>}
  </div>;
}

function PosReceipt({ sale }: { sale: LocalSale }) {
  return <div className="sale-receipt-print pos-receipt-print"><div className="receipt-brand"><span className="brand-mark"><span /></span><strong>NEXO</strong></div><p className="receipt-kind">COMPROBANTE DE VENTA PRESENCIAL</p><div className="receipt-not-tax">Comprobante generado por la interfaz de demostración. No es factura FEL ni comprobante fiscal autorizado.</div><dl className="receipt-meta"><div><dt>Folio</dt><dd>{sale.id}</dd></div><div><dt>Fecha</dt><dd>{new Date(sale.date).toLocaleString('es-GT')}</dd></div><div><dt>Cliente</dt><dd>{sale.customerName}</dd></div><div><dt>NIT</dt><dd>{sale.nit}</dd></div><div><dt>Vendedor</dt><dd>{sale.seller}</dd></div><div><dt>Pago</dt><dd>{sale.paymentMethod === 'cash' ? 'Efectivo' : 'Tarjeta simulada'}</dd></div></dl><div className="receipt-lines"><div className="receipt-line receipt-table-head"><span>Producto</span><span>Cant.</span><span>Precio</span><span>Subtotal</span></div>{sale.items.map((item) => <div className="receipt-line" key={item.productId}><span>{item.name}<small>SKU {item.sku}</small></span><span>{item.quantity}</span><span>{formatQ(item.unitPrice)}</span><strong>{formatQ(item.unitPrice * item.quantity)}</strong></div>)}</div><div className="receipt-total"><span>Total</span><strong>{formatQ(sale.total)}</strong></div>{sale.paymentMethod === 'cash' && <div className="pos-receipt-cash"><div><span>Efectivo recibido</span><strong>{formatQ(sale.amountReceived || 0)}</strong></div><div><span>Cambio</span><strong>{formatQ(sale.change || 0)}</strong></div></div>}<p className="receipt-thanks">Gracias por tu compra.</p></div>;
}
