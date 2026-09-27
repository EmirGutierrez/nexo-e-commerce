import { useEffect, useMemo, useState } from 'react';
import { Archive, Ban, Check, ChevronDown, Download, Eye, Filter, Pencil, Plus, Search, SlidersHorizontal, Trash2, X } from 'lucide-react';
import { adminTableService, type AdminTableRecord } from './services';
import { formatQ, merchandisePurchases } from './data/mockData';

export interface AdminModuleConfig {
  title: string;
  description: string;
  action?: string;
  columns: string[];
  stats: { label: string; value: string; detail: string; tone?: string }[];
  rows: AdminTableRecord[];
}

type Entry = { id: string; data: AdminTableRecord };
type DialogMode = 'create' | 'edit' | 'view' | 'confirm' | null;
const sessionRows = new Map<string, Entry[]>();
const transactionSections = new Set(['sales', 'transfers', 'payments', 'invoices']);
const viewOnlySections = new Set(['inventory/history']);
const updateOnlySections = new Set(['inventory', 'settings', 'profile']);
const numericColumns = new Set(['Valor', 'Ventas del mes', 'Total comprado', 'Pedidos', 'Usuarios', 'Productos', 'Existencias']);

export default function AdminCrudModule({ section, config }: { section: string; config: AdminModuleConfig }) {
  const [entries, setEntries] = useState<Entry[]>(() => sessionRows.get(section) || config.rows.map((data, index) => ({ id: `${section}-${index + 1}`, data: { ...data } })));
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [sortBy, setSortBy] = useState('');
  const [mode, setMode] = useState<DialogMode>(null);
  const [activeId, setActiveId] = useState('');
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState('');

  useEffect(() => {
    const cached = sessionRows.get(section);
    const next = cached || config.rows.map((data, index) => ({ id: `${section}-${index + 1}`, data: { ...data } }));
    sessionRows.set(section, next); setEntries(next); setQuery(''); setStatusFilter('Todos'); setSortBy('');
  }, [section, config]);

  const isTransactional = transactionSections.has(section);
  const readOnly = viewOnlySections.has(section);
  const editOnly = updateOnlySections.has(section);
  const stateColumn = config.columns.find((column) => column === 'Estado' || column === 'Estado de pago');
  const entriesForView = useMemo(() => {
    const filtered = entries.filter(({ data }) => {
      const textMatch = Object.values(data).some((value) => String(value).toLowerCase().includes(query.toLowerCase()));
      const statusMatch = statusFilter === 'Todos' || (stateColumn && data[stateColumn] === statusFilter);
      return textMatch && statusMatch;
    });
    if (sortBy) filtered.sort((a, b) => String(a.data[sortBy] ?? '').localeCompare(String(b.data[sortBy] ?? ''), 'es', { numeric: true }));
    return filtered;
  }, [entries, query, statusFilter, stateColumn, sortBy]);
  const statusOptions = stateColumn ? ['Todos', ...Array.from(new Set(entries.map(({ data }) => String(data[stateColumn] ?? ''))))] : ['Todos'];

  const replaceEntries = (change: (current: Entry[]) => Entry[]) => setEntries((current) => {
    const next = change(current); sessionRows.set(section, next); return next;
  });
  const closeDialog = () => { setMode(null); setError(''); setConfirmMessage(''); setActiveId(''); };
  const openCreate = () => { setActiveId(''); setDraft(Object.fromEntries(config.columns.map((column) => [column, '']))); setError(''); setFeedback(''); setMode('create'); };
  const openEdit = (entry: Entry) => { setActiveId(entry.id); setDraft(Object.fromEntries(config.columns.map((column) => [column, String(entry.data[column] ?? '')]))); setError(''); setMode('edit'); };
  const openView = (entry: Entry) => { setActiveId(entry.id); setMode('view'); };
  const openConfirm = (entry: Entry, action: 'delete' | 'annul' | 'archive') => {
    setActiveId(entry.id); setConfirmMessage(action); setError(''); setMode('confirm');
  };

  const saveRecord = async (event: React.FormEvent) => {
    event.preventDefault(); setError('');
    const nextRecord: AdminTableRecord = {};
    for (const column of config.columns) {
      const value = (draft[column] ?? '').trim();
      if (!value) { setError(`Completa el campo «${column}».`); return; }
      const original = entries.find((entry) => entry.id === activeId)?.data[column];
      if (typeof original === 'number' || numericColumns.has(column)) {
        const parsed = Number(value);
        if (!Number.isFinite(parsed) || parsed < 0) { setError(`${column} debe ser un número igual o mayor que cero.`); return; }
        nextRecord[column] = parsed;
      } else nextRecord[column] = value;
    }
    setBusy(true);
    try {
      if (mode === 'create') {
        await adminTableService.create(section, nextRecord);
        const entry = { id: `${section}-${Date.now()}`, data: nextRecord };
        replaceEntries((current) => [entry, ...current]); setFeedback('Registro creado durante esta sesión.');
      } else {
        await adminTableService.update(section, activeId, nextRecord);
        replaceEntries((current) => current.map((entry) => entry.id === activeId ? { ...entry, data: nextRecord } : entry)); setFeedback('Cambios guardados durante esta sesión.');
      }
      closeDialog();
    } catch { setError('No se pudo guardar el registro. Intenta nuevamente.'); }
    finally { setBusy(false); }
  };

  const confirmAction = async () => {
    const entry = entries.find((item) => item.id === activeId); if (!entry) return;
    if (confirmMessage === 'delete' && section === 'categories' && Number(entry.data.Productos) > 0) { setError('No se puede eliminar una categoría que tiene productos asociados.'); return; }
    if (confirmMessage === 'delete' && section === 'products' && merchandisePurchases.some((purchase) => purchase.items.some((item) => item.productName === entry.data.Producto))) { setError('No se puede eliminar este producto porque aparece en compras registradas.'); return; }
    if (confirmMessage === 'archive' && merchandisePurchases.some((purchase) => purchase.supplier === entry.data.Nombre && purchase.status !== 'Anulada')) { setError('No se puede archivar este proveedor porque tiene compras relacionadas.'); return; }
    if (confirmMessage === 'delete' && section === 'roles-permissions' && String(entry.data.Nombre).includes('Súper Administrador')) { setError('El rol Súper Administrador está protegido.'); return; }
    if (confirmMessage === 'delete' && section === 'roles-permissions' && Number(entry.data.Usuarios) > 0) { setError('No se puede eliminar un rol asignado a usuarios.'); return; }
    if (confirmMessage === 'delete' && section === 'users' && String(entry.data.Rol).includes('Súper Administrador')) { setError('No se puede eliminar la cuenta Súper Administrador.'); return; }
    setBusy(true); setError('');
    try {
      if (confirmMessage === 'delete') {
        await adminTableService.delete(section, activeId); replaceEntries((current) => current.filter((item) => item.id !== activeId)); setFeedback('Registro eliminado durante esta sesión.');
      } else if (confirmMessage === 'archive') {
        const updated = { ...entry.data, Estado: 'Inactivo' }; await adminTableService.update(section, activeId, updated); replaceEntries((current) => current.map((item) => item.id === activeId ? { ...item, data: updated } : item)); setFeedback('Proveedor archivado durante esta sesión.');
      } else {
        const statusKey = stateColumn || 'Estado';
        const nextStatus = section === 'sales' ? 'Cancelado' : section === 'invoices' ? 'Cancelada' : 'Rechazada';
        const updated = { ...entry.data, [statusKey]: nextStatus }; await adminTableService.update(section, activeId, updated); replaceEntries((current) => current.map((item) => item.id === activeId ? { ...item, data: updated } : item)); setFeedback('Estado actualizado durante esta sesión.');
      }
      closeDialog();
    } catch { setError('No se pudo completar la acción. Intenta nuevamente.'); }
    finally { setBusy(false); }
  };

  const exportRows = () => {
    const csvRows = [config.columns, ...entriesForView.map(({ data }) => config.columns.map((column) => String(data[column] ?? '')))];
    const csv = `\uFEFF${csvRows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\r\n')}`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${section.replaceAll('/', '-')}-${new Date().toISOString().slice(0, 10)}.csv`; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const canCreate = Boolean(config.action) && !readOnly && !editOnly;
  const canEdit = !readOnly && !isTransactional;
  const canDelete = !readOnly && !isTransactional && !editOnly && section !== 'suppliers' && section !== 'inventory/alerts';
  const actionLabel = confirmMessage === 'delete' ? 'eliminar' : confirmMessage === 'archive' ? 'archivar' : 'anular';
  const activeEntry = entries.find((entry) => entry.id === activeId);

  return <div className="module-page"><div className="admin-page-heading"><div><span className="eyebrow">Gestión NEXO · Datos de demostración</span><h1>{config.title}</h1><p>{config.description}</p></div><div className="heading-actions"><button className="button button-outline" onClick={exportRows} disabled={!entriesForView.length}><Download size={16} /> Exportar CSV</button>{canCreate && <button className="button button-primary" onClick={openCreate}><Plus size={17} /> {config.action}</button>}</div></div>
    <div className="module-stats">{config.stats.map((stat) => <div key={stat.label}><span>{stat.label}</span><strong>{stat.value}</strong><small className={stat.tone || ''}>{stat.detail}</small></div>)}</div>
    {feedback && <div className="crud-feedback" role="status">{feedback}<button aria-label="Cerrar mensaje" onClick={() => setFeedback('')}><X size={14} /></button></div>}
    <section className="panel module-panel"><div className="panel-heading"><div><h2>{config.title}</h2><span>{entriesForView.length} registros · los cambios son locales a esta sesión</span></div></div><div className="module-toolbar"><label className="search-box admin-search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Buscar ${config.title.toLowerCase()}...`} />{query && <button type="button" onClick={() => setQuery('')} aria-label="Limpiar búsqueda"><X size={15} /></button>}</label>{stateColumn && <label className="crud-filter"><Filter size={15} /><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>{statusOptions.map((option) => <option key={option}>{option}</option>)}</select></label>}<label className="crud-filter"><SlidersHorizontal size={15} /><select value={sortBy} onChange={(event) => setSortBy(event.target.value)} aria-label="Ordenar tabla"><option value="">Orden original</option>{config.columns.map((column) => <option key={column} value={column}>{column}</option>)}</select><ChevronDown size={13} /></label></div>
      {entriesForView.length ? <div className="data-table crud-table"><div className="table-head" style={{ gridTemplateColumns: `repeat(${config.columns.length}, minmax(105px, 1fr)) 132px` }}>{config.columns.map((column) => <span key={column}>{column}</span>)}<span>Acciones</span></div>{entriesForView.map((entry) => <div className="table-row" key={entry.id} style={{ gridTemplateColumns: `repeat(${config.columns.length}, minmax(105px, 1fr)) 132px` }}>{config.columns.map((column) => <CrudCell key={column} value={entry.data[column]} column={column} />)}<div className="table-actions crud-actions"><button className="icon-button" aria-label={`Ver ${config.title}: ${String(entry.data[config.columns[0]])}`} title="Ver detalle" onClick={() => openView(entry)}><Eye size={15} /></button>{canEdit && <button className="icon-button" aria-label={`Editar ${config.title}: ${String(entry.data[config.columns[0]])}`} title="Editar" onClick={() => openEdit(entry)}><Pencil size={15} /></button>}{isTransactional && <button className="icon-button danger" aria-label={`Anular ${config.title}: ${String(entry.data[config.columns[0]])}`} title="Anular con confirmación" onClick={() => openConfirm(entry, 'annul')}><Ban size={15} /></button>}{section === 'suppliers' && entry.data.Estado !== 'Inactivo' && <button className="icon-button danger" aria-label={`Archivar proveedor ${String(entry.data.Nombre)}`} title="Archivar con confirmación" onClick={() => openConfirm(entry, 'archive')}><Archive size={15} /></button>}{canDelete && <button className="icon-button danger" aria-label={`Eliminar ${config.title}: ${String(entry.data[config.columns[0]])}`} title="Eliminar con confirmación" onClick={() => openConfirm(entry, 'delete')}><Trash2 size={15} /></button>}</div></div>)}</div> : <AdminCrudEmptyState search={query} />}
      <div className="pagination"><span>Mostrando {entriesForView.length} de {entries.length} registros</span></div>
    </section>
    {mode && <div className="modal-backdrop" onClick={closeDialog}><div className="modal crud-modal" role="dialog" aria-modal="true" aria-labelledby="crud-dialog-title" onClick={(event) => event.stopPropagation()}><div className="modal-header"><div><span className="eyebrow">{mode === 'view' ? 'Detalle' : mode === 'edit' ? 'Actualizar registro' : mode === 'create' ? 'Nuevo registro' : 'Confirmar acción'}</span><h2 id="crud-dialog-title">{mode === 'view' ? config.title : mode === 'confirm' ? `Confirmar ${actionLabel}` : mode === 'edit' ? `Editar ${config.title}` : config.action || `Crear ${config.title}`}</h2></div><button type="button" className="icon-button" aria-label="Cerrar" onClick={closeDialog}><X size={18} /></button></div>
      {mode === 'view' && activeEntry && <div className="crud-detail-list">{config.columns.map((column) => <div key={column}><span>{column}</span><strong>{String(activeEntry.data[column] ?? '—')}</strong></div>)}<div className="modal-actions"><button className="button button-outline" onClick={closeDialog}>Cerrar</button></div></div>}
      {(mode === 'create' || mode === 'edit') && <form className="crud-form" onSubmit={saveRecord} noValidate><div className="crud-fields">{config.columns.map((column) => <label className={column === 'Descripción' || column === 'Descripcion' ? 'field crud-field-wide' : 'field'} key={column}><span>{column}</span>{column === 'Estado' || column === 'Estado de pago' ? <select value={draft[column] || (column === 'Estado de pago' ? 'Pendiente' : 'Activo')} onChange={(event) => setDraft({ ...draft, [column]: event.target.value })}>{Array.from(new Set(['Activo', 'Inactivo', 'Pendiente', 'Completado', 'Emitida', 'En stock', 'Bajo stock', 'Agotado', 'Cancelado', 'Cancelada', 'Aprobada', 'Rechazada', draft[column]].filter(Boolean))).map((value) => <option key={value}>{value}</option>)}</select> : <input type={typeof activeEntry?.data[column] === 'number' || numericColumns.has(column) ? 'number' : 'text'} min={typeof activeEntry?.data[column] === 'number' || numericColumns.has(column) ? '0' : undefined} step="any" value={draft[column] ?? ''} onChange={(event) => setDraft({ ...draft, [column]: event.target.value })} placeholder={`Ingresa ${column.toLowerCase()}`} />}</label>)}</div>{error && <div className="crud-error" role="alert">{error}</div>}<div className="crud-form-note">Registro local de demostración; no se envían cambios a un servidor.</div><div className="modal-actions"><button type="button" className="button button-outline" onClick={closeDialog}>Cancelar</button><button type="submit" className="button button-primary" disabled={busy}><Check size={16} /> Guardar</button></div></form>}
      {mode === 'confirm' && <div className="crud-confirm"><p>¿Confirmas {actionLabel} este registro? La acción afectará solo los datos de demostración de esta sesión.</p>{error && <div className="crud-error" role="alert">{error}</div>}<div className="modal-actions"><button className="button button-outline" onClick={closeDialog}>Volver</button><button className="button button-primary" disabled={busy} onClick={confirmAction}>{busy ? 'Procesando...' : `Confirmar ${actionLabel}`}</button></div></div>}
      </div></div>}
  </div>;
}

function CrudCell({ value, column }: { value: string | number | undefined; column: string }) {
  if (column === 'Estado' || column === 'Estado de pago') return <span className={`status-pill ${String(value).includes('Complet') || value === 'Activo' || value === 'Emitida' || value === 'Aprobada' ? 'success' : String(value).includes('Anul') || String(value).includes('Cancel') || value === 'Inactivo' ? 'danger' : 'warning'}`}><i />{value}</span>;
  if (typeof value === 'number' && ['Total', 'Ventas', 'Valor', 'Ventas del mes', 'Total comprado'].includes(column)) return <strong>{formatQ(value)}</strong>;
  if (column === 'Producto' || column === 'Cliente' || column === 'Nombre') return <span className="name-cell"><span className="table-avatar">{String(value).slice(0, 2).toUpperCase()}</span><strong>{value}</strong></span>;
  return <span>{value}</span>;
}

function AdminCrudEmptyState({ search }: { search: string }) { return <div className="empty-state"><Search size={28} /><h3>{search ? 'No encontramos resultados' : 'No hay registros disponibles'}</h3><p>{search ? 'Prueba con otra búsqueda.' : 'Crea un registro para comenzar.'}</p></div>; }
