import { useEffect, useMemo, useState } from 'react';
import { Check, Eye, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { formatQ } from '../../../data/mockData';
import { brandService, productInventoryService } from '../../../services';
import type { Brand, Product } from '../../../types';

type BrandDraft = Omit<Brand, 'id'>;
type DialogMode = 'create' | 'edit' | 'view' | 'delete' | null;
const emptyBrand: BrandDraft = { name: '', description: '', contact: '', website: '', status: 'Activa' };

export default function BrandsPage() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todas');
  const [mode, setMode] = useState<DialogMode>(null);
  const [activeId, setActiveId] = useState('');
  const [draft, setDraft] = useState<BrandDraft>(emptyBrand);
  const [reassignTo, setReassignTo] = useState('unassigned');
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    const [brandRows, productRows] = await Promise.all([brandService.list(), productInventoryService.list()]);
    setBrands(brandRows); setProducts(productRows);
  };
  useEffect(() => { reload().catch(() => setError('No se pudieron cargar las marcas. Intenta recargar la vista.')).finally(() => setLoading(false)); }, []);
  useEffect(() => {
    if (!mode) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape' && !busy) closeDialog(); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [mode, busy]);

  const productCounts = useMemo(() => products.reduce<Record<string, number>>((counts, product) => {
    if (product.brandId) counts[product.brandId] = (counts[product.brandId] || 0) + 1;
    return counts;
  }, {}), [products]);
  const filtered = useMemo(() => brands.filter((brand) => (statusFilter === 'Todas' || brand.status === statusFilter) && `${brand.name} ${brand.description || ''} ${brand.contact || ''} ${brand.website || ''}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())), [brands, query, statusFilter]);
  const activeBrand = brands.find((brand) => brand.id === activeId) || null;
  const linkedProducts = activeBrand ? products.filter((product) => product.brandId === activeBrand.id) : [];

  const closeDialog = () => { setMode(null); setActiveId(''); setError(''); setBusy(false); };
  const openCreate = () => { setDraft(emptyBrand); setActiveId(''); setFeedback(''); setError(''); setMode('create'); };
  const openEdit = (brand: Brand) => { setDraft({ name: brand.name, description: brand.description || '', contact: brand.contact || '', website: brand.website || '', status: brand.status }); setActiveId(brand.id); setError(''); setMode('edit'); };
  const openView = (brand: Brand) => { setActiveId(brand.id); setError(''); setMode('view'); };
  const openDelete = (brand: Brand) => {
    const options = brands.filter((entry) => entry.id !== brand.id && entry.status === 'Activa');
    setActiveId(brand.id); setReassignTo(options[0]?.id || 'unassigned'); setError(''); setMode('delete');
  };

  const saveBrand = async (event: React.FormEvent) => {
    event.preventDefault(); setError('');
    const normalized = { ...draft, name: draft.name.trim(), description: draft.description?.trim() || '', contact: draft.contact?.trim() || '', website: draft.website?.trim() || '' };
    if (!normalized.name) { setError('El nombre de la marca es obligatorio.'); return; }
    setBusy(true);
    try {
      if (mode === 'create') { await brandService.create(normalized); setFeedback('Marca creada durante esta sesión.'); }
      else { await brandService.update(activeId, normalized); setFeedback('Cambios de la marca guardados durante esta sesión.'); }
      await reload(); closeDialog();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo guardar la marca.'); }
    finally { setBusy(false); }
  };

  const deleteBrand = async () => {
    if (!activeBrand) return;
    setBusy(true); setError('');
    try {
      const target = reassignTo === 'unassigned' ? null : reassignTo;
      if (productCounts[activeBrand.id]) await brandService.delete(activeBrand.id, target);
      else await brandService.delete(activeBrand.id);
      const count = productCounts[activeBrand.id] || 0;
      await reload(); setFeedback(count ? `Marca eliminada; ${count} producto(s) reasignado(s).` : 'Marca eliminada.'); closeDialog();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo eliminar la marca.'); }
    finally { setBusy(false); }
  };

  return <div className="brands-page">
    <div className="admin-page-heading"><div><span className="eyebrow">Catálogo · Datos de demostración</span><h1>Marcas</h1><p>Organiza las marcas asociadas con los productos de tu inventario.</p></div><div className="heading-actions"><button className="button button-primary" onClick={openCreate}><Plus size={17} /> Nueva marca</button></div></div>
    {feedback && <div className="brand-feedback" role="status">{feedback}<button type="button" aria-label="Cerrar mensaje" onClick={() => setFeedback('')}><X size={15} /></button></div>}
    <div className="brand-stats"><article><span>Marcas registradas</span><strong>{brands.length}</strong></article><article><span>Marcas activas</span><strong>{brands.filter((brand) => brand.status === 'Activa').length}</strong></article><article><span>Productos con marca</span><strong>{products.filter((product) => product.brandId).length}</strong></article></div>
    <section className="panel brands-panel"><div className="panel-heading"><div><h2>Listado de marcas</h2><span>{filtered.length} marcas encontradas</span></div></div><div className="module-toolbar brand-toolbar"><label className="search-box admin-search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar marcas, contacto o sitio web…" />{query && <button type="button" aria-label="Limpiar búsqueda" onClick={() => setQuery('')}><X size={15} /></button>}</label><label className="brand-status-filter"><span>Estado</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>Todas</option><option>Activa</option><option>Inactiva</option></select></label></div>
      {loading ? <div className="brand-empty">Cargando marcas…</div> : filtered.length ? <div className="data-table brand-table"><div className="table-head"><span>Marca</span><span>Descripción</span><span>Contacto / web</span><span>Productos</span><span>Estado</span><span>Acciones</span></div>{filtered.map((brand) => <div className="table-row" key={brand.id}><strong>{brand.name}</strong><span>{brand.description || '—'}</span><span>{brand.contact || brand.website || '—'}</span><span>{productCounts[brand.id] || 0}</span><span className={`status-pill ${brand.status === 'Activa' ? 'success' : 'neutral'}`}><i />{brand.status}</span><div className="table-actions"><button type="button" className="icon-button" aria-label={`Ver marca ${brand.name}`} title="Ver detalle y productos" onClick={() => openView(brand)}><Eye size={15} /></button><button type="button" className="icon-button" aria-label={`Editar marca ${brand.name}`} title="Editar" onClick={() => openEdit(brand)}><Pencil size={15} /></button><button type="button" className="icon-button danger" aria-label={`Eliminar marca ${brand.name}`} title="Eliminar con protección de productos" onClick={() => openDelete(brand)}><Trash2 size={15} /></button></div></div>)}</div> : <div className="brand-empty"><Search size={29} /><strong>{query || statusFilter !== 'Todas' ? 'No encontramos marcas' : 'Aún no hay marcas registradas'}</strong><span>{query || statusFilter !== 'Todas' ? 'Prueba otros filtros.' : 'Crea una marca para asociarla con tus productos.'}</span>{!brands.length && <button className="button button-outline" onClick={openCreate}><Plus size={15} /> Nueva marca</button>}</div>}
    </section>

    {(mode === 'create' || mode === 'edit') && <div className="modal-backdrop" onClick={() => { if (!busy) closeDialog(); }}><div className="modal brand-modal" role="dialog" aria-modal="true" aria-labelledby="brand-form-title" onClick={(event) => event.stopPropagation()}><div className="modal-header"><div><span className="eyebrow">{mode === 'create' ? 'Nueva marca' : 'Actualizar marca'}</span><h2 id="brand-form-title">{mode === 'create' ? 'Registrar marca' : `Editar ${draft.name}`}</h2></div><button type="button" className="icon-button" aria-label="Cerrar formulario" disabled={busy} onClick={closeDialog}><X size={18} /></button></div><form className="brand-form" onSubmit={saveBrand}><label className="field"><span>Nombre *</span><input required maxLength={80} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Nombre de la marca" /></label><label className="field"><span>Descripción (opcional)</span><textarea rows={3} maxLength={240} value={draft.description || ''} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="Productos o especialidad de la marca" /></label><div className="brand-form-grid"><label className="field"><span>Contacto (opcional)</span><input maxLength={120} value={draft.contact || ''} onChange={(event) => setDraft({ ...draft, contact: event.target.value })} placeholder="Correo o teléfono" /></label><label className="field"><span>Sitio web (opcional)</span><input type="url" maxLength={180} value={draft.website || ''} onChange={(event) => setDraft({ ...draft, website: event.target.value })} placeholder="https://ejemplo.com" /></label></div><label className="field"><span>Estado</span><select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as Brand['status'] })}><option>Activa</option><option>Inactiva</option></select></label>{error && <div className="brand-form-error" role="alert">{error}</div>}<p className="brand-form-note">Los cambios se guardan localmente durante esta sesión de demostración.</p><div className="modal-actions"><button type="button" className="button button-outline" disabled={busy} onClick={closeDialog}>Cancelar</button><button type="submit" className="button button-primary" disabled={busy}><Check size={16} /> {busy ? 'Guardando…' : 'Guardar marca'}</button></div></form></div></div>}

    {mode === 'view' && activeBrand && <div className="modal-backdrop" onClick={closeDialog}><div className="modal brand-modal brand-detail-modal" role="dialog" aria-modal="true" aria-labelledby="brand-detail-title" onClick={(event) => event.stopPropagation()}><div className="modal-header"><div><span className="eyebrow">Detalle de marca</span><h2 id="brand-detail-title">{activeBrand.name}</h2></div><button type="button" className="icon-button" aria-label="Cerrar detalle" onClick={closeDialog}><X size={18} /></button></div><dl className="brand-detail-grid"><div><dt>Descripción</dt><dd>{activeBrand.description || 'Sin descripción'}</dd></div><div><dt>Contacto</dt><dd>{activeBrand.contact || 'No indicado'}</dd></div><div><dt>Sitio web</dt><dd>{activeBrand.website ? <a href={activeBrand.website} target="_blank" rel="noreferrer">{activeBrand.website}</a> : 'No indicado'}</dd></div><div><dt>Estado</dt><dd>{activeBrand.status}</dd></div><div><dt>Productos asociados</dt><dd>{linkedProducts.length}</dd></div></dl><div className="brand-linked-products"><h3>Productos asociados</h3>{linkedProducts.length ? <div className="data-table"><div className="table-head"><span>Producto</span><span>SKU</span><span>Categoría</span><span>Precio</span><span>Stock</span></div>{linkedProducts.map((product) => <div className="table-row" key={product.id}><strong>{product.name}</strong><span>{product.sku}</span><span>{product.category}</span><strong>{formatQ(product.price)}</strong><span>{product.stock}</span></div>)}</div> : <p>Esta marca todavía no está asociada con productos.</p>}</div><div className="modal-actions"><button className="button button-outline" onClick={closeDialog}>Cerrar</button><button className="button button-primary" onClick={() => openEdit(activeBrand)}><Pencil size={15} /> Editar marca</button></div></div></div>}

    {mode === 'delete' && activeBrand && <div className="modal-backdrop" onClick={() => { if (!busy) closeDialog(); }}><div className="modal brand-modal" role="dialog" aria-modal="true" aria-labelledby="brand-delete-title" onClick={(event) => event.stopPropagation()}><div className="modal-header"><div><span className="eyebrow">Confirmar eliminación</span><h2 id="brand-delete-title">Eliminar {activeBrand.name}</h2></div><button type="button" className="icon-button" aria-label="Cerrar confirmación" disabled={busy} onClick={closeDialog}><X size={18} /></button></div>{productCounts[activeBrand.id] ? <div className="brand-delete-copy"><p>Esta marca tiene <strong>{productCounts[activeBrand.id]} producto(s) asociado(s)</strong>. Reasígnalos para conservar los productos y su inventario:</p><label className="field"><span>Reasignar a</span><select value={reassignTo} onChange={(event) => setReassignTo(event.target.value)}><option value="unassigned">Sin marca</option>{brands.filter((brand) => brand.id !== activeBrand.id && brand.status === 'Activa').map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select></label><p className="brand-delete-note">La marca se eliminará y los productos seguirán en el inventario.</p></div> : <div className="brand-delete-copy"><p>¿Confirmas eliminar esta marca? No tiene productos asociados.</p></div>}{error && <div className="brand-form-error" role="alert">{error}</div>}<div className="modal-actions"><button className="button button-outline" disabled={busy} onClick={closeDialog}>Cancelar</button><button className="button button-primary" disabled={busy} onClick={() => void deleteBrand()}><Trash2 size={15} /> {busy ? 'Eliminando…' : 'Confirmar eliminación'}</button></div></div></div>}
  </div>;
}
