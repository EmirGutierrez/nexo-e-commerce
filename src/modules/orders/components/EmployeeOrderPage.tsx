'use client';

import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { Check, Minus, Plus, Search, ShoppingCart, Trash2 } from 'lucide-react';
import { apiClient } from '../../../shared/services/http-client';
import { productService } from '../../products/services/productService';
import { paymentSettingsService } from '../../../services';
import { formatQ } from '../../../data/mockData';
import { useApp } from '../../../contexts/AppContext';
import type { PaymentMethod, PaymentMethodSettings, Product } from '../../../types';

type CartLine = { product: Product; quantity: number };
type StaffOrderResult = { id: string; data?: { orderNumber?: string; total?: number } };

async function compressReceipt(file: File): Promise<string> {
  const image = await createImageBitmap(file);
  try {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('No se pudo preparar el comprobante.');
    const scale = Math.min(1, 1400 / Math.max(image.width, image.height));
    canvas.width = Math.max(1, Math.round(image.width * scale)); canvas.height = Math.max(1, Math.round(image.height * scale));
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.82, 0.68, 0.52]) {
      const encoded = canvas.toDataURL('image/jpeg', quality);
      if (encoded.length < 1_350_000) return encoded;
    }
  } finally { image.close(); }
  throw new Error('El comprobante pesa demasiado. Elige una foto más pequeña.');
}

export default function EmployeeOrderPage() {
  const { user } = useApp();
  const [catalog, setCatalog] = useState<Product[]>([]);
  const [payments, setPayments] = useState<PaymentMethodSettings>({ card: false, transfer: false });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [payment, setPayment] = useState<PaymentMethod>('card');
  const [receiptImage, setReceiptImage] = useState('');
  const [receiptName, setReceiptName] = useState('');
  const [customer, setCustomer] = useState({ name: user?.name || '', email: user?.email || '', phone: '', address: '' });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => { setCustomer((current) => ({ ...current, name: current.name || user?.name || '', email: current.email || user?.email || '' })); }, [user?.name, user?.email]);
  useEffect(() => {
    let active = true;
    Promise.all([productService.list(), paymentSettingsService.load()]).then(([result, methods]) => {
      if (!active) return;
      setCatalog(result.products.filter((product) => product.stock > 0 && product.status !== 'Inactivo'));
      setPayments(methods);
      setPayment(methods.card ? 'card' : 'transfer');
    }).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'No se pudo cargar el catálogo.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const methods = (['card', 'transfer'] as const).filter((method) => payments[method]);
  const visible = useMemo(() => catalog.filter((product) => `${product.name} ${product.sku} ${product.category}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())), [catalog, search]);
  const subtotal = cart.reduce((total, line) => total + line.product.price * line.quantity, 0);

  const add = (product: Product) => setCart((current) => {
    const match = current.find((line) => line.product.id === product.id);
    if (match) return current.map((line) => line.product.id === product.id && line.quantity < product.stock ? { ...line, quantity: line.quantity + 1 } : line);
    return [...current, { product, quantity: 1 }];
  });
  const change = (id: string, delta: number) => setCart((current) => current.flatMap((line) => {
    if (line.product.id !== id) return [line];
    const quantity = line.quantity + delta;
    if (quantity < 1) return [];
    if (quantity > line.product.stock) return [line];
    return [{ ...line, quantity }];
  }));

  const chooseReceipt = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.currentTarget.value = '';
    if (!file) return;
    try { setReceiptImage(await compressReceipt(file)); setReceiptName(file.name); setError(''); }
    catch (cause) { setReceiptImage(''); setReceiptName(''); setError(cause instanceof Error ? cause.message : 'No se pudo preparar el comprobante.'); }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError(''); setNotice('');
    if (!cart.length) { setError('Agrega al menos un producto al pedido.'); return; }
    if (!methods.includes(payment)) { setError('No hay una forma de pago activa. Contacta a la persona administradora.'); return; }
    if (payment === 'transfer' && !receiptImage) { setError('Adjunta el comprobante para registrar la transferencia.'); return; }
    setBusy(true);
    try {
      const result = await apiClient.post<StaffOrderResult>('/api/business/orders', {
        customerName: customer.name.trim(), customerEmail: customer.email.trim(), customerPhone: customer.phone.trim(), address: customer.address.trim(),
        paymentMethod: payment, items: cart.map(({ product, quantity }) => ({ productId: product.id, quantity })),
        receiptImage, receiptFileName: receiptName, receiptReference: '',
      });
      const ref = result.data?.orderNumber || result.id.slice(0, 8).toUpperCase();
      setNotice(`Pedido ${ref} creado. El inventario y el catálogo ya están actualizados para todo el equipo.`);
      setCart([]); setReceiptImage(''); setReceiptName('');
      const refreshed = await productService.list();
      setCatalog(refreshed.products.filter((product) => product.stock > 0 && product.status !== 'Inactivo'));
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo guardar el pedido. Revisa los datos e inténtalo de nuevo.'); }
    finally { setBusy(false); }
  };

  return <div className="module-page employee-order-page">
    <div className="admin-page-heading"><div><span className="eyebrow">Espacio del personal · Pedido compartido</span><h1>Comprar productos</h1><p>Explora los artículos disponibles, agrégalos al pedido y confirma los datos de entrega.</p></div><div className="employee-cart-total"><ShoppingCart size={18} /><strong>{cart.reduce((count, line) => count + line.quantity, 0)}</strong><span>artículos</span></div></div>
    {notice ? <div className="crud-feedback" role="status">{notice}</div> : null}
    {error ? <div className="crud-error" role="alert">{error}</div> : null}
    <form className="employee-order-layout" onSubmit={submit}>
      <section className="panel employee-catalog-panel"><div className="panel-heading"><div><h2>Productos disponibles</h2><span>{catalog.length} artículos con existencias</span></div></div>
        <label className="search-box admin-search"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nombre, SKU o categoría" /></label>
        {loading ? <div className="empty-state">Cargando catálogo compartido…</div> : visible.length ? <div className="employee-product-grid">{visible.map((product) => {
          const quantity = cart.find((line) => line.product.id === product.id)?.quantity || 0;
          return <article className="employee-product-card" key={product.id}><img src={product.image} alt={product.name} /><div className="employee-product-copy"><small>{product.category} · {product.sku}</small><h3>{product.name}</h3><strong>{formatQ(product.price)}</strong><span>{product.stock - quantity} disponibles</span></div>
            <button className="button button-primary employee-add-button" type="button" disabled={quantity >= product.stock} onClick={() => add(product)}><Plus size={15} /> Agregar</button></article>;
        })}</div> : <div className="empty-state"><h3>{search ? 'No hay resultados' : 'No hay productos disponibles'}</h3><p>{search ? 'Prueba con otra búsqueda.' : 'El catálogo no tiene existencias actualmente.'}</p></div>}
      </section>
      <aside className="panel employee-order-summary"><h2>Tu pedido</h2>{cart.length ? <div className="employee-cart-lines">{cart.map(({ product, quantity }) => <div className="employee-cart-line" key={product.id}><img src={product.image} alt="" /><div><strong>{product.name}</strong><small>{formatQ(product.price)} por unidad</small><div className="employee-quantity"><button type="button" aria-label={`Quitar una unidad de ${product.name}`} onClick={() => change(product.id, -1)}><Minus size={12} /></button><span>{quantity}</span><button type="button" aria-label={`Agregar una unidad de ${product.name}`} onClick={() => change(product.id, 1)} disabled={quantity >= product.stock}><Plus size={12} /></button><button type="button" aria-label={`Eliminar ${product.name}`} onClick={() => setCart((current) => current.filter((line) => line.product.id !== product.id))}><Trash2 size={13} /></button></div></div><b>{formatQ(product.price * quantity)}</b></div>)}</div> : <p className="employee-order-empty">Agrega productos del catálogo para comenzar.</p>}
        <div className="employee-order-subtotal"><span>Subtotal</span><strong>{formatQ(subtotal)}</strong></div>
        <label className="form-field">Nombre de quien recibe<input required maxLength={160} value={customer.name} onChange={(event) => setCustomer({ ...customer, name: event.target.value })} /></label>
        <label className="form-field">Correo electrónico<input type="email" required value={customer.email} onChange={(event) => setCustomer({ ...customer, email: event.target.value })} /></label>
        <label className="form-field">Teléfono<input value={customer.phone} onChange={(event) => setCustomer({ ...customer, phone: event.target.value })} /></label>
        <label className="form-field">Dirección de entrega<textarea required maxLength={500} rows={2} value={customer.address} onChange={(event) => setCustomer({ ...customer, address: event.target.value })} /></label>
        <div className="employee-payment-choices"><strong>Forma de pago</strong>{methods.map((method) => <label key={method}><input type="radio" name="staff-payment" checked={payment === method} onChange={() => setPayment(method)} /><span>{method === 'card' ? 'Tarjeta simulada' : 'Transferencia'}</span></label>)}</div>
        {payment === 'transfer' ? <label className="form-field">Comprobante (JPG, PNG o WEBP)<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void chooseReceipt(event)} />{receiptImage ? <small>{receiptName} listo para guardar.</small> : null}</label> : <small className="employee-payment-note">El pago con tarjeta es simulado; no se solicita información financiera.</small>}
        <button className="button button-primary full" type="submit" disabled={busy || loading || !methods.length || !cart.length}>{busy ? 'Guardando pedido…' : 'Confirmar pedido'}</button>
      </aside>
    </form>
  </div>;
}
