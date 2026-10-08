import { useEffect, useMemo, useState } from 'react';
import { Archive, Ban, Check, ChevronDown, Download, Eye, Filter, Package, Pencil, Plus, Search, SlidersHorizontal, Trash2, X } from 'lucide-react';
import { adminTableService, brandService, productInventoryService, type AdminTableRecord } from '../../../services';
import { formatQ } from '../../../data/mockData';
import { useApp } from '../../../contexts/AppContext';
import { roleLabels, type Brand, type Role } from '../../../types';
import { roleService } from '../../../services/roleService';

export interface AdminModuleConfig {
  title: string;
  description: string;
  action?: string;
  formColumns?: string[];
  columns: string[];
  stats: { label: string; value: string; detail: string; tone?: string }[];
  rows: AdminTableRecord[];
}

type Entry = { id: string; data: AdminTableRecord };
type DialogMode = 'create' | 'edit' | 'view' | 'confirm' | null;
const transactionSections = new Set(['sales', 'transfers', 'payments', 'invoices']);
const statusChoices = (section: string) => section === 'products' || section === 'inventory'
  ? ['Activo', 'Inactivo'] : section === 'customers' ? ['Activo', 'Inactivo', 'Pendiente']
  : section === 'brands' ? ['Activa', 'Inactiva'] : section === 'purchases' ? ['Pendiente', 'Registrada', 'Anulada']
  : section === 'accounting' ? ['Registrado', 'Pendiente', 'Anulado'] : ['Activo', 'Inactivo'];
const viewOnlySections = new Set(['inventory/history']);
const updateOnlySections = new Set(['settings', 'profile']);
const numericColumns = new Set(['Valor', 'Ventas del mes', 'Total comprado', 'Pedidos', 'Usuarios', 'Productos', 'Existencias']);

export default function AdminCrudModule({ section, config }: { section: string; config: AdminModuleConfig }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [sortBy, setSortBy] = useState('');
  const [mode, setMode] = useState<DialogMode>(null);
  const [activeId, setActiveId] = useState('');
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState('');
  const [brandOptions, setBrandOptions] = useState<Brand[]>([]);
  const { reportLowStock, assignRole, user, role } = useApp();
  const isProductSection = section === 'products' || section === 'inventory';

  useEffect(() => {
    let active = true;
    setLoading(true); setLoadError(''); setQuery(''); setStatusFilter('Todos'); setSortBy('');
    adminTableService.list(section).then((rows) => {
      if (!active) return;
      setEntries(rows);
      if (section === 'inventory') productInventoryService.list().then((products) => { if (active) reportLowStock(products); });
    }).catch((cause) => { if (active) setLoadError(cause instanceof Error ? cause.message : 'No se pudieron cargar los registros desde PostgreSQL.'); })
      .finally(() => { if (active) setLoading(false); });
    if (section === 'products' || section === 'inventory') brandService.list().then((rows) => { if (active) setBrandOptions(rows); }).catch(() => { if (active) setBrandOptions([]); });
    return () => { active = false; };
  }, [section, reportLowStock]);

  const isTransactional = transactionSections.has(section);
  const readOnly = viewOnlySections.has(section);
  const editOnly = updateOnlySections.has(section);
  const formColumns = (config.formColumns || config.columns).filter((column) => {
    if (mode === 'create' && section === 'users' && ['Último acceso', 'Estado'].includes(column)) return false;
    if (section === 'categories' && ['Productos', 'Ventas del mes'].includes(column)) return false;
    if (section === 'customers' && ['Pedidos', 'Total comprado'].includes(column)) return false;
    return true;
  });
  const stateColumn = config.columns.find((column) => column === 'Estado' || column === 'Estado de pago');
  const entriesForView = useMemo(() => {
    const filtered = entries.filter(({ data }) => {
      const brandName = brandOptions.find((brand) => brand.id === data.Marca)?.name || '';
      const textMatch = [...Object.values(data), brandName].some((value) => String(value).toLowerCase().includes(query.toLowerCase()));
      const statusMatch = statusFilter === 'Todos' || (stateColumn && data[stateColumn] === statusFilter);
      return textMatch && statusMatch;
    });
    if (sortBy) filtered.sort((a, b) => String(a.data[sortBy] ?? '').localeCompare(String(b.data[sortBy] ?? ''), 'es', { numeric: true }));
    return filtered;
  }, [entries, query, statusFilter, stateColumn, sortBy, brandOptions]);
  const actualStats = useMemo(() => {
    const statuses = entries.map(({ data }) => String(data.Estado ?? data['Estado de pago'] ?? '')).filter(Boolean);
    return [
      { label: 'Registros', value: String(entries.length), detail: 'Almacenados en PostgreSQL' },
      { label: 'Coinciden con filtros', value: String(entriesForView.length), detail: query || statusFilter !== 'Todos' ? 'Resultado actual' : 'Todos los registros' },
      { label: 'Activos', value: String(statuses.filter((status) => ['Activo', 'Activa', 'En stock', 'Completado', 'Aprobada', 'Emitida'].includes(status)).length), detail: 'Estado vigente', tone: 'positive' },
      { label: 'Pendientes / inactivos', value: String(statuses.filter((status) => !['Activo', 'Activa', 'En stock', 'Completado', 'Aprobada', 'Emitida'].includes(status)).length), detail: 'Requieren seguimiento', tone: 'warning' },
    ];
  }, [entries, entriesForView.length, query, statusFilter]);
  const statusOptions = stateColumn ? ['Todos', ...Array.from(new Set(entries.map(({ data }) => String(data[stateColumn] ?? ''))))] : ['Todos'];

  const replaceEntries = (change: (current: Entry[]) => Entry[]) => setEntries(change);
  const closeDialog = () => { setMode(null); setError(''); setConfirmMessage(''); setActiveId(''); };
  const openCreate = () => {
    const initialDraft = Object.fromEntries((config.formColumns || config.columns).map((column) => [column, ''])) as Record<string, string>;
    if (isProductSection) initialDraft.Imagen = '';
    if (config.columns.includes('Estado')) {
      initialDraft.Estado = section === 'accounting' ? 'Registrado' : section === 'purchases' ? 'Registrada' : 'Activo';
    }
    if (config.columns.includes('Estado de pago')) initialDraft['Estado de pago'] = 'Pendiente';
    setActiveId(''); setDraft(initialDraft); setError(''); setFeedback(''); setInviteLink(''); setMode('create');
  };
  const openEdit = (entry: Entry) => { setActiveId(entry.id); setDraft({ ...Object.fromEntries((config.formColumns || config.columns).map((column) => [column, String(entry.data[column] ?? '')])), ...(isProductSection ? { Imagen: String(entry.data.Imagen || '') } : {}) }); setError(''); setMode('edit'); };
  const openView = (entry: Entry) => { setActiveId(entry.id); setMode('view'); };
  const openConfirm = (entry: Entry, action: 'delete' | 'annul' | 'archive') => {
    setActiveId(entry.id); setConfirmMessage(action); setError(''); setMode('confirm');
  };

  useEffect(() => {
    if (mode !== 'view' || !isProductSection) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') closeDialog(); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [mode, isProductSection]);

  const saveRecord = async (event: React.FormEvent) => {
    event.preventDefault(); setError('');
    if (section === 'inventory' && mode === 'create' && !draft.Imagen) {
      setError('Selecciona una imagen JPG, PNG o WEBP para el producto.');
      return;
    }
    const nextRecord: AdminTableRecord = {};
    for (const column of formColumns) {
      const value = (draft[column] ?? '').trim();
      if (!value && column === 'Marca') { nextRecord[column] = ''; continue; }
      if (!value && ['Descripción', 'Descripcion'].includes(column)) { nextRecord[column] = ''; continue; }
      if (!value) { setError(`Completa el campo «${column}».`); return; }
      const original = entries.find((entry) => entry.id === activeId)?.data[column];
      if (typeof original === 'number' || numericColumns.has(column)) {
        const parsed = Number(value);
        if (!Number.isFinite(parsed) || parsed < 0) { setError(`${column} debe ser un número igual o mayor que cero.`); return; }
        nextRecord[column] = parsed;
      } else nextRecord[column] = value;
    }
    if (isProductSection) nextRecord.Imagen = draft.Imagen || '';
    setBusy(true);
    try {
      if (mode === 'create') {
        const entry = await adminTableService.create(section, nextRecord);
        replaceEntries((current) => [entry, ...current]); setFeedback(section === 'users' ? 'Invitación creada. Comparte el enlace una sola vez por un canal seguro.' : 'Registro guardado en PostgreSQL.');
        setInviteLink(entry.inviteUrl || '');
      } else {
        const result = await adminTableService.update(section, activeId, nextRecord);
        const selectedRole = section === 'users' ? (Object.keys(roleLabels) as Role[]).find((role) => roleLabels[role] === nextRecord.Rol) : undefined;
        if (selectedRole && activeId === user?.id) assignRole(activeId, selectedRole);
        replaceEntries((current) => current.map((entry) => entry.id === activeId ? result : entry)); setFeedback('Cambios guardados en PostgreSQL.');
      }
      closeDialog();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo guardar el registro. Intenta nuevamente.'); }
    finally { setBusy(false); }
  };

  const selectProductImage = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setError('La imagen debe ser JPG, PNG o WEBP.');
      event.currentTarget.value = '';
      return;
    }
    if (file.size > 140 * 1024) {
      setError('La imagen debe pesar como máximo 140 KB.');
      event.currentTarget.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string' || !reader.result.startsWith(`data:${file.type};base64,`)) {
        setError('No se pudo leer la imagen. Intenta seleccionar el archivo nuevamente.');
        return;
      }
      setDraft((current) => ({ ...current, Imagen: reader.result as string }));
      setError('');
    };
    reader.onerror = () => setError('No se pudo leer la imagen. Intenta seleccionar el archivo nuevamente.');
    reader.readAsDataURL(file);
  };

  const confirmAction = async () => {
    const entry = entries.find((item) => item.id === activeId); if (!entry) return;
    setBusy(true); setError('');
    try {
      if (confirmMessage === 'delete') {
        await adminTableService.delete(section, activeId); replaceEntries((current) => current.filter((item) => item.id !== activeId)); setFeedback('Registro eliminado de PostgreSQL.');
      } else if (confirmMessage === 'archive') {
        const updated = { ...entry.data, Estado: 'Inactivo' }; const result = await adminTableService.update(section, activeId, updated); replaceEntries((current) => current.map((item) => item.id === activeId ? result : item)); setFeedback('Proveedor archivado en PostgreSQL.');
      } else {
        const statusKey = stateColumn || 'Estado';
        const nextStatus = section === 'sales' ? 'Cancelado' : section === 'invoices' ? 'Cancelada' : 'Rechazada';
        const updated = { ...entry.data, [statusKey]: nextStatus }; const result = await adminTableService.update(section, activeId, updated); replaceEntries((current) => current.map((item) => item.id === activeId ? result : item)); setFeedback('Estado actualizado en PostgreSQL.');
      }
      closeDialog();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo completar la acción. Intenta nuevamente.'); }
    finally { setBusy(false); }
  };

  const exportRows = () => {
    const csvRows = [config.columns, ...entriesForView.map(({ data }) => config.columns.map((column) => String(data[column] ?? '')))];
    const csv = `\uFEFF${csvRows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\r\n')}`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${section.replaceAll('/', '-')}-${new Date().toISOString().slice(0, 10)}.csv`; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const permissionModule = section === 'brands' || section === 'categories' || section === 'products' || section === 'inventory' || section === 'inventory/alerts' ? 'products'
    : section === 'inventory/history' || section === 'purchases' ? 'inventory'
    : section === 'users' || section === 'roles-permissions' ? 'users'
    : section === 'transfers' || section === 'payments' || section === 'invoices' || section === 'orders' ? 'orders'
    : section === 'sales' ? 'sales'
    : section === 'customers' ? 'customers'
    : section === 'suppliers' ? 'suppliers'
    : section === 'settings' || section === 'profile' ? 'settings' : 'dashboard';
  const createPermissionModule = section === 'inventory' ? 'inventory' : permissionModule;
  const canCreate = Boolean(config.action && !readOnly && !editOnly && role && roleService.can(role, createPermissionModule, 'create'));
  const approvalOnly = ['orders', 'transfers', 'payments', 'invoices'].includes(section);
  const canEdit = Boolean(!readOnly && !isTransactional && role && roleService.can(role, permissionModule, approvalOnly ? 'approve' : 'edit'));
  const canDelete = Boolean(!readOnly && !isTransactional && !editOnly && section !== 'suppliers' && section !== 'inventory' && section !== 'inventory/alerts' && section !== 'users'
    && role && roleService.can(role, permissionModule, 'delete'));
  const actionLabel = confirmMessage === 'delete' ? 'eliminar' : confirmMessage === 'archive' ? 'archivar' : 'anular';
  const activeEntry = entries.find((entry) => entry.id === activeId);

  return <div className="module-page"><div className="admin-page-heading"><div><span className="eyebrow">Gestión NEXO · Datos persistentes</span><h1>{config.title}</h1><p>{config.description}</p></div><div className="heading-actions"><button className="button button-outline" onClick={exportRows} disabled={!entriesForView.length}><Download size={16} /> Exportar CSV</button>{canCreate && <button className="button button-primary" onClick={openCreate}><Plus size={17} /> {config.action}</button>}</div></div>
    <div className="module-stats">{actualStats.map((stat) => <div key={stat.label}><span>{stat.label}</span><strong>{stat.value}</strong><small className={stat.tone || ''}>{stat.detail}</small></div>)}</div>
    {feedback && <div className="crud-feedback" role="status">{feedback}{inviteLink && <p><a href={inviteLink}>{inviteLink}</a></p>}<button aria-label="Cerrar mensaje" onClick={() => { setFeedback(''); setInviteLink(''); }}><X size={14} /></button></div>}
    {loadError && <div className="crud-error" role="alert">{loadError}</div>}
    <section className="panel module-panel"><div className="panel-heading"><div><h2>{config.title}</h2><span>{entriesForView.length} registros persistentes</span></div></div><div className="module-toolbar"><label className="search-box admin-search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Buscar ${config.title.toLowerCase()}...`} />{query && <button type="button" onClick={() => setQuery('')} aria-label="Limpiar búsqueda"><X size={15} /></button>}</label>{stateColumn && <label className="crud-filter"><Filter size={15} /><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>{statusOptions.map((option) => <option key={option}>{option}</option>)}</select></label>}<label className="crud-filter"><SlidersHorizontal size={15} /><select value={sortBy} onChange={(event) => setSortBy(event.target.value)} aria-label="Ordenar tabla"><option value="">Orden original</option>{config.columns.map((column) => <option key={column} value={column}>{column}</option>)}</select><ChevronDown size={13} /></label></div>
      {loading ? <div className="empty-state">Cargando desde PostgreSQL…</div> : entriesForView.length ? <div className="data-table crud-table"><div className="table-head" style={{ gridTemplateColumns: `repeat(${config.columns.length}, minmax(105px, 1fr)) 132px` }}>{config.columns.map((column) => <span key={column}>{column}</span>)}<span>Acciones</span></div>{entriesForView.map((entry) => <div className="table-row" key={entry.id} style={{ gridTemplateColumns: `repeat(${config.columns.length}, minmax(105px, 1fr)) 132px` }}>{config.columns.map((column) => <CrudCell key={column} value={column === "Marca" ? brandOptions.find((brand) => brand.id === entry.data.Marca)?.name || "Sin marca" : entry.data[column]} column={column} image={isProductSection && column === 'Producto' ? String(entry.data.Imagen || '') : undefined} onSelect={isProductSection && column === 'Producto' ? () => openView(entry) : undefined} />)}<div className="table-actions crud-actions"><button className="icon-button" aria-label={`Ver ${config.title}: ${String(entry.data[config.columns[0]])}`} title="Ver detalle" onClick={() => openView(entry)}><Eye size={15} /></button>{canEdit && <button className="icon-button" aria-label={`Editar ${config.title}: ${String(entry.data[config.columns[0]])}`} title="Editar" onClick={() => openEdit(entry)}><Pencil size={15} /></button>}{section === 'sales' && <button className="icon-button danger" aria-label={`Anular ${config.title}: ${String(entry.data[config.columns[0]])}`} title="Anular con confirmación" onClick={() => openConfirm(entry, 'annul')}><Ban size={15} /></button>}{section === 'suppliers' && entry.data.Estado !== 'Inactivo' && <button className="icon-button danger" aria-label={`Archivar proveedor ${String(entry.data.Nombre)}`} title="Archivar con confirmación" onClick={() => openConfirm(entry, 'archive')}><Archive size={15} /></button>}{canDelete && <button className="icon-button danger" aria-label={`Eliminar ${config.title}: ${String(entry.data[config.columns[0]])}`} title="Eliminar con confirmación" onClick={() => openConfirm(entry, 'delete')}><Trash2 size={15} /></button>}</div></div>)}</div> : loadError ? null : <AdminCrudEmptyState search={query} />}
      <div className="pagination"><span>Mostrando {entriesForView.length} de {entries.length} registros</span></div>
    </section>
    {mode && <div className="modal-backdrop" onClick={closeDialog}><div className={`modal crud-modal${mode === 'view' && isProductSection ? ' product-preview-modal' : ''}`} role="dialog" aria-modal="true" aria-labelledby="crud-dialog-title" onClick={(event) => event.stopPropagation()}><div className="modal-header"><div><span className="eyebrow">{mode === 'view' ? 'Detalle' : mode === 'edit' ? 'Actualizar registro' : mode === 'create' ? 'Nuevo registro' : 'Confirmar acción'}</span><h2 id="crud-dialog-title">{mode === 'view' ? config.title : mode === 'confirm' ? `Confirmar ${actionLabel}` : mode === 'edit' ? `Editar ${config.title}` : config.action || `Crear ${config.title}`}</h2></div><button type="button" className="icon-button" aria-label="Cerrar" onClick={closeDialog}><X size={18} /></button></div>
      {mode === 'view' && activeEntry && isProductSection ? <ProductPreview entry={activeEntry.data} brandName={brandOptions.find((brand) => brand.id === activeEntry.data.Marca)?.name || 'Sin marca'} onClose={closeDialog} /> : mode === 'view' && activeEntry && <div className="crud-detail-list">{config.columns.map((column) => <div key={column}><span>{column}</span><strong>{String(activeEntry.data[column] ?? '—')}</strong></div>)}<div className="modal-actions"><button className="button button-outline" onClick={closeDialog}>Cerrar</button></div></div>}
      {(mode === 'create' || mode === 'edit') && <form className="crud-form" onSubmit={saveRecord} noValidate><div className="crud-fields">{formColumns.map((column) => <label className={column === 'Descripción' || column === 'Descripcion' ? 'field crud-field-wide' : 'field'} key={column}><span>{column}</span>{column === 'Rol' && section === 'users' ? <select value={draft.Rol ?? ''} onChange={(event) => setDraft({ ...draft, Rol: event.target.value })}><option value="">Selecciona un rol</option>{(Object.keys(roleLabels) as Role[]).filter((role) => role !== 'customer' && (mode !== 'create' || role !== 'superadmin')).map((role) => <option key={role} value={roleLabels[role]}>{roleLabels[role]}</option>)}</select> : column === 'Marca' && isProductSection ? <select value={draft.Marca ?? ''} onChange={(event) => setDraft({ ...draft, Marca: event.target.value })}><option value=''>Sin marca</option>{brandOptions.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}{brand.status === 'Inactiva' ? ' · Inactiva' : ''}</option>)}</select> : column === 'Estado' || column === 'Estado de pago' ? <select value={draft[column] || (column === 'Estado de pago' ? 'Pendiente' : 'Activo')} onChange={(event) => setDraft({ ...draft, [column]: event.target.value })}>{Array.from(new Set([...statusChoices(section), draft[column]].filter(Boolean))).map((value) => <option key={value}>{value}</option>)}</select> : <input type={column === 'Correo' ? 'email' : typeof activeEntry?.data[column] === 'number' || numericColumns.has(column) ? 'number' : 'text'} min={typeof activeEntry?.data[column] === 'number' || numericColumns.has(column) ? '0' : undefined} step="any" value={draft[column] ?? ''} onChange={(event) => setDraft({ ...draft, [column]: event.target.value })} placeholder={`Ingresa ${column.toLowerCase()}`} />}</label>)}</div>{section === 'inventory' && <label className="field crud-field-wide image-upload-field"><span>Imagen del producto</span><div className="product-image-upload"><ProductImage src={draft.Imagen || ''} alt="Vista previa del producto" className="product-upload-preview" /><div className="product-image-upload-controls"><input type="file" accept="image/jpeg,image/png,image/webp" aria-label="Seleccionar imagen del producto" onChange={selectProductImage} /><small>JPG, PNG o WEBP · máximo 140 KB. La imagen se guardará junto al producto.</small>{draft.Imagen && <button type="button" className="text-link" onClick={() => setDraft((current) => ({ ...current, Imagen: '' }))}>Quitar imagen</button>}</div></div></label>}{error && <div className="crud-error" role="alert">{error}</div>}<div className="crud-form-note">{section === 'users' && mode === 'create' ? 'El enlace se muestra una sola vez. La persona definirá su propia contraseña al aceptar la invitación.' : 'Los cambios se guardarán en PostgreSQL.'}</div><div className="modal-actions"><button type="button" className="button button-outline" onClick={closeDialog}>Cancelar</button><button type="submit" className="button button-primary" disabled={busy}><Check size={16} /> Guardar</button></div></form>}
      {mode === 'confirm' && <div className="crud-confirm"><p>¿Confirmas {actionLabel} este registro? La acción se validará y guardará en PostgreSQL.</p>{error && <div className="crud-error" role="alert">{error}</div>}<div className="modal-actions"><button className="button button-outline" onClick={closeDialog}>Volver</button><button className="button button-primary" disabled={busy} onClick={confirmAction}>{busy ? 'Procesando...' : `Confirmar ${actionLabel}`}</button></div></div>}
      </div></div>}
  </div>;
}

function CrudCell({ value, column, image, onSelect }: { value: string | number | undefined; column: string; image?: string; onSelect?: () => void }) {
  if (column === 'Estado' || column === 'Estado de pago') return <span className={`status-pill ${String(value).includes('Complet') || value === 'Activo' || value === 'Emitida' || value === 'Aprobada' ? 'success' : String(value).includes('Anul') || String(value).includes('Cancel') || value === 'Inactivo' ? 'danger' : 'warning'}`}><i />{value}</span>;
  if (typeof value === 'number' && ['Total', 'Ventas', 'Valor', 'Ventas del mes', 'Total comprado'].includes(column)) return <strong>{formatQ(value)}</strong>;
  if (column === 'Producto' && image !== undefined && onSelect) return <button type="button" className="name-cell product-select" onClick={onSelect} aria-label={`Ver producto ${String(value)}`}><ProductImage src={image} alt={`Imagen de ${String(value)}`} className="product-table-thumb" /><strong>{value}</strong></button>;
  if (column === 'Producto' || column === 'Cliente' || column === 'Nombre') return <span className="name-cell">{column === 'Producto' && image !== undefined ? <ProductImage src={image} alt={`Imagen de ${String(value)}`} className="product-table-thumb" /> : <span className="table-avatar">{String(value).slice(0, 2).toUpperCase()}</span>}<strong>{value}</strong></span>;
  return <span>{value}</span>;
}

function ProductImage({ src, alt, className }: { src: string; alt: string; className: string }) {
  const [failed, setFailed] = useState(!src.trim());
  useEffect(() => setFailed(!src.trim()), [src]);
  return failed ? <span className={`${className} image-fallback`} role="img" aria-label={`${alt} no disponible`}><Package aria-hidden="true" /></span> : <img className={className} src={src} alt={alt} onError={() => setFailed(true)} />;
}

function ProductPreview({ entry, brandName, onClose }: { entry: AdminTableRecord; brandName: string; onClose: () => void }) {
  const name = String(entry.Producto || 'Producto');
  return <div className="product-preview">
    <ProductImage src={String(entry.Imagen || '')} alt={`Imagen de ${name}`} className="product-preview-image" />
    <div className="product-preview-info">
      <h3>{name}</h3>
      <dl>
        <div><dt>SKU</dt><dd>{String(entry.SKU || '—')}</dd></div>
        <div><dt>Marca</dt><dd>{brandName}</dd></div>
        <div><dt>Categoría</dt><dd>{String(entry.Categoría || '—')}</dd></div>
        <div><dt>Precio</dt><dd>{typeof entry.Valor === 'number' ? formatQ(entry.Valor) : '—'}</dd></div>
        <div><dt>Stock</dt><dd>{String(entry.Existencias ?? '—')} unidades</dd></div>
      </dl>
      <div className="modal-actions"><button className="button button-outline" onClick={onClose}>Cerrar</button></div>
    </div>
  </div>;
}

function AdminCrudEmptyState({ search }: { search: string }) { return <div className="empty-state"><Search size={28} /><h3>{search ? 'No encontramos resultados' : 'No hay registros disponibles'}</h3><p>{search ? 'Prueba con otra búsqueda.' : 'Crea un registro para comenzar.'}</p></div>; }
