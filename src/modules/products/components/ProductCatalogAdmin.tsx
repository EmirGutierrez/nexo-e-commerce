'use client';

import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { Check, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { adminTableService, productService, type AdminTableRecord } from '../../../services';
import { formatQ } from '../../../data/mockData';
import { useApp } from '../../../contexts/AppContext';
import { roleService } from '../../../services/roleService';

type ProductRow = { id: string; data: AdminTableRecord };
type Draft = { name: string; sku: string; category: string; price: string; stock: string; description: string; status: string };
const emptyDraft: Draft = { name: '', sku: '', category: 'General', price: '', stock: '0', description: '', status: 'Activo' };

async function compressProductImage(file: File): Promise<string> {
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(file); }
  catch { throw new Error('No se pudo abrir esta imagen. Elige un archivo JPG, PNG o WEBP.'); }
  try {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('No se pudo preparar la imagen.');
    for (const side of [640, 480, 360, 280]) {
      const ratio = Math.min(1, side / Math.max(bitmap.width, bitmap.height));
      canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
      canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.78, 0.65, 0.52]) {
        const image = canvas.toDataURL('image/jpeg', quality);
        const encoded = image.slice(image.indexOf(',') + 1);
        if (encoded.length * 0.75 <= 143_360 && image.length <= 200_000) return image;
      }
    }
  } finally { bitmap.close(); }
  throw new Error('La imagen no se pudo comprimir al tamaño permitido. Elige una foto más sencilla.');
}

export default function ProductCatalogAdmin() {
  const { role } = useApp();
  const [entries, setEntries] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ProductRow | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [image, setImage] = useState('');
  const [skuLoading, setSkuLoading] = useState(false);
  const canCreate = Boolean(role && roleService.can(role, 'products', 'create'));
  const canEdit = Boolean(role && roleService.can(role, 'products', 'edit'));
  const canDelete = Boolean(role && roleService.can(role, 'products', 'delete'));

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setEntries(await adminTableService.list('products')); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo cargar el catálogo.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const visible = useMemo(() => entries.filter(({ data }) =>
    [data.Producto, data.SKU, data.Categoría].some((value) => String(value ?? '').toLocaleLowerCase().includes(query.toLocaleLowerCase()))), [entries, query]);

  const openCreate = async () => {
    setEditing(null); setDraft(emptyDraft); setImage(''); setError(''); setNotice(''); setSkuLoading(true); setOpen(true);
    try { setDraft({ ...emptyDraft, sku: await productService.nextSku() }); }
    catch (cause) { setOpen(false); setError(cause instanceof Error ? cause.message : 'No se pudo reservar un SKU.'); }
    finally { setSkuLoading(false); }
  };
  const openEdit = (entry: ProductRow) => {
    setEditing(entry); setError(''); setNotice(''); setImage(String(entry.data.Imagen || ''));
    setDraft({ name: String(entry.data.Producto || ''), sku: String(entry.data.SKU || ''), category: String(entry.data.Categoría || 'General'),
      price: String(entry.data.Valor ?? ''), stock: String(entry.data.Existencias ?? 0),
      description: String(entry.data.Descripción || ''), status: String(entry.data.Estado || 'Activo') });
    setOpen(true);
  };

  const chooseImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    setError('');
    try { setImage(await compressProductImage(file)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo preparar la imagen.'); }
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError('');
    const price = Number(draft.price); const stock = Number(draft.stock);
    if (!draft.name.trim() || !draft.category.trim() || !draft.sku.trim()) { setError('Completa el nombre, la categoría y el SKU.'); return; }
    if (!Number.isFinite(price) || price < 0) { setError('El precio debe ser un número igual o mayor que cero.'); return; }
    if (!Number.isInteger(stock) || stock < 0) { setError('Las existencias deben ser un entero igual o mayor que cero.'); return; }
    if (!image.trim()) { setError('Selecciona una imagen del producto para guardarlo.'); return; }
    const row: AdminTableRecord = { Producto: draft.name.trim(), Marca: editing?.data.Marca || '', Categoría: draft.category.trim(), SKU: draft.sku,
      Valor: price, Existencias: stock, Imagen: image, Descripción: draft.description.trim(), Estado: draft.status };
    setBusy(true);
    try {
      if (editing) await adminTableService.update('products', editing.id, { ...editing.data, ...row });
      else await adminTableService.create('products', row);
      setOpen(false); setEditing(null); setImage(''); setNotice(editing ? 'Producto actualizado y compartido con la web y la app.' : 'Producto creado con SKU e imagen compartidos.');
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo guardar el producto.'); }
    finally { setBusy(false); }
  };

  const remove = async (entry: ProductRow) => {
    if (!window.confirm(`¿Eliminar «${String(entry.data.Producto)}»?`)) return;
    setError(''); setNotice('');
    try { await adminTableService.delete('products', entry.id); setNotice('Producto eliminado.'); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo eliminar el producto.'); }
  };

  return <div className="module-page">
    <div className="admin-page-heading"><div><span className="eyebrow">Gestión NEXO · Catálogo compartido</span><h1>Productos</h1><p>Administra nombre, precio, existencias, SKU e imagen desde una sola ficha.</p></div>
      {canCreate ? <button className="button button-primary" type="button" onClick={() => void openCreate()}><Plus size={17} /> Agregar producto</button> : null}</div>
    {notice ? <div className="crud-feedback" role="status">{notice}<button aria-label="Cerrar mensaje" onClick={() => setNotice('')}><X size={14} /></button></div> : null}
    {error && !open ? <div className="crud-error" role="alert">{error}</div> : null}
    <section className="panel product-admin-panel"><div className="panel-heading"><div><h2>Productos</h2><span>{entries.length} datos compartidos</span></div></div>
      <label className="search-box admin-search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar producto, SKU o categoría" />{query && <button type="button" onClick={() => setQuery('')} aria-label="Limpiar búsqueda"><X size={15} /></button>}</label>
      {loading ? <div className="empty-state">Cargando catálogo desde PostgreSQL…</div> : visible.length ? <div className="product-admin-list">{visible.map((entry) => <article className="product-admin-card" key={entry.id}>
        <img className="product-admin-image" src={String(entry.data.Imagen || '')} alt={String(entry.data.Producto || 'Producto')} />
        <div className="product-admin-copy"><h3>{String(entry.data.Producto || '')}</h3><p>{String(entry.data.SKU || '')} · {String(entry.data.Categoría || '')}</p>
          <small>{String(entry.data.Estado || '')} · {Number(entry.data.Existencias ?? 0)} unidades · {formatQ(Number(entry.data.Valor ?? 0))}</small></div>
        <div className="product-admin-actions">{canEdit ? <button className="button button-outline" type="button" onClick={() => openEdit(entry)}><Pencil size={14} /> Editar</button> : null}
          {canDelete ? <button className="button button-danger" type="button" onClick={() => void remove(entry)}><Trash2 size={14} /> Eliminar</button> : null}</div>
      </article>)}</div> : <div className="empty-state"><h3>{query ? 'No hay resultados' : 'No hay productos'}</h3><p>{query ? 'Prueba con otro nombre o SKU.' : 'Agrega el primer producto del catálogo.'}</p></div>}
    </section>
    {open ? <div className="modal-backdrop" onClick={() => !busy && setOpen(false)}><section className="modal crud-modal product-admin-modal" role="dialog" aria-modal="true" aria-labelledby="product-admin-title" onClick={(event) => event.stopPropagation()}>
      <div className="modal-header"><div><span className="eyebrow">Datos compartidos · PostgreSQL</span><h2 id="product-admin-title">{editing ? 'Editar producto' : 'Nuevo producto'}</h2></div><button className="icon-button" type="button" aria-label="Cerrar" onClick={() => setOpen(false)}><X size={18} /></button></div>
      <form className="crud-form" onSubmit={save} noValidate><div className="crud-fields">
        <label className="field"><span>Nombre del producto</span><input required maxLength={180} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
        <label className="field"><span>SKU · asignado automáticamente</span><input value={draft.sku || (skuLoading ? 'Reservando…' : '')} readOnly aria-readonly="true" /><small>El SKU queda reservado al abrir este formulario.</small></label>
        <label className="field"><span>Categoría</span><input required maxLength={100} value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })} /></label>
        <label className="field"><span>Precio (Q)</span><input type="number" min="0" step="0.01" value={draft.price} onChange={(event) => setDraft({ ...draft, price: event.target.value })} /></label>
        <label className="field"><span>Existencias</span><input type="number" min="0" step="1" value={draft.stock} onChange={(event) => setDraft({ ...draft, stock: event.target.value })} /></label>
        <label className="field"><span>Estado</span><select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value })}><option>Activo</option><option>Inactivo</option></select></label>
        <label className="field crud-field-wide"><span>Descripción</span><textarea maxLength={2000} rows={3} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label>
        <label className="field crud-field-wide"><span>Imagen del producto · requerida</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void chooseImage(event)} /><small>Se comprime y se guarda en PostgreSQL para compartirla con la app.</small></label>
        {image ? <img className="product-admin-upload-preview" src={image} alt="Vista previa del producto" /> : null}
      </div>{error ? <div className="crud-error" role="alert">{error}</div> : null}<div className="crud-form-note">El catálogo, la imagen y el inventario se comparten entre la web y la app.</div>
        <div className="modal-actions"><button className="button button-outline" type="button" onClick={() => setOpen(false)}>Cancelar</button><button className="button button-primary" disabled={busy || skuLoading}><Check size={16} /> {busy ? 'Guardando…' : 'Guardar producto'}</button></div>
      </form>
    </section></div> : null}
  </div>;
}
