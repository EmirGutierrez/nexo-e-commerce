'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Banknote, Barcode, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, ClipboardList, CreditCard, Download, Eye, Minus, Pencil, Plus, Printer, Search, ShoppingBag, Store, Trash2, UserRound, X } from 'lucide-react';
import { formatQ } from '../../../data/mockData';
import { orderService, productInventoryService, salesService } from '../../../services';
import { useApp } from '../../../contexts/AppContext';
import { roleService } from '../../../services/roleService';
import type { InPersonSale, Order, Product } from '../../../types';

type PosItem = { productId: string; name: string; sku: string; unitPrice: number; quantity: number; stock: number; image: string };
type HistoryItem = { productId: string; productName: string; sku: string; quantity: number; unitPrice: number; subtotal: number };
type HistoryRow = { id: string; kind: string; date: string; customer: string; nit: string; products: string; items: HistoryItem[]; payment: string; status: string; total: number; order?: Order; inPersonSale?: InPersonSale };
const MAX_RESULTS = 8;
const historyDateLabel = (value: string, includeTime = true) => {
  if (!value) return '—';
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('es-GT', includeTime ? { dateStyle: 'short', timeStyle: 'short' } : undefined);
};

export default function SalesPage() {
  const { user, role, paymentMethods } = useApp();
  const canCreateSale = Boolean(role && roleService.can(role, 'sales', 'create'));
  const canViewHistory = Boolean(role && (roleService.can(role, 'sales', 'view') || roleService.can(role, 'orders', 'view')));
  const canApproveOrders = Boolean(role && roleService.can(role, 'orders', 'approve'));
  const [activeView, setActiveView] = useState<'choose' | 'pos' | 'history'>('choose');
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
  const [receipt, setReceipt] = useState<InPersonSale | null>(null);
  const [historyError, setHistoryError] = useState('');
  const [salesHistory, setSalesHistory] = useState<InPersonSale[]>([]);
  const [webOrders, setWebOrders] = useState<Order[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [confirmOrderCancel, setConfirmOrderCancel] = useState<Order | null>(null);
  const [updatingOrderId, setUpdatingOrderId] = useState('');
  const [selectedHistoryRow, setSelectedHistoryRow] = useState<HistoryRow | null>(null);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [editOrderStatus, setEditOrderStatus] = useState<Order['status']>('Pendiente de pago');
  const [historyQuery, setHistoryQuery] = useState('');
  const [historyTypeFilter, setHistoryTypeFilter] = useState('Todos');
  const [historyStatusFilter, setHistoryStatusFilter] = useState('Todos');
  const [historyPeriodFilter, setHistoryPeriodFilter] = useState<'all' | '30' | '90' | 'month'>('all');
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPageSize, setHistoryPageSize] = useState(10);
  const [confirmCancelSale, setConfirmCancelSale] = useState(false);
  const [saving, setSaving] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const nitRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    productInventoryService.list()
      .then((rows) => { if (active) setCatalog(rows); })
      .catch((cause) => { if (active) setCatalogError(cause instanceof Error ? cause.message : 'No se pudo cargar el catálogo.'); })
      .finally(() => { if (active) setCatalogLoading(false); });
    Promise.allSettled([
      role && roleService.can(role, 'sales', 'view') ? salesService.listInPerson() : Promise.resolve([] as InPersonSale[]),
      role && roleService.can(role, 'orders', 'view') ? orderService.list() : Promise.resolve([] as Order[]),
    ])
      .then(([salesResult, ordersResult]) => {
        if (!active) return;
        if (salesResult.status === 'fulfilled') setSalesHistory(salesResult.value);
        else setHistoryError(salesResult.reason instanceof Error ? salesResult.reason.message : 'No se pudieron cargar las ventas presenciales.');
        if (ordersResult.status === 'fulfilled') setWebOrders(ordersResult.value);
        else setHistoryError((previous) => [previous, ordersResult.reason instanceof Error ? ordersResult.reason.message : 'No se pudieron cargar los pedidos en línea.'].filter(Boolean).join(' '));
      })
      .finally(() => { if (active) setHistoryLoading(false); });
    return () => { active = false; };
  }, []);

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

  useEffect(() => {
    if (!confirmOrderCancel) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape' && !updatingOrderId) setConfirmOrderCancel(null); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [confirmOrderCancel, updatingOrderId]);

  useEffect(() => {
    if (!confirmCancelSale) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setConfirmCancelSale(false); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [confirmCancelSale]);

  useEffect(() => { setHistoryPage(1); }, [historyQuery, historyTypeFilter, historyStatusFilter, historyPeriodFilter, historyPageSize]);

  const availableProducts = useMemo(() => {
    return catalog.filter((product) => product.status !== 'Inactivo' && product.stock > 0);
  }, [catalog]);
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
  const hasSaleDraft = Boolean(cart.length || search || customerName || nit || amountReceived || stage === 'checkout');
  const cancelSaleDraft = () => {
    setCart([]); setSearch(''); setCustomerName(''); setNit(''); setPaymentMethod('cash'); setAmountReceived('');
    setCheckoutError(''); setCatalogError(''); setStage('sale'); setConfirmCancelSale(false);
    window.setTimeout(() => searchRef.current?.focus(), 0);
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

  const completeSale = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const error = validateCheckout();
    if (error) { setCheckoutError(error); return; }
    setSaving(true);
    setCheckoutError('');
    try {
      const sale = await salesService.createInPerson({
        customerName: customerName.trim(),
        nit: nit.trim().toLocaleUpperCase('es-GT'),
        paymentMethod,
        ...(paymentMethod === 'cash' ? { amountReceived: paid } : {}),
        items: cart.map(({ productId, quantity }) => ({ productId, quantity })),
      });
      setSalesHistory((current) => [sale, ...current.filter((existing) => existing.id !== sale.id)]);
      setCatalog((current) => current.map((product) => {
        const sold = sale.items.find((item) => item.productId === product.id)?.quantity || 0;
        return sold ? { ...product, stock: Math.max(0, product.stock - sold) } : product;
      }));
      setReceipt(sale);
      setCart([]); setStage('sale'); setCustomerName(''); setNit(''); setPaymentMethod('cash'); setAmountReceived(''); setSearch('');
    } catch (cause) {
      setCheckoutError(cause instanceof Error ? cause.message : 'No se pudo registrar la venta en PostgreSQL. Verifica la conexión e inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  const closeReceipt = () => { setReceipt(null); window.setTimeout(() => searchRef.current?.focus(), 0); };
  const changePaymentMethod = (method: 'cash' | 'card') => { setPaymentMethod(method); setCheckoutError(''); };
  const historyRows: HistoryRow[] = useMemo(() => [
    ...webOrders.map((order) => ({ id: order.id, kind: 'Pedido en línea', date: order.date, customer: order.customer || 'Cliente', nit: '—', products: (order.itemDetails || []).map((item) => `${item.productName} × ${item.quantity}`).join('; '), items: order.itemDetails || [], payment: order.payment, status: order.status, total: order.total, order })),
    ...salesHistory.map((sale) => ({ id: sale.id, kind: 'Venta presencial', date: sale.date, customer: sale.customerName || 'No registrado', nit: sale.nit || '—', products: sale.items.map((item) => `${item.productName} × ${item.quantity}`).join('; '), items: sale.items, payment: sale.paymentMethod === 'card' ? 'Tarjeta simulada' : sale.paymentMethod === 'cash' ? 'Efectivo' : 'Transferencia', status: 'Completado', total: sale.total, inPersonSale: sale })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()), [webOrders, salesHistory]);

  const filteredHistory = useMemo(() => {
    const now = new Date();
    return historyRows.filter((row) => {
      const matchesQuery = `${row.id} ${row.kind} ${row.customer} ${row.nit} ${row.products} ${row.payment} ${row.status}`.toLocaleLowerCase('es-GT').includes(historyQuery.trim().toLocaleLowerCase('es-GT'));
      const matchesType = historyTypeFilter === 'Todos' || (historyTypeFilter === 'Pedidos en línea' ? row.kind === 'Pedido en línea' : row.kind.startsWith('Venta presencial'));
      const matchesStatus = historyStatusFilter === 'Todos' || row.status === historyStatusFilter;
      if (!matchesQuery || !matchesType || !matchesStatus) return false;
      if (historyPeriodFilter === 'all') return true;
      const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(row.date) ? `${row.date}T12:00:00` : row.date);
      if (Number.isNaN(date.getTime())) return false;
      if (historyPeriodFilter === 'month') return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
      const age = now.getTime() - date.getTime();
      return age >= 0 && age <= Number(historyPeriodFilter) * 24 * 60 * 60 * 1000;
    });
  }, [historyRows, historyQuery, historyTypeFilter, historyStatusFilter, historyPeriodFilter]);
  const historyPages = Math.max(1, Math.ceil(filteredHistory.length / historyPageSize));
  const pagedHistory = filteredHistory.slice((historyPage - 1) * historyPageSize, historyPage * historyPageSize);

  const saveOrderStatus = async (order: Order, nextStatus: Order['status']) => {
    setHistoryError(''); setUpdatingOrderId(order.id);
    try {
      await orderService.updateStatus(order.id, nextStatus);
      setWebOrders((current) => current.map((entry) => entry.id === order.id ? { ...entry, status: nextStatus } : entry));
      setHistoryPage(1);
      setConfirmOrderCancel(null);
      setEditingOrder(null);
    } catch (cause) { setHistoryError(cause instanceof Error ? cause.message : 'No se pudo actualizar el estado del pedido.'); }
    finally { setUpdatingOrderId(''); }
  };
  const applyOrderStatus = (order: Order, nextStatus: Order['status']) => {
    if (nextStatus === order.status) return;
    if (nextStatus === 'Cancelado') { setConfirmOrderCancel(order); return; }
    void saveOrderStatus(order, nextStatus);
  };
  const editOrder = (order: Order) => { setEditingOrder(order); setEditOrderStatus(order.status); setHistoryError(''); };
  const submitOrderEdit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingOrder || editOrderStatus === editingOrder.status) { setEditingOrder(null); return; }
    if (editOrderStatus === 'Cancelado') { setConfirmOrderCancel(editingOrder); return; }
    void saveOrderStatus(editingOrder, editOrderStatus);
  };
  const exportHistory = () => {
    const rows = [['Folio', 'Tipo', 'Cliente', 'NIT', 'Fecha', 'Productos', 'Pago', 'Estado', 'Total'], ...filteredHistory.map((row) => [row.id, row.kind, row.customer, row.nit, row.date, row.products, row.payment, row.status, row.total])];
    const csvCell = (value: string | number) => { const text = String(value); const safe = /^[=+\-@]/.test(text) ? `'${text}` : text; return `"${safe.replaceAll('"', '""')}"`; };
    const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = `historial-ventas-${new Date().toISOString().slice(0, 10)}.csv`; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  if (!canCreateSale && !canViewHistory) return <div className="module-page"><div className="admin-page-heading"><div><span className="eyebrow">Ventas</span><h1>Ventas</h1><p>Tu rol no tiene permiso para consultar ni registrar ventas.</p></div></div></div>;

  if (activeView === 'choose') return <div className="module-page sales-entry-page">
    <div className="admin-page-heading"><div><span className="eyebrow">Módulo de ventas</span><h1>¿Qué deseas hacer?</h1><p>Registra una venta realizada en el local o consulta el historial de ventas y pedidos.</p></div></div>
    <div className="sales-entry-options">
      {canCreateSale && <button type="button" className="sales-entry-option panel" onClick={() => setActiveView('pos')}><span className="sales-entry-icon"><Store size={23} /></span><strong>Venta presencial</strong><span>Busca productos, crea la cuenta del cliente y registra el cobro en mostrador.</span><b>Iniciar venta <ChevronDown size={16} /></b></button>}
      {canViewHistory && <button type="button" className="sales-entry-option panel" onClick={() => setActiveView('history')}><span className="sales-entry-icon"><ClipboardList size={23} /></span><strong>Consultar ventas</strong><span>Revisa ventas presenciales y pedidos en línea, sus fechas, pagos y estados.</span><b>Ver historial <ChevronDown size={16} /></b></button>}
    </div>
  </div>;

  if (activeView === 'history') return <div className="sales-page sales-history-page">
    <div className="admin-page-heading"><div><span className="eyebrow">Historial general</span><h1>Ventas y pedidos</h1><p>Consulta ventas presenciales y pedidos de la tienda en línea.</p></div><div className="heading-actions"><button type="button" className="button button-outline" onClick={exportHistory} disabled={!filteredHistory.length}><Download size={16} /> Exportar CSV</button><button type="button" className="button button-outline" onClick={() => setActiveView('choose')}>Volver a ventas</button></div></div>
    <div className="sales-stats"><article><span>Registros encontrados</span><strong>{filteredHistory.length}</strong><small>Con los filtros actuales</small></article><article><span>Ventas presenciales guardadas</span><strong>{salesHistory.length}</strong><small>Consultadas desde el sistema</small></article><article><span>Pedidos en línea</span><strong>{webOrders.length}</strong><small>Consultados desde el sistema</small></article></div>
    {historyError && <div className="sale-form-error" role="alert">{historyError}</div>}
    <section className="panel sales-panel"><div className="panel-heading"><div><h2>Historial de ventas</h2><span>{filteredHistory.length} registros ? los estados editables corresponden a pedidos en línea.</span></div></div>
      <div className="module-toolbar sales-history-toolbar"><label className="search-box admin-search"><Search size={17} /><input value={historyQuery} onChange={(event) => setHistoryQuery(event.target.value)} placeholder="Buscar folio, cliente, pago o estado..." />{historyQuery && <button type="button" onClick={() => setHistoryQuery('')} aria-label="Limpiar búsqueda"><X size={15} /></button>}</label>
        <label className="sales-history-filter"><CalendarDays size={15} /><span className="sr-only">Periodo</span><select value={historyPeriodFilter} onChange={(event) => setHistoryPeriodFilter(event.target.value as typeof historyPeriodFilter)}><option value="all">Todos los periodos</option><option value="30">Últimos 30 días</option><option value="90">Últimos 90 días</option><option value="month">Este mes</option></select></label>
        <label className="sales-history-filter"><span>Tipo</span><select value={historyTypeFilter} onChange={(event) => setHistoryTypeFilter(event.target.value)}><option>Todos</option><option>Pedidos en línea</option><option>Ventas presenciales</option></select></label>
        <label className="sales-history-filter"><span>Estado</span><select value={historyStatusFilter} onChange={(event) => setHistoryStatusFilter(event.target.value)}><option>Todos</option>{Array.from(new Set(historyRows.map((row) => row.status))).map((status) => <option key={status}>{status}</option>)}</select></label>
      </div>
      {historyLoading ? <div className="sales-empty">Cargando historial…</div> : pagedHistory.length ? <><div className="data-table all-sales-table"><div className="table-head"><span>Folio</span><span>Tipo</span><span>Cliente</span><span>NIT</span><span>Fecha</span><span>Pago</span><span>Estado</span><span>Total</span><span>Acciones</span></div>{pagedHistory.map((row) => <div className="table-row" key={`${row.kind}-${row.id}`}><strong>{row.id}</strong><span>{row.kind}</span><span>{row.customer}</span><span>{row.nit}</span><span>{historyDateLabel(row.date)}</span><span>{row.payment}</span><span>{row.status}</span><strong>{formatQ(row.total)}</strong><div className="table-actions"><button type="button" className="icon-button" title="Ver detalle" aria-label={`Ver ${row.kind} ${row.id}`} onClick={() => setSelectedHistoryRow(row)}><Eye size={15} /></button>{row.order && canApproveOrders && ['Pendiente de pago', 'En preparaci\u00f3n'].includes(row.order.status) && <button type="button" className="icon-button" title="Editar estado" aria-label={`Editar pedido ${row.order.id}`} onClick={() => editOrder(row.order!)}><Pencil size={15} /></button>}</div></div>)}</div><div className="sales-history-pagination"><span>Mostrando {Math.min((historyPage - 1) * historyPageSize + 1, filteredHistory.length)}–{Math.min(historyPage * historyPageSize, filteredHistory.length)} de {filteredHistory.length}</span><label>Filas<select value={historyPageSize} onChange={(event) => setHistoryPageSize(Number(event.target.value))}><option value={10}>10</option><option value={25}>25</option><option value={50}>50</option></select></label><div><button type="button" className="button button-outline" disabled={historyPage <= 1} onClick={() => setHistoryPage((page) => page - 1)}><ChevronLeft size={15} /> Anterior</button><span>Página {historyPage} de {historyPages}</span><button type="button" className="button button-outline" disabled={historyPage >= historyPages} onClick={() => setHistoryPage((page) => page + 1)}>Siguiente <ChevronRight size={15} /></button></div></div></> : <div className="sales-empty"><ClipboardList size={30} /><strong>{historyRows.length ? 'No hay registros que coincidan' : 'No hay ventas ni pedidos registrados'}</strong><span>{historyRows.length ? 'Ajusta los filtros o la búsqueda.' : 'Cuando haya registros, aparecerán aquí.'}</span></div>}
    </section>
    {selectedHistoryRow && <div className="modal-backdrop" onClick={() => setSelectedHistoryRow(null)}><section className="modal sales-history-detail" role="dialog" aria-modal="true" aria-labelledby="sales-history-detail-title" onClick={(event) => event.stopPropagation()}><div className="modal-header"><div><span className="eyebrow">{selectedHistoryRow.kind}</span><h2 id="sales-history-detail-title">{selectedHistoryRow.id}</h2></div><button type="button" className="icon-button" aria-label="Cerrar detalle" onClick={() => setSelectedHistoryRow(null)}><X size={18} /></button></div><dl className="sales-history-detail-grid"><div><dt>Cliente</dt><dd>{selectedHistoryRow.customer}</dd></div><div><dt>NIT</dt><dd>{selectedHistoryRow.nit}</dd></div><div><dt>Fecha</dt><dd>{historyDateLabel(selectedHistoryRow.date)}</dd></div><div><dt>M&eacute;todo de pago</dt><dd>{selectedHistoryRow.payment}</dd></div><div><dt>Estado</dt><dd>{selectedHistoryRow.status}</dd></div><div><dt>Total</dt><dd>{formatQ(selectedHistoryRow.total)}</dd></div></dl><div className="sales-history-lines"><h3>Productos adquiridos</h3>{selectedHistoryRow.items.length ? selectedHistoryRow.items.map((item) => <div className="sales-history-product" key={item.productId}><span><strong>{item.productName}</strong><small>SKU {item.sku || '?'} &middot; {item.quantity} &times; {formatQ(item.unitPrice)}</small></span><strong>{formatQ(item.subtotal)}</strong></div>) : <p>El sistema no devolvi&oacute; el detalle de productos para este registro.</p>}</div><div className="modal-actions"><button type="button" className="button button-outline" onClick={() => setSelectedHistoryRow(null)}>Cerrar</button></div></section></div>}
    {editingOrder && <div className="modal-backdrop" onClick={() => !updatingOrderId && setEditingOrder(null)}><section className="modal order-edit-modal" role="dialog" aria-modal="true" aria-labelledby="order-edit-title" onClick={(event) => event.stopPropagation()}><div className="modal-header"><div><span className="eyebrow">Editar pedido en línea</span><h2 id="order-edit-title">{editingOrder.id}</h2></div><button type="button" className="icon-button" aria-label="Cerrar edición" disabled={Boolean(updatingOrderId)} onClick={() => setEditingOrder(null)}><X size={18} /></button></div><p className="order-edit-summary">{editingOrder.customer} · {editingOrder.payment} · {formatQ(editingOrder.total)}</p><form onSubmit={submitOrderEdit}><label className="field"><span>Estado del pedido</span><select value={editOrderStatus} onChange={(event) => setEditOrderStatus(event.target.value as Order['status'])}><option value={editingOrder.status}>{editingOrder.status}</option>{editingOrder.status === 'Pendiente de pago' && editingOrder.payment === 'Tarjeta' && <option value="En preparación">En preparación</option>}{editingOrder.status === 'En preparación' && <option value="Completado">Completado</option>}<option value="Cancelado">Cancelado</option></select></label><div className="modal-actions"><button type="button" className="button button-outline" disabled={Boolean(updatingOrderId)} onClick={() => setEditingOrder(null)}>Cerrar</button><button type="submit" className="button button-primary" disabled={Boolean(updatingOrderId) || editOrderStatus === editingOrder.status}>{updatingOrderId ? 'Guardando…' : 'Guardar cambios'}</button></div></form></section></div>}
    {confirmOrderCancel && <div className="modal-backdrop" onClick={() => !updatingOrderId && setConfirmOrderCancel(null)}><section className="modal order-cancel-confirm" role="alertdialog" aria-modal="true" aria-labelledby="order-cancel-title" onClick={(event) => event.stopPropagation()}><div className="modal-header"><div><span className="eyebrow">Confirmación</span><h2 id="order-cancel-title">Cancelar pedido {confirmOrderCancel.id}</h2></div><button type="button" className="icon-button" aria-label="Cerrar confirmaci?n" disabled={Boolean(updatingOrderId)} onClick={() => setConfirmOrderCancel(null)}><X size={18} /></button></div><p>Esta acción cambiará el estado de ?{confirmOrderCancel.status}? a ?Cancelado?.</p><div className="modal-actions"><button className="button button-outline" disabled={Boolean(updatingOrderId)} onClick={() => setConfirmOrderCancel(null)}>Volver</button><button className="button button-primary" disabled={Boolean(updatingOrderId)} onClick={() => void saveOrderStatus(confirmOrderCancel, 'Cancelado')}>{updatingOrderId ? 'Actualizando…' : 'Confirmar cancelación'}</button></div></section></div>}
  </div>;

  return <div className="sales-page pos-page">
    <div className="admin-page-heading pos-heading"><div><span className="eyebrow"><ShoppingBag size={14} /> Punto de venta</span><h1>Nueva venta</h1><p>Busca por código o nombre, agrega productos y cobra en mostrador.</p></div><div className="pos-heading-actions"><button type="button" className="button button-outline" onClick={() => setActiveView('choose')}>Volver</button><div className="pos-seller"><span>Atiende</span><strong>{user?.name || 'Personal'}</strong></div></div></div>
    <div className="pos-layout">
      <section className="pos-catalog panel" aria-label="Buscar productos">
        <div className="pos-section-heading"><div><span className="eyebrow">Catálogo</span><h2>Agrega productos</h2><p>Escanea el SKU o escribe el nombre del producto.</p></div><span className="pos-product-count">{availableProducts.length} disponibles</span></div>
        <form className="pos-search-form" onSubmit={submitProductSearch} role="search"><Barcode size={20} aria-hidden="true" /><label className="sr-only" htmlFor="pos-product-search">Buscar por código SKU o nombre del producto</label><input id="pos-product-search" ref={searchRef} value={search} onChange={(event) => { setSearch(event.target.value); setCatalogError(''); }} placeholder="Buscar por código o nombre del producto" autoComplete="off" /><kbd aria-hidden="true">↵</kbd></form>
        <div className="pos-search-hint"><span>Escanea el SKU o escribe el nombre y presiona Enter para agregar.</span></div>
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
        <button type="button" className="button button-outline pos-cancel-sale-button" disabled={!hasSaleDraft} onClick={() => setConfirmCancelSale(true)}><X size={15} /> Cancelar venta</button>
        <p className="pos-ticket-footnote">Verifica cantidades y existencias antes de confirmar.</p>
      </aside>
    </div>

    <section className="panel pos-history"><div className="pos-section-heading"><div><span className="eyebrow">Actividad reciente</span><h2>Ventas registradas</h2><p>Comprobantes persistidos en PostgreSQL y compartidos entre sesiones.</p></div><span className="pos-product-count">{salesHistory.length} registros</span></div>
      {historyError && <p className="pos-history-note" role="status">{historyError}</p>}
      {historyLoading ? <div className="pos-history-empty">Cargando ventas guardadas…</div> : salesHistory.length ? <div className="pos-history-scroll"><table className="pos-history-table"><thead><tr><th>Folio</th><th>Fecha</th><th>Cliente / NIT</th><th>Pago</th><th>Total</th><th><span className="sr-only">Comprobante</span></th></tr></thead><tbody>{salesHistory.slice(0, 20).map((sale) => <tr key={sale.id}><td><strong>{sale.id}</strong></td><td>{new Date(sale.date).toLocaleString('es-GT', { dateStyle: 'short', timeStyle: 'short' })}</td><td>{sale.nit ? <>{sale.customerName || 'Cliente'}<small>{sale.nit}</small></> : sale.customerName || '—'}</td><td>{sale.paymentMethod === 'cash' ? 'Efectivo' : sale.paymentMethod === 'card' ? 'Tarjeta simulada' : 'Transferencia'}</td><td><strong>{formatQ(sale.total)}</strong></td><td><button type="button" className="pos-view-receipt" onClick={() => setReceipt(sale)} aria-label={`Abrir comprobante ${sale.id}`}><Printer size={16} /> Ver</button></td></tr>)}</tbody></table></div> : <div className="pos-history-empty">Las ventas que registres aparecerán aquí para todos los equipos conectados a la misma base de datos.</div>}
    </section>

    {confirmCancelSale && <div className="modal-backdrop" onClick={() => setConfirmCancelSale(false)}><section className="modal order-cancel-confirm" role="alertdialog" aria-modal="true" aria-labelledby="cancel-sale-title" onClick={(event) => event.stopPropagation()}><div className="modal-header"><div><span className="eyebrow">Cancelar venta</span><h2 id="cancel-sale-title">¿Deseas cancelar esta venta?</h2></div><button type="button" className="icon-button" aria-label="Cerrar confirmación" onClick={() => setConfirmCancelSale(false)}><X size={18} /></button></div><p>Se eliminarán de esta venta los productos seleccionados y los datos ingresados del cliente y del pago.</p><div className="modal-actions"><button type="button" className="button button-outline" onClick={() => setConfirmCancelSale(false)}>Mantener venta</button><button type="button" className="button button-primary" onClick={cancelSaleDraft}>Sí, cancelar venta</button></div></section></div>}
    {receipt && <div className="modal-backdrop pos-receipt-backdrop" onClick={closeReceipt}><section className="modal sale-receipt-modal pos-receipt-modal" role="dialog" aria-modal="true" aria-labelledby="pos-receipt-title" onClick={(event) => event.stopPropagation()}><div className="modal-header receipt-modal-header"><div><span className="eyebrow">Comprobante digital de venta</span><h2 id="pos-receipt-title">{receipt.id}</h2></div><div className="receipt-actions"><button type="button" className="button button-outline" onClick={() => window.print()}><Printer size={15} /> Imprimir</button><button type="button" className="icon-button" aria-label="Cerrar comprobante" onClick={closeReceipt}><X size={18} /></button></div></div><PosReceipt sale={receipt} /></section></div>}
  </div>;
}

function PosReceipt({ sale }: { sale: InPersonSale }) {
  return <div className="sale-receipt-print pos-receipt-print"><div className="receipt-brand"><span className="brand-mark"><span /></span><strong>NEXO</strong></div><p className="receipt-kind">COMPROBANTE DE VENTA PRESENCIAL</p><div className="receipt-not-tax">Comprobante generado por la interfaz de demostración. No es factura FEL ni comprobante fiscal autorizado.</div><dl className="receipt-meta"><div><dt>Folio</dt><dd>{sale.id}</dd></div><div><dt>Fecha</dt><dd>{new Date(sale.date).toLocaleString('es-GT')}</dd></div><div><dt>Cliente</dt><dd>{sale.customerName}</dd></div><div><dt>NIT</dt><dd>{sale.nit}</dd></div><div><dt>Vendedor</dt><dd>{sale.seller}</dd></div><div><dt>Pago</dt><dd>{sale.paymentMethod === 'cash' ? 'Efectivo' : sale.paymentMethod === 'card' ? 'Tarjeta simulada' : 'Transferencia'}</dd></div></dl><div className="receipt-lines"><div className="receipt-line receipt-table-head"><span>Producto</span><span>Cant.</span><span>Precio</span><span>Subtotal</span></div>{sale.items.map((item) => <div className="receipt-line" key={item.productId}><span>{item.productName}<small>SKU {item.sku}</small></span><span>{item.quantity}</span><span>{formatQ(item.unitPrice)}</span><strong>{formatQ(item.subtotal)}</strong></div>)}</div><div className="receipt-total"><span>Total</span><strong>{formatQ(sale.total)}</strong></div>{sale.paymentMethod === 'cash' && <div className="pos-receipt-cash"><div><span>Efectivo recibido</span><strong>{formatQ(sale.amountReceived || 0)}</strong></div><div><span>Cambio</span><strong>{formatQ(sale.change || 0)}</strong></div></div>}<p className="receipt-thanks">Gracias por tu compra.</p></div>;
}
