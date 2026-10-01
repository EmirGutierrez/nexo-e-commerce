import { useEffect, useMemo, useState } from 'react';
import { ArrowDownToLine, Check, CreditCard, Eye, Plus, Printer, ReceiptText, Trash2, X } from 'lucide-react';
import { formatQ, orders } from '../../../data/mockData';
import { orderService, productInventoryService, salesService } from '../../../services';
import { useApp } from '../../../contexts/AppContext';
import type { InPersonSale, Order, PaymentMethod, Product } from '../../../types';

type SaleDraftItem = { productId: string; quantity: number };

export default function SalesPage() {
  const { user, paymentMethods, notifyAdmin, reportLowStock } = useApp();
  const [sales, setSales] = useState<InPersonSale[]>([]);
  const [catalog, setCatalog] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [draftItems, setDraftItems] = useState<SaleDraftItem[]>([]);
  const [payment, setPayment] = useState<PaymentMethod>('card');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [selectedSale, setSelectedSale] = useState<InPersonSale | null>(null);
  const [webOrders, setWebOrders] = useState<Order[]>(orders);
  const [confirmOrderCancel, setConfirmOrderCancel] = useState<Order | null>(null);
  const [orderError, setOrderError] = useState('');
  const availableMethods = (['card', 'transfer'] as const).filter((method) => paymentMethods[method]);

  useEffect(() => {
    Promise.all([salesService.listInPerson(), productInventoryService.list()])
      .then(([saleRows, products]) => { setSales(saleRows); setCatalog(products); })
      .finally(() => setLoading(false));
    orderService.list().then(setWebOrders).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!paymentMethods[payment]) setPayment(availableMethods[0] || 'card');
  }, [paymentMethods, payment, availableMethods]);

  useEffect(() => {
    if (!showForm && !selectedSale && !confirmOrderCancel) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape' && !busy) { setShowForm(false); setSelectedSale(null); setConfirmOrderCancel(null); } };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [showForm, selectedSale, confirmOrderCancel, busy]);

  const saveOrderStatus = async (order: Order, nextStatus: Order['status']) => {
    setOrderError('');
    try {
      await orderService.updateStatus(order.id, nextStatus);
      setWebOrders((current) => current.map((entry) => entry.id === order.id ? { ...entry, status: nextStatus } : entry));
      setConfirmOrderCancel(null);
      notifyAdmin({ dedupeKey: `order-status:${order.id}:${nextStatus}:${Date.now()}`, type: nextStatus === 'Cancelado' ? 'warning' : nextStatus === 'Completado' ? 'success' : 'info', title: 'Estado del pedido actualizado', entity: `${order.id} · ${order.customer}`, message: `El estado cambió de “${order.status}” a “${nextStatus}”.`, nextAction: 'Revisar el pedido y continuar su seguimiento.', actionTo: '/admin/sales' });
    } catch { setOrderError('No se pudo actualizar el estado del pedido.'); }
  };
  const applyOrderStatus = (order: Order, nextStatus: Order['status']) => {
    if (nextStatus === order.status) return;
    if (nextStatus === 'Cancelado') { setConfirmOrderCancel(order); return; }
    void saveOrderStatus(order, nextStatus);
  };

  const productById = useMemo(() => new Map(catalog.map((product) => [product.id, product])), [catalog]);
  const lineSubtotal = (line: SaleDraftItem) => (productById.get(line.productId)?.price || 0) * line.quantity;
  const total = draftItems.reduce((sum, line) => sum + lineSubtotal(line), 0);
  const validationMessage = useMemo(() => {
    if (!draftItems.length) return 'Agrega al menos un producto para continuar.';
    const totalsByProduct = new Map<string, number>();
    for (const line of draftItems) {
      if (!line.productId) return 'Selecciona un producto en cada renglón.';
      if (!Number.isInteger(line.quantity) || line.quantity < 1) return 'Las cantidades deben ser números enteros mayores que cero.';
      totalsByProduct.set(line.productId, (totalsByProduct.get(line.productId) || 0) + line.quantity);
    }
    for (const [productId, quantity] of totalsByProduct) {
      const product = productById.get(productId);
      if (!product || quantity > product.stock) return `Stock insuficiente para ${product?.name || 'uno de los productos'}.`;
    }
    if (!paymentMethods[payment]) return 'Selecciona un método de pago activo.';
    return '';
  }, [draftItems, productById, paymentMethods, payment]);

  const openForm = () => {
    setDraftItems([]); setPayment(availableMethods[0] || 'card'); setFormError(''); setFeedback(''); setShowForm(true);
  };
  const addLine = () => {
    const nextProduct = catalog.find((product) => product.stock > 0 && !draftItems.some((line) => line.productId === product.id));
    if (!nextProduct) { setFormError('No hay más productos con stock disponibles para agregar.'); return; }
    setFormError(''); setDraftItems((current) => [...current, { productId: nextProduct.id, quantity: 1 }]);
  };
  const updateLine = (index: number, patch: Partial<SaleDraftItem>) => setDraftItems((current) => current.map((line, row) => row === index ? { ...line, ...patch } : line));
  const removeLine = (index: number) => setDraftItems((current) => current.filter((_, row) => row !== index));

  const submitSale = async (event: React.FormEvent) => {
    event.preventDefault(); setFormError('');
    if (validationMessage) { setFormError(validationMessage); return; }
    setBusy(true);
    try {
      const sale = await salesService.createInPerson({ seller: user?.name || '', paymentMethod: payment, items: draftItems });
      const [updatedProducts, updatedSales] = await Promise.all([productInventoryService.list(), salesService.listInPerson()]);
      reportLowStock(updatedProducts);
      setCatalog(updatedProducts); setSales(updatedSales); setShowForm(false); setSelectedSale(sale);
      setFeedback(`Venta ${sale.id} registrada. Se generó su comprobante interno.`);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'No se pudo registrar la venta. Revisa el inventario e inténtalo de nuevo.');
    } finally { setBusy(false); }
  };

  const physicalTotal = sales.reduce((sum, sale) => sum + sale.total, 0);
  return <div className="sales-page">
    <div className="admin-page-heading"><div><span className="eyebrow">Ventas presenciales · Datos de demostración</span><h1>Ventas</h1><p>Registra compras realizadas en el negocio. Los pedidos web y las compras a proveedores se muestran por separado.</p></div><div className="heading-actions"><button className="button button-primary" onClick={openForm}><Plus size={17} /> Registrar venta presencial</button></div></div>
    {feedback && <div className="sale-feedback" role="status">{feedback}<button type="button" aria-label="Cerrar mensaje" onClick={() => setFeedback('')}><X size={15} /></button></div>}
    <div className="sales-stats"><article><span>Ventas presenciales</span><strong>{sales.length}</strong><small>Registradas en esta sesión</small></article><article><span>Total vendido</span><strong>{formatQ(physicalTotal)}</strong><small>Solo ventas presenciales</small></article><article><span>Pedidos web</span><strong>{orders.length}</strong><small>Historial independiente</small></article></div>
    <section className="panel sales-panel"><div className="panel-heading"><div><h2>Historial de ventas presenciales</h2><span>{sales.length} comprobantes internos</span></div></div>
      {loading ? <div className="sales-empty">Cargando ventas…</div> : sales.length ? <div className="data-table sales-table"><div className="table-head"><span>Venta</span><span>Fecha</span><span>Vendedor</span><span>Productos</span><span>Pago</span><span>Total</span><span>Detalle</span></div>{sales.map((sale) => <div className="table-row" key={sale.id}><strong>{sale.id}</strong><span>{new Date(sale.date).toLocaleString('es-GT')}</span><span>{sale.seller}</span><span>{sale.items.reduce((sum, item) => sum + item.quantity, 0)}</span><span className="sale-payment-status">{sale.paymentStatus}</span><strong>{formatQ(sale.total)}</strong><div className="table-actions"><button type="button" className="icon-button" title="Ver comprobante" aria-label={`Ver venta ${sale.id}`} onClick={() => setSelectedSale(sale)}><Eye size={15} /></button></div></div>)}</div> : <div className="sales-empty"><ReceiptText size={30} /><strong>Aún no hay ventas presenciales</strong><span>Registra una venta para crear el primer comprobante de esta sesión.</span><button className="button button-outline" onClick={openForm}><Plus size={15} /> Registrar venta</button></div>}
    </section>
    <section className="panel web-orders-panel"><div className="panel-heading"><div><h2>Pedidos de tienda en línea</h2><span>Son pedidos web; no forman parte de las ventas presenciales.</span></div></div>{orderError && <div className="sale-form-error" role="alert">{orderError}</div>}<div className="data-table web-orders-table"><div className="table-head"><span>Pedido web</span><span>Cliente</span><span>Fecha</span><span>Método de pago</span><span>Estado</span><span>Total</span></div>{webOrders.map((order) => <div className="table-row" key={order.id}><strong>{order.id}</strong><span>{order.customer}</span><span>{order.date}</span><span>{order.payment}</span><label className="order-status-select"><span className="sr-only">Estado de {order.id}</span><select value={order.status} onChange={(event) => applyOrderStatus(order, event.target.value as Order['status'])}><option>Pendiente de pago</option><option>En preparación</option><option>Completado</option><option>Cancelado</option></select></label><strong>{formatQ(order.total)}</strong></div>)}</div></section>

    {confirmOrderCancel && <div className="modal-backdrop" onClick={() => setConfirmOrderCancel(null)}><section className="modal order-cancel-confirm" role="alertdialog" aria-modal="true" aria-labelledby="order-cancel-title"><div className="modal-header"><div><span className="eyebrow">Confirmación destructiva</span><h2 id="order-cancel-title">Cancelar pedido {confirmOrderCancel.id}</h2></div><button type="button" className="icon-button" aria-label="Cerrar confirmación" onClick={() => setConfirmOrderCancel(null)}><X size={18} /></button></div><p>Esta acción cambia el estado del pedido de {confirmOrderCancel.status} a Cancelado. La advertencia informativa aparecerá después de confirmar.</p><div className="modal-actions"><button className="button button-outline" onClick={() => setConfirmOrderCancel(null)}>Volver</button><button className="button button-primary" onClick={() => void saveOrderStatus(confirmOrderCancel, 'Cancelado')}>Confirmar cancelación</button></div></section></div>}    {showForm && <div className="modal-backdrop" onClick={() => { if (!busy) setShowForm(false); }}><div className="modal sale-modal" role="dialog" aria-modal="true" aria-labelledby="sale-form-title" onClick={(event) => event.stopPropagation()}><div className="modal-header"><div><span className="eyebrow">Venta presencial</span><h2 id="sale-form-title">Registrar venta</h2></div><button type="button" className="icon-button" aria-label="Cerrar" disabled={busy} onClick={() => setShowForm(false)}><X size={18} /></button></div>
      <form className="sale-form" onSubmit={submitSale} noValidate><div className="sale-meta-grid"><div><span>Vendedor</span><strong>{user?.name || 'Personal'}</strong></div><div><span>Fecha</span><strong>{new Date().toLocaleString('es-GT')}</strong></div></div>
        <div className="sale-items-heading"><div><strong>Productos vendidos</strong><span>El total y el inventario se validan al confirmar.</span></div><button type="button" className="button button-outline" onClick={addLine} disabled={busy || !catalog.some((product) => product.stock > 0 && !draftItems.some((line) => line.productId === product.id))}><Plus size={15} /> Añadir producto</button></div>
        {draftItems.length ? <div className="sale-items-list">{draftItems.map((line, index) => {
          const product = productById.get(line.productId);
          const otherSelected = draftItems.filter((_, row) => row !== index).map((item) => item.productId);
          return <div className="sale-line-row" key={`${index}-${line.productId}`}><label className="field sale-product-field"><span>Producto</span><select value={line.productId} onChange={(event) => updateLine(index, { productId: event.target.value })}><option value="">Seleccionar producto</option>{catalog.map((item) => <option key={item.id} value={item.id} disabled={item.stock < 1 || otherSelected.includes(item.id)}>{item.name} · {item.stock} disp.</option>)}</select></label><label className="field"><span>Cantidad</span><input type="number" min="1" max={product?.stock || 1} step="1" value={line.quantity} onChange={(event) => updateLine(index, { quantity: Number(event.target.value) })} /></label><div className="sale-line-stock"><span>Disponible</span><strong>{product?.stock ?? 0}</strong></div><div className="sale-line-subtotal"><span>Subtotal</span><strong>{formatQ(lineSubtotal(line))}</strong></div><button type="button" className="icon-button danger sale-remove" aria-label={`Quitar ${product?.name || 'producto'}`} onClick={() => removeLine(index)}><Trash2 size={16} /></button></div>;
        })}</div> : <div className="sale-no-items">Añade al menos un producto para calcular la venta.</div>}
        <div className="sale-payment-select"><label className="field"><span>Método de pago habilitado</span><select value={payment} onChange={(event) => setPayment(event.target.value as PaymentMethod)} disabled={!availableMethods.length}>{availableMethods.map((method) => <option key={method} value={method}>{method === 'card' ? 'Tarjeta simulada' : 'Transferencia bancaria · pendiente de verificación'}</option>)}</select></label><p>{payment === 'transfer' ? 'El pago quedará pendiente de verificación; no se procesa una transferencia real.' : 'La tarjeta solo se simula. No se solicitan ni guardan datos financieros.'}</p></div>
        <div className="sale-grand-total"><span>Total de venta</span><strong>{formatQ(total)}</strong></div>
        {formError && <div className="sale-form-error" role="alert">{formError}</div>}{!formError && validationMessage && <p className="sale-validation-hint">{validationMessage}</p>}
        <div className="modal-actions"><button type="button" className="button button-outline" disabled={busy} onClick={() => setShowForm(false)}>Cancelar</button><button type="submit" className="button button-primary" disabled={busy || Boolean(validationMessage)}><Check size={16} /> {busy ? 'Registrando…' : 'Confirmar venta'}</button></div>
      </form></div></div>}

    {selectedSale && <div className="modal-backdrop" onClick={() => setSelectedSale(null)}><div className="modal sale-receipt-modal" role="dialog" aria-modal="true" aria-labelledby="sale-receipt-title" onClick={(event) => event.stopPropagation()}><div className="modal-header receipt-modal-header"><div><span className="eyebrow">Comprobante interno · no es factura fiscal</span><h2 id="sale-receipt-title">{selectedSale.id}</h2></div><div className="receipt-actions"><button type="button" className="button button-outline" onClick={() => window.print()}><Printer size={15} /> Imprimir</button><button type="button" className="icon-button" aria-label="Cerrar comprobante" onClick={() => setSelectedSale(null)}><X size={18} /></button></div></div><SaleReceipt sale={selectedSale} /></div></div>}
  </div>;
}

function SaleReceipt({ sale }: { sale: InPersonSale }) {
  return <div className="sale-receipt-print"><div className="receipt-brand"><span className="brand-mark"><span /></span><strong>NEXO</strong></div><p className="receipt-kind">VENTA PRESENCIAL · COMPROBANTE INTERNO</p><div className="receipt-not-tax">Este comprobante no es una factura fiscal. Operación de demostración sin cobro real.</div><dl className="receipt-meta"><div><dt>Folio</dt><dd>{sale.id}</dd></div><div><dt>Fecha</dt><dd>{new Date(sale.date).toLocaleString('es-GT')}</dd></div><div><dt>Vendedor</dt><dd>{sale.seller}</dd></div><div><dt>Pago</dt><dd>{sale.paymentMethod === 'card' ? 'Tarjeta simulada' : 'Transferencia bancaria'}</dd></div><div><dt>Estado</dt><dd>{sale.paymentStatus}</dd></div></dl><div className="receipt-lines"><div className="receipt-line receipt-table-head"><span>Producto</span><span>Cant.</span><span>Precio</span><span>Subtotal</span></div>{sale.items.map((item) => <div className="receipt-line" key={item.productId}><span>{item.productName}<small>{item.sku}</small></span><span>{item.quantity}</span><span>{formatQ(item.unitPrice)}</span><strong>{formatQ(item.subtotal)}</strong></div>)}</div><div className="receipt-total"><span>Total</span><strong>{formatQ(sale.total)}</strong></div><p className="receipt-thanks">Gracias por tu compra.</p></div>;
}
