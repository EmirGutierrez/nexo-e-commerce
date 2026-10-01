import { useEffect, useMemo, useState } from 'react';
import { Archive, Check, Eye, Mail, Pencil, Phone, Plus, Search, Trash2, Truck, X } from 'lucide-react';
import { formatQ } from '../../../data/mockData';
import { merchandisePurchaseService, productInventoryService, supplierService } from '../../../services';
import type { MerchandisePurchase, Product, Supplier } from '../../../types';
import { roleService } from '../../../services/roleService';
import { useApp } from '../../../contexts/AppContext';

type SupplierDraft = Omit<Supplier, 'id'>;
type DialogMode = 'create' | 'edit' | 'view' | 'archive' | 'delete' | null;
const blankSupplier: SupplierDraft = { name: '', contactPerson: '', phone: '', email: '', status: 'Activo', productIds: [] };
const dateLabel = (date?: string) => date ? new Date(`${date}T12:00:00`).toLocaleDateString('es-GT') : 'Sin pedidos';

export default function SuppliersPage() {
  const { role } = useApp();
  const canCreate = Boolean(role && roleService.can(role, 'suppliers', 'create'));
  const canEdit = Boolean(role && roleService.can(role, 'suppliers', 'edit'));
  const canDelete = Boolean(role && roleService.can(role, 'suppliers', 'delete'));
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [purchases, setPurchases] = useState<MerchandisePurchase[]>([]);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<DialogMode>(null);
  const [active, setActive] = useState<Supplier | null>(null);
  const [draft, setDraft] = useState<SupplierDraft>(blankSupplier);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    const [supplierRows, productRows, purchaseRows] = await Promise.all([supplierService.list(), productInventoryService.list(), merchandisePurchaseService.list()]);
    setSuppliers(supplierRows); setProducts(productRows); setPurchases(purchaseRows);
  };
  useEffect(() => { reload().catch(() => setError('No se pudieron cargar los proveedores.')).finally(() => setLoading(false)); }, []);
  useEffect(() => {
    if (!mode) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape' && !busy) closeDialog(); };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, [mode, busy]);

  const filtered = useMemo(() => suppliers.filter((supplier) => (statusFilter === 'Todos' || supplier.status === statusFilter) && `${supplier.name} ${supplier.contactPerson || ''} ${supplier.phone || ''} ${supplier.email || ''}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())), [suppliers, statusFilter, query]);
  const getPurchases = (supplier: Supplier) => purchases.filter((purchase) => purchase.supplierId === supplier.id || (!purchase.supplierId && purchase.supplier === supplier.name));
  const latestPurchase = (supplier: Supplier) => getPurchases(supplier).map((purchase) => purchase.date).sort().at(-1) || supplier.lastOrder;
  const productNames = (supplier: Supplier) => supplier.productIds.map((id) => products.find((product) => product.id === id)?.name).filter(Boolean) as string[];

  const closeDialog = () => { setMode(null); setActive(null); setError(''); setBusy(false); };
  const openCreate = () => { setDraft({ ...blankSupplier, productIds: [] }); setActive(null); setError(''); setFeedback(''); setMode('create'); };
  const openEdit = (supplier: Supplier) => { setActive(supplier); setDraft({ ...supplier, productIds: [...supplier.productIds] }); setError(''); setMode('edit'); };
  const openAction = (supplier: Supplier, action: 'view' | 'archive' | 'delete') => { setActive(supplier); setError(''); setMode(action); };
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setError('');
    const normalized = { ...draft, name: draft.name.trim(), contactPerson: draft.contactPerson?.trim() || '', phone: draft.phone?.trim() || '', email: draft.email?.trim() || '', productIds: [...new Set(draft.productIds)] };
    if (!normalized.name) { setError('El nombre de la empresa es obligatorio.'); return; }
    setBusy(true);
    try {
      if (mode === 'create') { await supplierService.create(normalized); setFeedback('Proveedor guardado en PostgreSQL.'); }
      else if (active) { await supplierService.update(active.id, normalized); setFeedback('Proveedor actualizado en PostgreSQL.'); }
      await reload(); closeDialog();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo guardar el proveedor.'); }
    finally { setBusy(false); }
  };
  const doArchive = async () => {
    if (!active) return;
    setBusy(true); setError('');
    try { await supplierService.archive(active.id); await reload(); setFeedback('Proveedor archivado. Sus productos y compras se conservaron.'); closeDialog(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo archivar el proveedor.'); }
    finally { setBusy(false); }
  };
  const doDelete = async () => {
    if (!active) return;
    setBusy(true); setError('');
    try { await supplierService.delete(active.id); await reload(); setFeedback('Proveedor eliminado.'); closeDialog(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo eliminar el proveedor.'); }
    finally { setBusy(false); }
  };
  const toggleProduct = (id: string) => setDraft((current) => ({ ...current, productIds: current.productIds.includes(id) ? current.productIds.filter((productId) => productId !== id) : [...current.productIds, id] }));

  return <div className="suppliers-page">
    <div className="admin-page-heading"><div><span className="eyebrow">Abastecimiento · PostgreSQL</span><h1>Proveedores</h1><p>Administra empresas abastecedoras y los productos relacionados con cada una.</p></div><div className="heading-actions">{canCreate && <button className="button button-primary" onClick={openCreate}><Plus size={17} /> Nuevo proveedor</button>}</div></div>
    {feedback && <div className="supplier-feedback" role="status">{feedback}<button type="button" aria-label="Cerrar mensaje" onClick={() => setFeedback('')}><X size={15} /></button></div>}
    <div className="supplier-stats"><article><span>Proveedores</span><strong>{suppliers.length}</strong></article><article><span>Activos</span><strong>{suppliers.filter((supplier) => supplier.status === 'Activo').length}</strong></article><article><span>Productos abastecidos</span><strong>{new Set(suppliers.flatMap((supplier) => supplier.productIds)).size}</strong></article></div>
    <section className="panel suppliers-panel"><div className="panel-heading"><div><h2>Listado de proveedores</h2><span>{filtered.length} proveedores encontrados</span></div></div><div className="module-toolbar supplier-toolbar"><label className="search-box admin-search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar empresa, contacto o correo..." />{query && <button type="button" aria-label="Limpiar búsqueda" onClick={() => setQuery('')}><X size={15} /></button>}</label><label className="supplier-status-filter"><span>Estado</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>Todos</option><option>Activo</option><option>Inactivo</option></select></label></div>
      {loading ? <div className="supplier-empty">Cargando proveedores...</div> : filtered.length ? <div className="data-table supplier-table"><div className="table-head"><span>Empresa</span><span>Contacto</span><span>Productos abastecidos</span><span>Último pedido</span><span>Estado</span><span>Acciones</span></div>{filtered.map((supplier) => { const names = productNames(supplier); return <div className="table-row" key={supplier.id}><span className="name-cell"><span className="table-avatar"><Truck size={14} /></span><strong>{supplier.name}</strong></span><div className="supplier-contact"><strong>{supplier.contactPerson || 'Sin persona de contacto'}</strong><span>{supplier.phone && <><Phone size={12} /> {supplier.phone}</>}</span><span>{supplier.email && <><Mail size={12} /> {supplier.email}</>}</span></div><span title={names.join(', ')}>{names.length ? `${names.slice(0, 2).join(', ')}${names.length > 2 ? ` +${names.length - 2}` : ''}` : 'Sin productos'}</span><span>{dateLabel(latestPurchase(supplier))}</span><span className={`status-pill ${supplier.status === 'Activo' ? 'success' : 'neutral'}`}><i />{supplier.status}</span><div className="table-actions"><button type="button" className="icon-button" aria-label={`Ver proveedor ${supplier.name}`} title="Ver detalle" onClick={() => openAction(supplier, 'view')}><Eye size={15} /></button>{canEdit && <button type="button" className="icon-button" aria-label={`Editar proveedor ${supplier.name}`} title="Editar" onClick={() => openEdit(supplier)}><Pencil size={15} /></button>}{canEdit && supplier.status === 'Activo' && <button type="button" className="icon-button" aria-label={`Archivar proveedor ${supplier.name}`} title="Archivar" onClick={() => openAction(supplier, 'archive')}><Archive size={15} /></button>}{canDelete && <button type="button" className="icon-button danger" aria-label={`Eliminar proveedor ${supplier.name}`} title={supplier.productIds.length || getPurchases(supplier).length ? 'Protegido por relaciones; puedes archivarlo' : 'Eliminar'} onClick={() => openAction(supplier, 'delete')}><Trash2 size={15} /></button>}</div></div>; })}</div> : <div className="supplier-empty"><Truck size={28} /><strong>{query || statusFilter !== 'Todos' ? 'No encontramos proveedores' : 'Aún no hay proveedores'}</strong><span>{query || statusFilter !== 'Todos' ? 'Prueba con otra búsqueda o filtro.' : 'Registra un proveedor para asociarle productos existentes.'}</span>{!suppliers.length && canCreate && <button className="button button-outline" onClick={openCreate}><Plus size={15} /> Nuevo proveedor</button>}</div>}
    </section>

    {(mode === 'create' || mode === 'edit') && <div className="modal-backdrop" onClick={() => !busy && closeDialog()}><div className="modal supplier-modal" role="dialog" aria-modal="true" aria-labelledby="supplier-form-title" onClick={(event) => event.stopPropagation()}><div className="modal-header"><div><span className="eyebrow">{mode === 'create' ? 'Nuevo proveedor' : 'Actualizar proveedor'}</span><h2 id="supplier-form-title">{mode === 'create' ? 'Registrar proveedor' : `Editar ${draft.name}`}</h2></div><button type="button" className="icon-button" aria-label="Cerrar formulario" disabled={busy} onClick={closeDialog}><X size={18} /></button></div><form className="supplier-form" onSubmit={save}><div className="supplier-form-grid"><label className="field"><span>Empresa / nombre *</span><input required maxLength={100} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Nombre de empresa" /></label><label className="field"><span>Persona de contacto</span><input maxLength={100} value={draft.contactPerson || ''} onChange={(event) => setDraft({ ...draft, contactPerson: event.target.value })} placeholder="Nombre de contacto" /></label><label className="field"><span>Teléfono</span><input type="tel" maxLength={30} value={draft.phone || ''} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} placeholder="+502 0000-0000" /></label><label className="field"><span>Correo</span><input type="email" maxLength={120} value={draft.email || ''} onChange={(event) => setDraft({ ...draft, email: event.target.value })} placeholder="contacto@empresa.gt" /></label><label className="field"><span>Estado</span><select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as Supplier['status'] })}><option>Activo</option><option>Inactivo</option></select></label></div><fieldset className="supplier-product-picker"><legend>Productos que abastece ({draft.productIds.length})</legend><span>Asocia elementos del catálogo que ya existen.</span>{products.length ? <div>{products.map((product) => <label key={product.id}><input type="checkbox" checked={draft.productIds.includes(product.id)} onChange={() => toggleProduct(product.id)} /><span><strong>{product.name}</strong><small>{product.sku} · {formatQ(product.price)} · Stock {product.stock}</small></span></label>)}</div> : <p>No hay productos disponibles.</p>}</fieldset>{error && <div className="supplier-error" role="alert">{error}</div>}<p className="supplier-note">El proveedor y sus asociaciones quedan guardados en PostgreSQL.</p><div className="modal-actions"><button type="button" className="button button-outline" disabled={busy} onClick={closeDialog}>Cancelar</button><button type="submit" className="button button-primary" disabled={busy}><Check size={16} /> {busy ? 'Guardando...' : 'Guardar proveedor'}</button></div></form></div></div>}

    {(mode === 'view' || mode === 'archive' || mode === 'delete') && active && <div className="modal-backdrop" onClick={closeDialog}><div className="modal supplier-modal supplier-detail-modal" role="dialog" aria-modal="true" aria-labelledby="supplier-detail-title" onClick={(event) => event.stopPropagation()}><div className="modal-header"><div><span className="eyebrow">{mode === 'view' ? 'Detalle de proveedor' : mode === 'archive' ? 'Confirmar archivo' : 'Confirmar eliminación'}</span><h2 id="supplier-detail-title">{active.name}</h2></div><button type="button" className="icon-button" aria-label="Cerrar" onClick={closeDialog}><X size={18} /></button></div>{mode === 'view' ? <><dl className="supplier-detail-grid"><div><dt>Persona de contacto</dt><dd>{active.contactPerson || 'No indicada'}</dd></div><div><dt>Teléfono</dt><dd>{active.phone || 'No indicado'}</dd></div><div><dt>Correo</dt><dd>{active.email || 'No indicado'}</dd></div><div><dt>Último pedido</dt><dd>{dateLabel(latestPurchase(active))}</dd></div><div><dt>Estado</dt><dd>{active.status}</dd></div><div><dt>Compras registradas</dt><dd>{getPurchases(active).length}</dd></div></dl><div className="supplier-associated"><h3>Productos abastecidos</h3>{productNames(active).length ? <div className="data-table"><div className="table-head"><span>Producto</span><span>SKU</span><span>Categoría</span><span>Precio</span><span>Stock</span></div>{active.productIds.map((id) => products.find((product) => product.id === id)).filter((product): product is Product => Boolean(product)).map((product) => <div className="table-row" key={product.id}><strong>{product.name}</strong><span>{product.sku}</span><span>{product.category}</span><strong>{formatQ(product.price)}</strong><span>{product.stock}</span></div>)}</div> : <p>Este proveedor todavía no tiene productos asociados.</p>}</div><div className="modal-actions"><button className="button button-outline" onClick={closeDialog}>Cerrar</button><button className="button button-primary" onClick={() => openEdit(active)}><Pencil size={15} /> Editar</button></div></> : <><div className="supplier-confirm-copy">{mode === 'archive' ? <p>El proveedor quedará inactivo y no aparecerá para nuevas compras. Las asociaciones de producto y el historial se conservarán.</p> : <p>{active.productIds.length || getPurchases(active).length ? <>Este proveedor tiene <strong>{active.productIds.length} productos asociados</strong> y <strong>{getPurchases(active).length} compras</strong>. No se puede eliminar sin perder referencias; archívalo para conservarlas.</> : 'Este proveedor no tiene productos ni compras relacionadas. ¿Confirmas eliminarlo?'}</p>}</div>{error && <div className="supplier-error" role="alert">{error}</div>}<div className="modal-actions"><button className="button button-outline" disabled={busy} onClick={closeDialog}>Cancelar</button>{mode === 'archive' ? <button className="button button-primary" disabled={busy} onClick={() => void doArchive()}><Archive size={15} /> Confirmar archivo</button> : active.productIds.length || getPurchases(active).length ? <button className="button button-primary" disabled={busy} onClick={() => void doArchive()}><Archive size={15} /> Archivar proveedor</button> : <button className="button button-primary" disabled={busy} onClick={() => void doDelete()}><Trash2 size={15} /> Eliminar proveedor</button>}</div></>}</div></div>}
  </div>;
}
