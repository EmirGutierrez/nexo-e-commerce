import { useEffect, useMemo, useState } from 'react';
import { Ban, Check, Download, Eye, Package, Plus, Search, ShoppingCart, Trash2, X } from 'lucide-react';
import { formatQ } from '../../../data/mockData';
import { merchandisePurchaseService, productInventoryService, supplierService } from '../../../services';
import { useApp } from '../../../contexts/AppContext';
import type { MerchandisePurchase, MerchandisePurchaseItem, Product, Supplier } from '../../../types';
import { roleService } from '../../../services/roleService';

const today = () => new Date().toISOString().slice(0, 10);
const csvCell = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;

export default function PurchasesPage() {
  const { notifyAdmin, role } = useApp();
  const canCreate = Boolean(role && roleService.can(role, 'inventory', 'create'));
  const canEdit = Boolean(role && roleService.can(role, 'inventory', 'edit'));
  const [purchases, setPurchases] = useState<MerchandisePurchase[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [formOpen, setFormOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedPurchase, setSelectedPurchase] = useState<MerchandisePurchase | null>(null);
  const [confirmVoid, setConfirmVoid] = useState<MerchandisePurchase | null>(null);
  const [supplierId, setSupplierId] = useState('');
  const [date, setDate] = useState(today());
  const [status, setStatus] = useState<MerchandisePurchase['status']>('Registrada');
  const [items, setItems] = useState<MerchandisePurchaseItem[]>([]);

  useEffect(() => {
    Promise.all([merchandisePurchaseService.list(), supplierService.list(), productInventoryService.list()])
      .then(([purchaseRows, supplierRows, productRows]) => { setPurchases(purchaseRows); setSuppliers(supplierRows); setProducts(productRows); })
      .catch(() => setLoadError('No se pudieron cargar las compras y proveedores. Intenta recargar la página.'))
      .finally(() => setLoading(false));
  }, []);

  const activeSuppliers = suppliers.filter((supplier) => supplier.status === 'Activo');
  const selectedSupplier = activeSuppliers.find((supplier) => supplier.id === supplierId);
  const suppliedProducts = products.filter((product) => product.status !== 'Inactivo' && selectedSupplier?.productIds.includes(product.id));
  const remainingProducts = suppliedProducts.filter((product) => !items.some((item) => item.productId === product.id));
  const filteredPurchases = useMemo(() => purchases.filter((purchase) =>
    (statusFilter === 'Todos' || purchase.status === statusFilter) &&
    `${purchase.id} ${purchase.supplier} ${purchase.items.map((item) => item.productName).join(' ')}`.toLowerCase().includes(query.toLowerCase())), [purchases, statusFilter, query]);
  const total = items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);
  const totalUnits = items.reduce((sum, item) => sum + item.quantity, 0);
  const activePurchases = purchases.filter((purchase) => purchase.status !== 'Anulada');
  const purchaseTotal = activePurchases.reduce((sum, purchase) => sum + purchase.total, 0);

  const changeItem = (index: number, patch: Partial<MerchandisePurchaseItem>) => setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  const selectProduct = (index: number, productId: string) => {
    const product = suppliedProducts.find((entry) => entry.id === productId);
    if (items.some((item, itemIndex) => itemIndex !== index && item.productId === productId)) { setFormError('El producto ya está en otra línea de la compra.'); return; }
    if (product) changeItem(index, { productId, productName: product.name });
  };
  const changeSupplier = (id: string) => {
    setSupplierId(id);
    const supplier = activeSuppliers.find((entry) => entry.id === id);
    const firstProduct = products.find((product) => product.status !== 'Inactivo' && supplier?.productIds.includes(product.id));
    setItems(firstProduct ? [{ productId: firstProduct.id, productName: firstProduct.name, quantity: 1, unitCost: 0 }] : []);
  };
  const addItem = () => {
    setItems((current) => {
      const firstProduct = suppliedProducts.find((product) => !current.some((item) => item.productId === product.id));
      return firstProduct ? [...current, { productId: firstProduct.id, productName: firstProduct.name, quantity: 1, unitCost: 0 }] : current;
    });
  };
  const closeForm = () => { setFormOpen(false); setFormError(''); };
  const openForm = () => {
    const firstSupplier = activeSuppliers[0];
    const firstProduct = products.find((product) => product.status !== 'Inactivo' && firstSupplier?.productIds.includes(product.id));
    setSupplierId(firstSupplier?.id || ''); setDate(today()); setStatus('Registrada');
    setItems(firstProduct ? [{ productId: firstProduct.id, productName: firstProduct.name, quantity: 1, unitCost: 0 }] : []);
    setFormError(''); setSuccess(''); setFormOpen(true);
  };

  const savePurchase = async (event: React.FormEvent) => {
    event.preventDefault(); setFormError('');
    if (!selectedSupplier || !date || !items.length || items.some((item) => !selectedSupplier.productIds.includes(item.productId) || !Number.isInteger(item.quantity) || item.quantity <= 0 || !Number.isFinite(item.unitCost) || item.unitCost <= 0)) {
      setFormError('Selecciona un proveedor con productos asignados. Valida cantidades enteras y costos mayores que cero.'); return;
    }
    try {
      const saved = await merchandisePurchaseService.create({ supplierId: selectedSupplier.id, supplier: selectedSupplier.name, date, items, total, status });
      setPurchases((current) => [saved, ...current]); setFormOpen(false); setSuccess('Compra guardada en PostgreSQL. El stock se actualizó según el estado recibido.');
      notifyAdmin({ dedupeKey: `purchase-created:${saved.id}`, type: 'success', title: 'Compra de mercancía registrada', entity: `${saved.id} · ${saved.supplier} · ${formatQ(saved.total)}`, message: `Se registró una compra con ${saved.items.length} producto(s) y ${saved.items.reduce((sum, item) => sum + item.quantity, 0)} unidad(es).`, nextAction: 'Consultar el detalle en el historial de compras.', actionTo: '/admin/purchases' });
    } catch (cause) { setFormError(cause instanceof Error ? cause.message : 'No se pudo guardar la compra. Intenta nuevamente.'); }
  };

  const exportPurchases = () => {
    const rows: (string | number)[][] = [['Compra', 'Proveedor', 'Fecha', 'Producto', 'Cantidad', 'Costo unitario (Q)', 'Subtotal (Q)', 'Total compra (Q)', 'Estado']];
    filteredPurchases.forEach((purchase) => purchase.items.forEach((item) => rows.push([purchase.id, purchase.supplier, purchase.date, item.productName, item.quantity, item.unitCost.toFixed(2), (item.quantity * item.unitCost).toFixed(2), purchase.total.toFixed(2), purchase.status])));
    const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = `compras-mercaderia-${today()}.csv`; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const voidPurchase = async () => {
    if (!confirmVoid) return;
    try {
      await merchandisePurchaseService.updateStatus(confirmVoid.id, 'Anulada');
      setPurchases((current) => current.map((purchase) => purchase.id === confirmVoid.id ? { ...purchase, status: 'Anulada' } : purchase));
      setSuccess('Compra anulada en PostgreSQL; el movimiento de stock se revirtió.'); setConfirmVoid(null);
    } catch (cause) { setLoadError(cause instanceof Error ? cause.message : 'No se pudo anular la compra. Intenta nuevamente.'); }
  };

  return <div className="purchases-page">
    <div className="admin-page-heading"><div><span className="eyebrow">Abastecimiento NEXO · PostgreSQL</span><h1>Compras de mercancía</h1><p>Registra las compras según los productos asociados a cada proveedor.</p></div><div className="heading-actions"><button className="button button-outline" onClick={exportPurchases} disabled={!filteredPurchases.length}><Download size={16} /> Exportar CSV</button>{canCreate && <button className="button button-primary" onClick={openForm}><Plus size={17} /> Registrar compra</button>}</div></div>
    {success && <div className="purchase-feedback success" role="status"><Check size={17} />{success}</div>}{loadError && <div className="purchase-feedback error" role="alert">{loadError}</div>}
    <div className="purchases-stats"><div><span>Compras registradas</span><strong>{purchases.length}</strong><small>Historial guardado</small></div><div><span>Total de abastecimiento</span><strong>{formatQ(purchaseTotal)}</strong><small>Excluye compras anuladas</small></div><div><span>Productos comprados</span><strong>{activePurchases.reduce((sum, purchase) => sum + purchase.items.reduce((itemsSum, item) => itemsSum + item.quantity, 0), 0)}</strong><small>Unidades no anuladas</small></div></div>
    <section className="panel purchases-panel"><div className="panel-heading"><div><h2>Historial de compras</h2><span>Las compras se registran de forma independiente a los pedidos de clientes.</span></div></div><div className="module-toolbar purchases-toolbar"><label className="search-box admin-search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar compra, proveedor o producto..." />{query && <button type="button" onClick={() => setQuery('')} aria-label="Limpiar búsqueda"><X size={15} /></button>}</label><label className="purchases-status-filter">Estado<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>Todos</option><option>Registrada</option><option>Pendiente</option><option>Anulada</option></select></label></div>
      {loading ? <div className="purchases-empty">Cargando compras...</div> : filteredPurchases.length ? <div className="data-table purchases-table"><div className="table-head"><span>Compra</span><span>Proveedor</span><span>Fecha</span><span>Productos</span><span>Total</span><span>Estado</span><span>Acciones</span></div>{filteredPurchases.map((purchase) => <div className="table-row" key={purchase.id}><strong>{purchase.id}</strong><span className="name-cell"><span className="table-avatar">{purchase.supplier.slice(0, 2)}</span><strong>{purchase.supplier}</strong></span><span>{new Date(`${purchase.date}T12:00:00`).toLocaleDateString('es-GT')}</span><span>{purchase.items.length} productos · {purchase.items.reduce((sum, item) => sum + item.quantity, 0)} uds.</span><strong>{formatQ(purchase.total)}</strong><span className={`status-pill ${purchase.status === 'Registrada' ? 'success' : purchase.status === 'Anulada' ? 'danger' : 'warning'}`}><i />{purchase.status}</span><div className="table-actions"><button className="icon-button" aria-label={`Ver compra ${purchase.id}`} title="Ver detalle" onClick={() => setSelectedPurchase(purchase)}><Eye size={15} /></button>{canEdit && purchase.status !== 'Anulada' && <button className="icon-button danger" aria-label={`Anular compra ${purchase.id}`} title="Anular con confirmación" onClick={() => setConfirmVoid(purchase)}><Ban size={15} /></button>}</div></div>)}</div> : <div className="purchases-empty"><Package size={28} /><strong>{purchases.length ? 'No hay compras que coincidan' : 'Aún no hay compras registradas'}</strong><span>{purchases.length ? 'Prueba con otra búsqueda o cambia el filtro de estado.' : 'Registra una compra para comenzar el historial.'}</span>{canCreate && !purchases.length && <button className="button button-outline" onClick={openForm}><Plus size={15} /> Registrar compra</button>}</div>}
      <div className="purchases-count">Mostrando {filteredPurchases.length} de {purchases.length} compras</div>
    </section>
    {(selectedPurchase || confirmVoid) && <div className="modal-backdrop" onClick={() => { setSelectedPurchase(null); setConfirmVoid(null); }}><div className="modal crud-modal" role="dialog" aria-modal="true" aria-labelledby="purchase-action-title" onClick={(event) => event.stopPropagation()}><div className="modal-header"><div><span className="eyebrow">{selectedPurchase ? 'Detalle de compra' : 'Confirmar anulación'}</span><h2 id="purchase-action-title">{selectedPurchase ? selectedPurchase.id : 'Anular compra'}</h2></div><button className="icon-button" aria-label="Cerrar" onClick={() => { setSelectedPurchase(null); setConfirmVoid(null); }}><X size={18} /></button></div>{selectedPurchase ? <div className="crud-purchase-detail"><div className="crud-detail-list"><div><span>Proveedor</span><strong>{selectedPurchase.supplier}</strong></div><div><span>Fecha</span><strong>{selectedPurchase.date}</strong></div><div><span>Estado</span><strong>{selectedPurchase.status}</strong></div></div><div className="crud-purchase-items">{selectedPurchase.items.map((item) => <div key={item.productId}><span>{item.productName} · {item.quantity} × {formatQ(item.unitCost)}</span><strong>{formatQ(item.quantity * item.unitCost)}</strong></div>)}<div><strong>Total</strong><strong>{formatQ(selectedPurchase.total)}</strong></div></div></div> : <div className="crud-confirm"><p>¿Confirmas anular esta compra? Se conservará en el historial para auditoría local.</p><div className="modal-actions"><button className="button button-outline" onClick={() => setConfirmVoid(null)}>Volver</button><button className="button button-primary" onClick={voidPurchase}>Confirmar anulación</button></div></div>}</div></div>}
    {formOpen && <div className="modal-backdrop purchase-backdrop" onClick={closeForm}><div className="modal purchase-modal" role="dialog" aria-modal="true" aria-labelledby="purchase-title" onClick={(event) => event.stopPropagation()}><div className="purchase-modal-header"><div className="purchase-modal-icon"><ShoppingCart size={20} /></div><div><span className="eyebrow">Abastecimiento · PostgreSQL</span><h2 id="purchase-title">Registrar compra</h2><p>El catálogo de productos se limita al proveedor seleccionado.</p></div><button type="button" className="icon-button" aria-label="Cerrar formulario" onClick={closeForm}><X size={18} /></button></div><form className="purchase-form" onSubmit={savePurchase} noValidate>
      <div className="purchase-form-grid"><label className="field"><span>Proveedor</span><select value={supplierId} onChange={(event) => changeSupplier(event.target.value)} required><option value="">Selecciona proveedor</option>{activeSuppliers.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label><label className="field"><span>Fecha de compra</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></label><label className="field"><span>Estado</span><select value={status} onChange={(event) => setStatus(event.target.value as MerchandisePurchase['status'])}><option>Registrada</option><option>Pendiente</option></select></label></div>
      <div className="purchase-items-heading"><div><strong>Productos del proveedor</strong><span>{selectedSupplier ? `${suppliedProducts.length} productos disponibles` : 'Selecciona un proveedor para ver su catálogo.'}</span></div><button type="button" className="button button-outline" onClick={addItem} disabled={!remainingProducts.length}><Plus size={15} /> {remainingProducts.length ? 'Agregar producto' : 'Todos agregados'}</button></div>
      {selectedSupplier && suppliedProducts.length === 0 && <div className="purchase-catalog-empty">Este proveedor aún no tiene productos asociados. Completa sus productos en el catálogo de proveedores.</div>}
      {selectedSupplier && suppliedProducts.length > 0 && remainingProducts.length === 0 && <div className="purchase-catalog-empty">Todos los productos de este proveedor ya están en la compra. Asocia otro producto al proveedor para agregar otra línea.</div>}
      <div className="purchase-items-list">{items.map((item, index) => <div className="purchase-item-row" key={`${index}-${item.productId}`}><label className="field purchase-product-field"><span>Producto</span><select value={item.productId} onChange={(event) => selectProduct(index, event.target.value)}>{suppliedProducts.map((product) => <option key={product.id} value={product.id}>{product.name} · {product.sku}</option>)}</select></label><label className="field"><span>Cantidad</span><input type="number" min="1" step="1" value={item.quantity} onChange={(event) => changeItem(index, { quantity: Number(event.target.value) })} /></label><label className="field"><span>Costo unitario (Q)</span><input type="number" min="0.01" step="0.01" value={item.unitCost || ''} placeholder="0.00" onChange={(event) => changeItem(index, { unitCost: Number(event.target.value) })} /></label><div className="purchase-subtotal"><span>Subtotal</span><strong>{formatQ(item.quantity * item.unitCost)}</strong></div><button type="button" className="icon-button danger purchase-remove" disabled={items.length === 1} aria-label={`Quitar ${item.productName}`} onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}><Trash2 size={16} /></button></div>)}</div>
      <div className="purchase-total"><span>Total de compra · {totalUnits} unidades</span><strong>{formatQ(total)}</strong></div>
      {formError && <div className="purchase-feedback error" role="alert">{formError}</div>}<p className="purchase-demo-note">La compra se persiste. Al registrarla como recibida aumenta el inventario; al anularla se revierte ese movimiento.</p><div className="modal-actions"><button type="button" className="button button-outline" onClick={closeForm}>Cancelar</button><button type="submit" className="button button-primary"><Check size={16} /> Guardar compra</button></div>
      </form></div></div>}
  </div>;
}
