'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, ArrowLeft, Check, CheckCircle2, Clock3, CreditCard, MapPin, Package, PackageCheck, Tag, UserRound } from 'lucide-react';
import { formatQ } from '../../../data/mockData';
import { useApp } from '../../../contexts/AppContext';
import { customerPortalService, type CustomerOrder } from '../../../services';
import { fetchCatalogFromApi } from '../../products/services/productService';

const orderSteps = [
  { label: 'Pedido recibido', detail: 'Confirmamos los artículos y la solicitud.' },
  { label: 'Pago', detail: 'Estado del pago asociado al pedido.' },
  { label: 'En preparación', detail: 'El negocio está preparando los productos.' },
  { label: 'Completado', detail: 'El proceso del pedido fue completado.' },
];

const dateLabel = (value?: string, fallback?: string) => {
  const date = value || fallback;
  if (!date) return 'Fecha no disponible';
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? 'Fecha no disponible' : new Intl.DateTimeFormat('es-GT', { dateStyle: 'long', timeStyle: 'short' }).format(parsed);
};

const amount = (value?: number) => Number.isFinite(Number(value)) ? formatQ(Number(value)) : '—';
const normalized = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export default function CustomerOrderDetailPage({ orderId }: { orderId: string }) {
  const { user, userType, authLoading } = useApp();
  const [order, setOrder] = useState<CustomerOrder | null>(null);
  const [images, setImages] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (authLoading || !user || userType !== 'customer') return;
    let active = true;
    setLoading(true); setError(''); setOrder(null); setImages({});
    Promise.all([
      customerPortalService.orders(),
      fetchCatalogFromApi().catch(() => null),
    ]).then(([orders, catalog]) => {
      if (!active) return;
      const selected = orders.find((item) => item.id === orderId);
      if (!selected) {
        setError('No encontramos ese pedido en tu historial.');
        return;
      }
      setOrder(selected);
      if (catalog) setImages(Object.fromEntries(catalog.products.map((product) => [product.id, product.image]).filter(([, image]) => Boolean(image))));
    }).catch((issue) => {
      if (active) setError(issue instanceof Error ? issue.message : 'No se pudo cargar el detalle del pedido.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [authLoading, orderId, user, userType]);

  if (authLoading) return <main className="customer-account"><p role="status">Comprobando sesión…</p></main>;
  if (!user || userType !== 'customer') return <main className="customer-account customer-account-locked"><UserRound size={30} /><h1>Inicia sesión para ver este pedido</h1><p>Los detalles de tus compras están disponibles desde tu cuenta.</p><Link className="button button-primary" href="/access">Ingresar a mi cuenta</Link></main>;

  if (loading) return <main className="customer-account"><Link className="back-link" href="/account?section=orders"><ArrowLeft size={16} /> Volver a mis compras</Link><div className="customer-order-detail-state" role="status"><span className="customer-order-spinner" /> Cargando detalle del pedido…</div></main>;
  if (error || !order) return <main className="customer-account"><Link className="back-link" href="/account?section=orders"><ArrowLeft size={16} /> Volver a mis compras</Link><div className="customer-order-detail-error" role="alert"><AlertCircle size={22} /><div><strong>No se pudo mostrar el pedido</strong><p>{error || 'Intenta volver a cargar el historial.'}</p><Link className="text-link" href="/account?section=orders">Volver al historial</Link></div></div></main>;

  const data = order.data;
  const status = data.status || 'Pendiente de pago';
  const statusKey = normalized(status);
  const isCancelled = statusKey.includes('cancel');
  const isComplete = statusKey.includes('complet');
  const isPreparing = statusKey.includes('prepar');
  const activeStep = isComplete ? orderSteps.length : isPreparing ? 2 : 1;
  const items = data.items || [];
  const calculatedSubtotal = items.reduce((sum, item) => sum + Number(item.subtotal ?? (Number(item.unitPrice || 0) * Number(item.quantity || 0))), 0);
  const subtotal = Number.isFinite(Number(data.subtotal)) ? Number(data.subtotal) : calculatedSubtotal;
  const discount = Number(data.discountAmount || 0);
  const paymentMethod = data.payment || (data.paymentMethod === 'transfer' ? 'Transferencia bancaria' : data.paymentMethod === 'card' ? 'Tarjeta simulada' : 'No especificado');

  return <main className="customer-account customer-order-detail">
    <Link className="back-link" href="/account?section=orders"><ArrowLeft size={16} /> Volver a mis compras</Link>
    <header className="customer-order-detail-heading"><div><span className="eyebrow">Detalle del pedido</span><h1>{data.orderNumber || `NX-${order.id.slice(0, 8).toUpperCase()}`}</h1><p>Realizado el {dateLabel(data.date, order.createdAt)}</p></div><span className={`customer-detail-status ${isCancelled ? 'cancelled' : isComplete ? 'complete' : isPreparing ? 'progress' : 'waiting'}`}><i />{status}</span></header>

    {isCancelled ? <div className="customer-order-cancelled" role="status"><AlertCircle size={19} /><span>Este pedido fue cancelado. La línea de tiempo muestra hasta dónde se encuentra disponible información del proceso.</span></div> : <section className="customer-panel customer-order-progress"><div className="customer-detail-section-title"><span className="account-icon"><PackageCheck size={19} /></span><div><span className="eyebrow">Seguimiento</span><h2>Estado del pedido</h2></div></div><ol className="customer-order-timeline" aria-label="Progreso del pedido">{orderSteps.map((step, index) => { const done = isComplete || index < activeStep || (isCancelled && index === 0); const current = !isComplete && !isCancelled && index === activeStep; return <li key={step.label} className={done ? 'complete' : current ? 'current' : 'upcoming'} aria-current={current ? 'step' : undefined}><span className="customer-timeline-marker">{done ? <Check size={14} /> : current ? <Clock3 size={14} /> : index + 1}</span><div><strong>{step.label}</strong><small>{current && index === 1 ? data.paymentStatus || 'Pendiente de actualización' : step.detail}</small></div></li>; })}</ol></section>}

    <div className="customer-order-detail-grid">
      <section className="customer-panel customer-order-lines"><div className="customer-detail-section-title"><span className="account-icon"><Package size={19} /></span><div><span className="eyebrow">Artículos</span><h2>Productos comprados</h2></div><strong className="customer-count">{items.reduce((sum, item) => sum + Number(item.quantity || 0), 0)}</strong></div>
        {items.length ? <div className="customer-order-items">{items.map((item, index) => <article className="customer-order-item" key={`${item.productId || item.sku || item.productName}-${index}`}><div className="customer-order-item-image">{item.productId && images[item.productId] ? <img src={images[item.productId]} alt={item.productName || 'Producto del pedido'} /> : <Package size={23} aria-hidden="true" />}</div><div className="customer-order-item-name"><strong>{item.productName || 'Producto'}</strong><span>{item.sku ? `SKU ${item.sku}` : 'Código no disponible'}</span></div><div className="customer-order-item-unit"><span>Precio unitario</span><strong>{amount(item.unitPrice)}</strong></div><div className="customer-order-item-quantity"><span>Cantidad</span><strong>{Number(item.quantity || 0)}</strong></div><div className="customer-order-item-subtotal"><span>Total</span><strong>{amount(item.subtotal ?? Number(item.unitPrice || 0) * Number(item.quantity || 0))}</strong></div></article>)}</div> : <p className="customer-order-no-items">El pedido no incluye el detalle de sus artículos.</p>}
      </section>

      <aside className="customer-order-summary-column">
        <section className="customer-panel customer-order-summary"><div className="customer-detail-section-title"><span className="account-icon"><Tag size={19} /></span><div><span className="eyebrow">Importes</span><h2>Resumen de compra</h2></div></div><dl className="customer-order-totals"><div><dt>Subtotal</dt><dd>{amount(subtotal)}</dd></div>{discount > 0 && <div className="customer-order-discount"><dt>Descuento {data.discountCode ? <span>({data.discountCode})</span> : null}</dt><dd>−{amount(discount)}</dd></div>}{data.discountCode && discount <= 0 && <div><dt>Código aplicado</dt><dd>{data.discountCode}</dd></div>}<div className="customer-order-grand-total"><dt>Total del pedido</dt><dd>{amount(data.total)}</dd></div></dl><div className="customer-order-payment"><CreditCard size={17} /><div><span>Método de pago</span><strong>{paymentMethod}</strong><small>{data.paymentStatus || 'Estado de pago no disponible'}</small></div></div></section>

        <section className="customer-panel customer-order-contact"><div className="customer-detail-section-title"><span className="account-icon"><UserRound size={19} /></span><div><span className="eyebrow">Entrega</span><h2>Datos del destinatario</h2></div></div><div className="customer-order-contact-row"><UserRound size={16} /><div><strong>{data.customer || user.name}</strong><span>Persona que recibe el pedido</span></div></div>{data.customerEmail || user.email ? <div className="customer-order-contact-row"><span className="customer-contact-symbol">@</span><div><strong>{data.customerEmail || user.email}</strong><span>Correo electrónico</span></div></div> : null}{data.customerPhone ? <div className="customer-order-contact-row"><span className="customer-contact-symbol">#</span><div><strong>{data.customerPhone}</strong><span>Teléfono</span></div></div> : null}<div className="customer-order-contact-row"><MapPin size={16} /><div><strong>{data.address || 'Dirección no disponible en el pedido'}</strong><span>Dirección de entrega</span></div></div></section>
      </aside>
    </div>
  </main>;
}
