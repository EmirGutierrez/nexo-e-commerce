import { useCallback, useEffect, useMemo, useState } from 'react';
import { Archive, Ban, Check, ChevronDown, Download, Eye, Filter, Package, Pencil, Plus, Search, SlidersHorizontal, Trash2, X } from 'lucide-react';
import { adminTableService, brandService, customerService, inventoryService, type AdminTableRecord } from '../../../services';
import { formatQ } from '../../../data/mockData';
import { useApp } from '../../../contexts/AppContext';
import { roleLabels, type Brand, type Role } from '../../../types';
import { roleService } from '../../../services/roleService';
import { PRODUCT_IMAGE_MAX_DATA_URL_LENGTH, PRODUCT_IMAGE_MIN_SIDE, productImageCompressionDimensions } from '../utils/productImageProcessing';
import { isValidPersonName } from '../../../shared/utils/personName';
import { isValidEmailInput, isValidIntegerInput, isValidMixedLabel, isValidMoneyDraft, isValidMoneyInput, isValidPhoneInput, isValidSkuInput, sanitizeDecimalInput, sanitizeEmailInput, sanitizeFreeTextInput, sanitizeIntegerInput, sanitizeMixedLabelInput, sanitizePersonNameInput, sanitizePhoneInput, sanitizeSkuInput } from '../../../shared/utils/adminFieldValidation';

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
export const statusChoices = (section: string) => section === 'products' || section === 'inventory'
  ? section === 'inventory' ? ['En stock', 'Sin stock', 'Inactivo'] : ['Activo', 'Inactivo'] : section === 'customers' ? ['Activo', 'Inactivo', 'Pendiente']
  : section === 'brands' ? ['Activa', 'Inactiva'] : section === 'purchases' ? ['Pendiente', 'Registrada', 'Anulada']
  : section === 'accounting' ? ['Registrado', 'Pendiente', 'Anulado'] : ['Activo', 'Inactivo'];
const viewOnlySections = new Set(['inventory/alerts', 'inventory/history']);
const updateOnlySections = new Set(['settings', 'profile']);
const numericColumns = new Set(['Valor', 'Precio de venta', 'Costo unitario', 'Ventas del mes', 'Total comprado', 'Pedidos', 'Usuarios', 'Productos', 'Existencias']);
const integerColumns = new Set(['Existencias', 'Pedidos', 'Usuarios', 'Productos']);
const mixedLabelColumns = new Set(['Producto', 'Categoría', 'Ubicación', 'Empresa', 'Concepto']);
const fieldMaxLengths: Record<string, number> = { Producto: 180, SKU: 80, Categoría: 100, Ubicación: 120, Nombre: 160, Correo: 254, Empresa: 160, Contacto: 160, Teléfono: 40, Descripción: 1000, Descripcion: 1000 };
export const tableColumnWidth = (column: string) => {
  if (['Producto', 'Nombre', 'Descripción', 'Cliente'].includes(column)) return 210;
  if (['Acciones'].includes(column)) return 132;
  if (['Fecha', 'Último acceso', 'Contacto'].includes(column)) return 150;
  if (['Estado', 'Estado de pago'].includes(column)) return 145;
  if (['Precio de venta', 'Costo unitario', 'Total', 'Valor', 'Total comprado', 'Ventas del mes'].includes(column)) return 150;
  return 132;
};

export default function AdminCrudModule({ section, config }: { section: string; config: AdminModuleConfig }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [sortBy, setSortBy] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [mode, setMode] = useState<DialogMode>(null);
  const [activeId, setActiveId] = useState('');
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState('');
  const [brandOptions, setBrandOptions] = useState<Brand[]>([]);
  const [brandOptionsLoading, setBrandOptionsLoading] = useState(false);
  const [brandOptionsError, setBrandOptionsError] = useState('');
  const [locationOptions, setLocationOptions] = useState<string[]>([]);
  const [locationOptionsLoading, setLocationOptionsLoading] = useState(false);
  const [locationOptionsError, setLocationOptionsError] = useState('');
  const [customerDetail, setCustomerDetail] = useState<Awaited<ReturnType<typeof customerService.details>> | null>(null);
  const [customerDetailLoading, setCustomerDetailLoading] = useState(false);
  const { reportLowStock, assignRole, user, role } = useApp();
  const isProductSection = section === 'products' || section === 'inventory';
  const refreshLowStockAlert = useCallback(async () => {
    try { reportLowStock(await inventoryService.products()); }
    catch { /* Conserva el último aviso hasta poder validar un inventario nuevo. */ }
  }, [reportLowStock]);
  const loadBrandOptions = useCallback(async () => {
    setBrandOptionsLoading(true);
    setBrandOptionsError('');
    try { setBrandOptions(await brandService.list()); }
    catch (cause) { setBrandOptionsError(cause instanceof Error ? cause.message : 'No se pudieron cargar las marcas.'); }
    finally { setBrandOptionsLoading(false); }
  }, []);
  const loadLocationOptions = useCallback(async () => {
    setLocationOptionsLoading(true);
    setLocationOptionsError('');
    try { setLocationOptions(await inventoryService.locations()); }
    catch (cause) { setLocationOptionsError(cause instanceof Error ? cause.message : 'No se pudieron cargar las ubicaciones.'); }
    finally { setLocationOptionsLoading(false); }
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true); setLoadError(''); setQuery(''); setStatusFilter('Todos'); setSortBy(''); setPage(1);
    adminTableService.list(section).then((rows) => {
      if (!active) return;
      setEntries(rows);
      if (section === 'inventory') inventoryService.products().then((products) => { if (active) reportLowStock(products); });
    }).catch((cause) => { if (active) setLoadError(cause instanceof Error ? cause.message : 'No se pudieron cargar los registros.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [section, reportLowStock]);

  useEffect(() => {
    if (isProductSection) void loadBrandOptions();
    else { setBrandOptions([]); setBrandOptionsError(''); }
  }, [isProductSection, loadBrandOptions]);

  useEffect(() => {
    if (section === 'inventory') void loadLocationOptions();
    else { setLocationOptions([]); setLocationOptionsError(''); }
  }, [section, loadLocationOptions]);

  const isTransactional = transactionSections.has(section);
  const readOnly = viewOnlySections.has(section);
  const editOnly = updateOnlySections.has(section);
  const configuredFormColumns = config.formColumns || config.columns;
  const formColumns = [...new Set([...configuredFormColumns, ...(isProductSection ? ['Imagen'] : [])])].filter((column) => {
    if (mode === 'create' && section === 'users' && ['Último acceso', 'Estado'].includes(column)) return false;
    if (section === 'categories' && ['Productos', 'Ventas del mes'].includes(column)) return false;
    if (section === 'customers' && ['Pedidos', 'Total comprado'].includes(column)) return false;
    return true;
  });
  const tableLayoutClass = `crud-layout-${section.replaceAll('/', '-')}`;
  const stateColumn = config.columns.find((column) => column === 'Estado' || column === 'Estado de pago');
  const entriesForView = useMemo(() => {
    const filtered = entries.filter(({ data }) => {
      const brandName = brandOptions.find((brand) => brand.id === data.Marca)?.name || '';
      const textMatch = [...Object.values(data), brandName].some((value) => String(value).toLowerCase().includes(query.toLowerCase()));
      const statusMatch = statusFilter === 'Todos' || (stateColumn && data[stateColumn] === statusFilter);
      return textMatch && statusMatch;
    });
    if (sortBy === 'Último acceso') filtered.sort((a, b) => Number(b.data.__lastLoginAt ?? -1) - Number(a.data.__lastLoginAt ?? -1));
    else if (sortBy) filtered.sort((a, b) => String(a.data[sortBy] ?? '').localeCompare(String(b.data[sortBy] ?? ''), 'es', { numeric: true }));
    return filtered;
  }, [entries, query, statusFilter, stateColumn, sortBy, brandOptions]);
  const pageCount = Math.max(1, Math.ceil(entriesForView.length / pageSize));
  const pageEntries = entriesForView.slice((page - 1) * pageSize, page * pageSize);
  useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);
  const actualStats = useMemo(() => {
    const statuses = entries.map(({ data }) => String(data.Estado ?? data['Estado de pago'] ?? '')).filter(Boolean);
    if (section === 'products') {
      const publicCount = statuses.filter((status) => status !== 'Inactivo').length;
      return [
        { label: 'Productos registrados', value: String(entries.length), detail: 'Registrados' },
        { label: 'Visibles en tienda', value: String(publicCount), detail: 'Publicación activa', tone: 'positive' },
        { label: 'Ocultos', value: String(statuses.length - publicCount), detail: 'No aparecen en la página pública', tone: 'warning' },
        { label: 'Resultado actual', value: String(entriesForView.length), detail: 'Según búsqueda y filtros' },
      ];
    }
    if (section === 'inventory') {
      const quantities = entries.map(({ data }) => Number(data.Existencias || 0));
      return [
        { label: 'Productos', value: String(entries.length), detail: 'Registrados' },
        { label: 'Unidades disponibles', value: String(quantities.reduce((sum, quantity) => sum + quantity, 0)), detail: 'Suma de existencias' },
        { label: 'Sin stock', value: String(statuses.filter((status) => status === 'Sin stock').length), detail: 'Requieren reposición', tone: 'warning' },
        { label: 'Inactivos', value: String(statuses.filter((status) => status === 'Inactivo').length), detail: 'No disponibles para venta' },
      ];
    }
    return [
      { label: 'Registros', value: String(entries.length), detail: 'Registrados' },
      { label: 'Coinciden con filtros', value: String(entriesForView.length), detail: query || statusFilter !== 'Todos' ? 'Resultado actual' : 'Todos los registros' },
      { label: 'Activos', value: String(statuses.filter((status) => ['Activo', 'Activa', 'En stock', 'Completado', 'Aprobada', 'Emitida'].includes(status)).length), detail: 'Estado vigente', tone: 'positive' },
      { label: 'Pendientes / inactivos', value: String(statuses.filter((status) => !['Activo', 'Activa', 'En stock', 'Completado', 'Aprobada', 'Emitida'].includes(status)).length), detail: 'Requieren seguimiento', tone: 'warning' },
    ];
  }, [entries, entriesForView.length, query, section, statusFilter]);
  const statusOptions = stateColumn ? ['Todos', ...Array.from(new Set(entries.map(({ data }) => String(data[stateColumn] ?? ''))))] : ['Todos'];

  const replaceEntries = (change: (current: Entry[]) => Entry[]) => setEntries(change);
  const updateDraftField = (column: string, value: string) => {
    let normalized = value;
    if (integerColumns.has(column)) {
      if (value && !/^[0-9]+$/.test(value)) return;
      normalized = sanitizeIntegerInput(value);
    }
    else if (numericColumns.has(column)) {
      if (value && !isValidMoneyDraft(value)) return;
      normalized = sanitizeDecimalInput(value);
    }
    else if (column === 'Correo') normalized = sanitizeEmailInput(value);
    else if (column === 'Teléfono') normalized = sanitizePhoneInput(value);
    else if (column === 'SKU') normalized = sanitizeSkuInput(value);
    else if (column === 'Nombre' && (section === 'users' || section === 'customers')) normalized = /[<>]/.test(value) ? value : sanitizePersonNameInput(value);
    else if (mixedLabelColumns.has(column) || column === 'Nombre' || column === 'Empresa') normalized = sanitizeMixedLabelInput(value);
    else if (column === 'Descripción' || column === 'Descripcion') normalized = sanitizeFreeTextInput(value);
    setDraft((current) => ({ ...current, [column]: normalized }));
  };
  const closeDialog = () => { setMode(null); setError(''); setConfirmMessage(''); setActiveId(''); };
  const openCreate = () => {
    if (isProductSection) void loadBrandOptions();
    const initialDraft = Object.fromEntries(formColumns.map((column) => [column, ''])) as Record<string, string>;
    if (config.columns.includes('Estado')) {
      initialDraft.Estado = section === 'inventory' ? 'En stock' : section === 'accounting' ? 'Registrado' : section === 'purchases' ? 'Registrada' : 'Activo';
    }
    if (config.columns.includes('Estado de pago')) initialDraft['Estado de pago'] = 'Pendiente';
    setActiveId(''); setDraft(initialDraft); setError(''); setFeedback(''); setInviteLink(''); setMode('create');
  };
  const openEdit = (entry: Entry) => { if (isProductSection) void loadBrandOptions(); setActiveId(entry.id); setDraft(Object.fromEntries(formColumns.map((column) => [column, String(entry.data[column] ?? '')]))); setError(''); setMode('edit'); };
  const openView = (entry: Entry) => { setActiveId(entry.id); setCustomerDetail(null); setMode('view'); };
  const openConfirm = (entry: Entry, action: 'delete' | 'annul' | 'archive') => {
    setActiveId(entry.id); setConfirmMessage(action); setError(''); setMode('confirm');
  };

  useEffect(() => {
    if (mode !== 'view' || !isProductSection) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') closeDialog(); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [mode, isProductSection]);

  useEffect(() => {
    if (mode !== 'view' || section !== 'customers' || !activeId) return;
    let active = true;
    setCustomerDetailLoading(true);
    customerService.details(activeId).then((details) => { if (active) setCustomerDetail(details); })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'No se pudo cargar el detalle del cliente.'); })
      .finally(() => { if (active) setCustomerDetailLoading(false); });
    return () => { active = false; };
  }, [activeId, mode, section]);

  const saveRecord = async (event: React.FormEvent) => {
    event.preventDefault(); setError('');
    const nextRecord: AdminTableRecord = {};
    const optionalColumns = new Set([
      'Marca', 'Imagen',
      ...(isProductSection ? ['Categoría', 'Descripción'] : []),
      ...(section === 'inventory' ? ['Costo unitario', 'Ubicación'] : []),
    ]);
    for (const column of formColumns) {
      const value = (draft[column] ?? '').trim();
      if (!value && optionalColumns.has(column)) { nextRecord[column] = ''; continue; }
      if (!value) { setError(`Completa el campo «${column}».`); return; }
      const original = entries.find((entry) => entry.id === activeId)?.data[column];
      if (typeof original === 'number' || numericColumns.has(column)) {
        if (integerColumns.has(column) ? !isValidIntegerInput(value) : !isValidMoneyInput(value)) {
          setError(`${column} debe contener ${integerColumns.has(column) ? 'un número entero' : 'un monto con hasta dos decimales'}.`); return;
        }
        const parsed = Number(value);
        if (!Number.isFinite(parsed) || parsed < 0) { setError(`${column} debe ser un número igual o mayor que cero.`); return; }
        if (['Costo unitario', 'Precio de venta', 'Valor'].includes(column) && parsed <= 0) { setError(`${column} debe ser mayor que cero.`); return; }
        nextRecord[column] = parsed;
      } else {
        if (column === 'Correo' && !isValidEmailInput(value)) { setError('Ingresa un correo electrónico válido.'); return; }
        if (column === 'Teléfono' && value && !isValidPhoneInput(value)) { setError('El teléfono debe contener entre 7 y 15 dígitos.'); return; }
        if (column === 'SKU' && !isValidSkuInput(value)) { setError('El SKU solo puede contener letras, números, punto, guion, guion bajo o diagonal, sin espacios.'); return; }
        if (mixedLabelColumns.has(column) || (column === 'Nombre' && section !== 'users' && section !== 'customers') || column === 'Empresa') {
          if (!isValidMixedLabel(value)) { setError(`El campo «${column}» debe iniciar con una letra o número y solo puede contener texto, números y separadores habituales.`); return; }
        }
        nextRecord[column] = value;
      }
    }
    if ((section === 'customers' || section === 'users') && !isValidPersonName(String(nextRecord.Nombre || ''))) {
      setError('El nombre solo puede contener letras, tildes, espacios, guiones y apóstrofes.'); return;
    }
    if (section === 'inventory') {
      const quantity = Number(nextRecord.Existencias);
      if (nextRecord.Estado === 'En stock' && quantity <= 0) { setError('Un producto En stock debe tener al menos una existencia.'); return; }
      if (nextRecord.Estado === 'Sin stock' && quantity !== 0) { setError('Para registrar Sin stock, la cantidad debe ser cero.'); return; }
    }
    setBusy(true);
    try {
      if (mode === 'create') {
        const entry = await adminTableService.create(section, nextRecord);
        replaceEntries((current) => [entry, ...current]); setPage(1); setFeedback(section === 'users' ? 'Invitación creada. Comparte el enlace una sola vez por un canal seguro.' : 'Registro guardado correctamente.');
        setInviteLink(entry.inviteUrl || '');
      } else {
        const result = await adminTableService.update(section, activeId, nextRecord);
        const selectedRole = section === 'users' ? (Object.keys(roleLabels) as Role[]).find((role) => roleLabels[role] === nextRecord.Rol) : undefined;
        if (selectedRole && activeId === user?.id) assignRole(activeId, selectedRole);
        replaceEntries((current) => current.map((entry) => entry.id === activeId ? result : entry)); setFeedback('Cambios guardados correctamente.');
      }
      if (section === 'inventory') {
        await loadLocationOptions();
        await refreshLowStockAlert();
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
        const result = await adminTableService.delete(section, activeId, { pendingInvitation: isPendingInvitation });
        if (section === 'inventory' && result && !result.deleted) {
          replaceEntries((current) => current.map((item) => item.id === activeId
            ? { ...item, data: { ...item.data, Estado: 'Inactivo' } }
            : item));
          setFeedback('El producto se desactivó para conservar su historial y sus relaciones.');
        } else {
          replaceEntries((current) => current.filter((item) => item.id !== activeId));
          setFeedback(isPendingInvitation
            ? 'Invitación revocada y registro pendiente eliminado.'
            : section === 'users'
              ? 'Usuario eliminado del equipo, sus sesiones se cerraron y el historial operativo se conservó.'
              : 'Registro eliminado correctamente.');
        }
      } else if (confirmMessage === 'archive') {
        const updated = { ...entry.data, Estado: 'Inactivo' }; const result = await adminTableService.update(section, activeId, updated); replaceEntries((current) => current.map((item) => item.id === activeId ? result : item)); setFeedback('Proveedor archivado correctamente.');
      } else {
        const statusKey = stateColumn || 'Estado';
        const nextStatus = section === 'sales' ? 'Cancelado' : section === 'invoices' ? 'Cancelada' : 'Rechazada';
        const updated = { ...entry.data, [statusKey]: nextStatus }; const result = await adminTableService.update(section, activeId, updated); replaceEntries((current) => current.map((item) => item.id === activeId ? result : item)); setFeedback('Estado actualizado correctamente.');
      }
      if (section === 'inventory') await refreshLowStockAlert();
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

  const permissionModule = section === 'brands' || section === 'categories' || section === 'products' ? 'products'
    : section === 'inventory' || section === 'inventory/alerts' || section === 'inventory/history' || section === 'purchases' ? 'inventory'
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
  const canDelete = Boolean(!readOnly && !isTransactional && !editOnly && section !== 'products' && section !== 'suppliers' && section !== 'inventory/alerts' && section !== 'users'
    && role && roleService.can(role, permissionModule, 'delete'));
  const canRevokeInvitation = Boolean(section === 'users' && role && roleService.can(role, permissionModule, 'delete'));
  const canDeleteTeamMember = canRevokeInvitation;
  const activeEntry = entries.find((entry) => entry.id === activeId);
  const isPendingInvitation = section === 'users' && activeEntry?.data.Estado === 'Pendiente';
  const actionLabel = confirmMessage === 'delete' ? isPendingInvitation ? 'revocar invitación' : section === 'users' ? 'eliminar del equipo' : 'eliminar' : confirmMessage === 'archive' ? 'archivar' : 'anular';

  return <div className="module-page"><div className="admin-page-heading"><div><span className="eyebrow">Gestión NEXO</span><h1>{config.title}</h1><p>{config.description}</p></div><div className="heading-actions"><button className="button button-outline" onClick={exportRows} disabled={!entriesForView.length}><Download size={16} /> Exportar CSV</button>{canCreate && <button className="button button-primary" onClick={openCreate}><Plus size={17} /> {config.action}</button>}</div></div>
    <div className="module-stats">{actualStats.map((stat) => <div key={stat.label}><span>{stat.label}</span><strong>{stat.value}</strong><small className={stat.tone || ''}>{stat.detail}</small></div>)}</div>
    {feedback && <div className="crud-feedback" role="status">{feedback}{inviteLink && <p><a href={inviteLink}>{inviteLink}</a></p>}<button aria-label="Cerrar mensaje" onClick={() => { setFeedback(''); setInviteLink(''); }}><X size={14} /></button></div>}
    {loadError && <div className="crud-error" role="alert">{loadError}</div>}
    <section className="panel module-panel"><div className="panel-heading"><div><h2>{config.title}</h2><span>{entriesForView.length} registros</span></div></div><div className="module-toolbar"><label className="search-box admin-search"><Search size={17} /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder={`Buscar ${config.title.toLowerCase()}...`} />{query && <button type="button" onClick={() => { setQuery(''); setPage(1); }} aria-label="Limpiar búsqueda"><X size={15} /></button>}</label>{stateColumn && <label className="crud-filter"><Filter size={15} /><select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }}>{statusOptions.map((option) => <option key={option}>{option}</option>)}</select><ChevronDown size={13} /></label>}<label className="crud-filter"><SlidersHorizontal size={15} /><select value={sortBy} onChange={(event) => { setSortBy(event.target.value); setPage(1); }} aria-label="Ordenar tabla"><option value="">Orden original</option>{config.columns.map((column) => <option key={column} value={column}>{column}</option>)}</select><ChevronDown size={13} /></label></div>
      {loading ? <div className="empty-state">Cargando desde NEXO…</div> : entriesForView.length ? <div className={`data-table crud-table ${tableLayoutClass}`}><div className="table-head">{config.columns.map((column) => <span key={column}>{section === 'products' && column === 'Estado' ? 'Visibilidad pública' : column}</span>)}<span>Acciones</span></div>{pageEntries.map((entry) => <div className="table-row" key={entry.id}>{config.columns.map((column) => <CrudCell key={column} value={column === "Marca" ? brandOptions.find((brand) => brand.id === entry.data.Marca)?.name || "Sin marca" : entry.data[column]} column={column} image={isProductSection && column === 'Producto' ? String(entry.data.Imagen || '') : undefined} onSelect={isProductSection && column === 'Producto' ? () => openView(entry) : undefined} />)}<div className="table-actions crud-actions"><button className="icon-button" aria-label={`Ver ${config.title}: ${String(entry.data[config.columns[0]])}`} title="Ver detalle" onClick={() => openView(entry)}><Eye size={15} /></button>{canEdit && <button className="icon-button" aria-label={`Editar ${config.title}: ${String(entry.data[config.columns[0]])}`} title="Editar" onClick={() => openEdit(entry)}><Pencil size={15} /></button>}{section === 'sales' && <button className="icon-button danger" aria-label={`Anular ${config.title}: ${String(entry.data[config.columns[0]])}`} title="Anular con confirmación" onClick={() => openConfirm(entry, 'annul')}><Ban size={15} /></button>}{section === 'suppliers' && entry.data.Estado !== 'Inactivo' && <button className="icon-button danger" aria-label={`Archivar proveedor ${String(entry.data.Nombre)}`} title="Archivar con confirmación" onClick={() => openConfirm(entry, 'archive')}><Archive size={15} /></button>}{canDelete && <button className="icon-button danger" aria-label={`Eliminar ${config.title}: ${String(entry.data[config.columns[0]])}`} title="Eliminar con confirmación" onClick={() => openConfirm(entry, 'delete')}><Trash2 size={15} /></button>}{canDeleteTeamMember && entry.data.Estado !== 'Pendiente' && entry.id !== user?.id && <button className="icon-button danger" aria-label={'Eliminar usuario del equipo: ' + String(entry.data.Nombre)} title="Eliminar usuario del equipo" onClick={() => openConfirm(entry, 'delete')}><Trash2 size={15} /></button>}{canRevokeInvitation && entry.data.Estado === 'Pendiente' && <button className="icon-button danger" aria-label={`Revocar invitación: ${String(entry.data.Nombre)}`} title="Revocar invitación pendiente" onClick={() => openConfirm(entry, 'delete')}><Trash2 size={15} /></button>}</div></div>)}</div> : loadError ? null : <AdminCrudEmptyState search={query} />}
      <div className="pagination"><span>Mostrando {entriesForView.length ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, entriesForView.length)} de {entriesForView.length} registros</span><label className="table-page-size">Filas<select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}><option value={10}>10</option><option value={25}>25</option><option value={50}>50</option></select></label><div className="table-pagination-actions"><button type="button" className="icon-button" aria-label="Página anterior" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>‹</button><span>Página {page} de {pageCount}</span><button type="button" className="icon-button" aria-label="Página siguiente" disabled={page >= pageCount} onClick={() => setPage((current) => current + 1)}>›</button></div></div>
    </section>
    {mode && <div className="modal-backdrop" onClick={closeDialog}><div className={`modal crud-modal${mode === 'view' && isProductSection ? ' product-preview-modal' : ''}`} role="dialog" aria-modal="true" aria-labelledby="crud-dialog-title" onClick={(event) => event.stopPropagation()}><div className="modal-header"><div><span className="eyebrow">{mode === 'view' ? 'Detalle' : mode === 'edit' ? 'Actualizar registro' : mode === 'create' ? 'Nuevo registro' : 'Confirmar acción'}</span><h2 id="crud-dialog-title">{mode === 'view' ? config.title : mode === 'confirm' ? `Confirmar ${actionLabel}` : mode === 'edit' ? `Editar ${config.title}` : config.action || `Crear ${config.title}`}</h2></div><button type="button" className="icon-button" aria-label="Cerrar" onClick={closeDialog}><X size={18} /></button></div>
      {mode === 'view' && section === 'customers' && activeEntry ? customerDetailLoading ? <p>Cargando detalle del cliente…</p> : customerDetail ? <CustomerDetail details={customerDetail} onClose={closeDialog} /> : error ? <div className="crud-error" role="alert">{error}</div> : <p>No hay historial disponible.</p> : mode === 'view' && activeEntry && isProductSection ? <ProductPreview entry={activeEntry.data} brandName={brandOptions.find((brand) => brand.id === activeEntry.data.Marca)?.name || 'Sin marca'} onClose={closeDialog} /> : mode === 'view' && activeEntry && <div className="crud-detail-list">{config.columns.map((column) => <div key={column}><span>{column}</span><strong>{String(activeEntry.data[column] ?? '—')}</strong></div>)}<div className="modal-actions"><button className="button button-outline" onClick={closeDialog}>Cerrar</button></div></div>}
      {(mode === 'create' || mode === 'edit') && <form className="crud-form" onSubmit={saveRecord} noValidate><div className="crud-fields">{formColumns.map((column) => {
        const integerField = integerColumns.has(column);
        const numericField = numericColumns.has(column) || typeof activeEntry?.data[column] === 'number';
        const personField = column === 'Nombre' && (section === 'users' || section === 'customers');
        const inputType = column === 'Correo' ? 'email' : 'text';
        const inputMode = integerField ? 'numeric' : numericField ? 'decimal' : column === 'Teléfono' ? 'tel' : undefined;
        const pattern = integerField ? '[0-9]+' : numericField ? '[0-9]+([.][0-9]{1,2})?' : column === 'SKU' ? '[A-Za-z0-9][A-Za-z0-9._/-]{0,79}' : undefined;
        const maxLength = fieldMaxLengths[column];
        return <label className={column === 'Descripción' || column === 'Descripcion' || column === 'Imagen' ? 'field crud-field-wide' : 'field'} key={column}><span>{column === 'Estado' && section === 'inventory' ? 'Estado actual' : column === 'Estado' && section === 'products' ? 'Publicación en tienda' : column === 'SKU' && section === 'inventory' ? 'Código del producto (SKU)' : column}</span>{column === 'Rol' && section === 'users' ? <select value={draft.Rol ?? ''} onChange={(event) => setDraft({ ...draft, Rol: event.target.value })}><option value="">Selecciona un rol</option>{(Object.keys(roleLabels) as Role[]).filter((role) => role !== 'customer' && (mode !== 'create' || role !== 'superadmin')).map((role) => <option key={role} value={roleLabels[role]}>{roleLabels[role]}</option>)}</select> : column === 'Marca' && isProductSection ? <><select value={draft.Marca ?? ''} disabled={brandOptionsLoading} onChange={(event) => setDraft({ ...draft, Marca: event.target.value })}><option value="">{brandOptionsLoading ? 'Cargando marcas…' : 'Sin marca'}</option>{brandOptions.filter((brand) => brand.status === 'Activa').map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select>{brandOptionsError && <small role="alert">{brandOptionsError} <button type="button" className="text-link" onClick={() => void loadBrandOptions()}>Reintentar</button></small>}</> : column === 'Ubicación' && section === 'inventory' ? <><input type="text" aria-label={column} list="inventory-location-options" value={draft[column] ?? ''} maxLength={fieldMaxLengths.Ubicación} onChange={(event) => updateDraftField(column, event.target.value)} placeholder={locationOptionsLoading ? 'Cargando ubicaciones…' : locationOptions.length ? 'Selecciona o escribe una ubicación' : 'Escribe una ubicación nueva'} /><datalist id="inventory-location-options">{locationOptions.map((location) => <option key={location} value={location} />)}</datalist>{locationOptionsError ? <small role="alert">{locationOptionsError} <button type="button" className="text-link" onClick={() => void loadLocationOptions()}>Reintentar</button></small> : <small>Las ubicaciones disponibles aparecen aquí. Puedes escribir una nueva; se agregará al catálogo al guardar el producto.</small>}</> : column === 'Imagen' && isProductSection ? <><input type="file" accept="image/jpeg,image/png,image/webp" onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; setError(''); try { const image = await prepareProductImage(file); setDraft((current) => ({ ...current, Imagen: image })); } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo preparar la imagen.'); } }} />{draft.Imagen && <div className="product-image-upload-preview"><ProductImage src={draft.Imagen} alt="Vista previa del producto" className="product-table-thumb" /><button type="button" className="text-link" onClick={() => setDraft((current) => ({ ...current, Imagen: '' }))}>Quitar imagen</button></div>}</> : column === 'Estado' || column === 'Estado de pago' ? <select value={draft[column] || (column === 'Estado de pago' ? 'Pendiente' : section === 'inventory' ? 'En stock' : 'Activo')} onChange={(event) => setDraft({ ...draft, [column]: event.target.value })}>{Array.from(new Set([...statusChoices(section), draft[column]].filter(Boolean))).map((value) => <option key={value}>{value}</option>)}</select> : <input type={inputType} inputMode={inputMode} pattern={pattern} maxLength={maxLength} value={draft[column] ?? ''} onChange={(event) => updateDraftField(column, event.target.value)} placeholder={`Ingresa ${column.toLowerCase()}`} aria-label={column} />}</label>;
      })}</div>{error && <div className="crud-error" role="alert">{error}</div>}<div className="crud-form-note">{isProductSection ? section === 'inventory' ? 'La disponibilidad se determina por las existencias y el estado. La imagen se guarda junto con el producto.' : 'Usa el estado Activo para publicar el producto o Inactivo para ocultarlo de la tienda pública.' : section === 'users' && mode === 'create' ? 'El enlace se muestra una sola vez. La persona definirá su propia contraseña al aceptar la invitación.' : 'Guarda para aplicar los cambios.'}</div><div className="modal-actions"><button type="button" className="button button-outline" onClick={closeDialog}>Cancelar</button><button type="submit" className="button button-primary" disabled={busy}><Check size={16} /> Guardar</button></div></form>}
      {mode === 'confirm' && <div className="crud-confirm"><p>{isPendingInvitation ? <>¿Revocar la invitación de <strong>{String(activeEntry?.data.Nombre || 'este usuario')}</strong>? El enlace dejará de funcionar y se quitará el registro pendiente.</> : section === 'users' ? <>¿Eliminar a <strong>{String(activeEntry?.data.Nombre || 'este usuario')}</strong> del equipo? Se cerrarán sus sesiones. Sus ventas y movimientos históricos se conservarán.</> : section === 'inventory' ? <>¿Eliminar <strong>{String(activeEntry?.data.Producto || 'este producto')}</strong>? Si tiene movimientos u otras relaciones, se desactivará para conservar la trazabilidad.</> : <>¿Confirmas {actionLabel} este registro? La acción se validará y guardará en NEXO.</>}</p>{error && <div className="crud-error" role="alert">{error}</div>}<div className="modal-actions"><button className="button button-outline" onClick={closeDialog}>Volver</button><button className="button button-primary" disabled={busy} onClick={confirmAction}>{busy ? 'Procesando...' : isPendingInvitation ? 'Revocar invitación' : section === 'users' ? 'Eliminar usuario' : section === 'inventory' ? 'Eliminar producto' : 'Confirmar ' + actionLabel}</button></div></div>}
      </div></div>}
  </div>;
}

function CustomerDetail({ details, onClose }: { details: { customer: Record<string, unknown>; wishlistItems: number; addresses: string[]; orders: { id: string; orderNumber?: string; date?: string; status?: string; paymentMethod?: string; paymentStatus?: string; total?: number; items?: { productName?: string; quantity?: number; unitPrice?: number; subtotal?: number }[] }[] }; onClose: () => void }) {
  const { customer, addresses, orders } = details;
  return <div className="customer-detail"><dl className="crud-detail-list"><div><span>Nombre</span><strong>{String(customer.name || '—')}</strong></div><div><span>Correo</span><strong>{String(customer.email || '—')}</strong></div><div><span>Teléfono</span><strong>{String(customer.phone || '—')}</strong></div><div><span>Estado</span><strong>{String(customer.status || 'Activo')}</strong></div><div><span>Pedidos</span><strong>{orders.length}</strong></div><div><span>Favoritos</span><strong>{details.wishlistItems}</strong></div></dl><section><h3>Direcciones</h3>{addresses.length ? <ul>{addresses.map((address) => <li key={address}>{address}</li>)}</ul> : <p>No hay direcciones registradas.</p>}</section><section><h3>Historial de compras</h3>{orders.length ? orders.map((order) => <article className="customer-order-detail" key={order.id}><header><strong>{String(order.orderNumber || order.id)}</strong><span>{String(order.status || '—')} · {formatQ(Number(order.total || 0))}</span></header><small>{order.date ? new Date(order.date).toLocaleString('es-GT') : 'Fecha no disponible'} · {String(order.paymentStatus || order.paymentMethod || '—')}</small>{order.items?.map((item, index) => <p key={String(item.productName || index)}>{String(item.productName || 'Producto')} · {Number(item.quantity || 0)} × {formatQ(Number(item.unitPrice || 0))}</p>)}</article>) : <p>Aún no hay compras asociadas a este cliente.</p>}</section><div className="modal-actions"><button className="button button-outline" onClick={onClose}>Cerrar</button></div></div>;
}
function CrudCell({ value, column, image, onSelect }: { value: string | number | undefined; column: string; image?: string; onSelect?: () => void }) {
  if (column === 'Estado' || column === 'Estado de pago') return <span className={`status-pill ${String(value).includes('Complet') || value === 'Activo' || value === 'En stock' || value === 'Emitida' || value === 'Aprobada' ? 'success' : String(value).includes('Anul') || String(value).includes('Cancel') || value === 'Inactivo' || value === 'Sin stock' ? 'danger' : 'warning'}`}><i />{value}</span>;
  if (typeof value === 'number' && ['Total', 'Ventas', 'Valor', 'Costo unitario', 'Precio de venta', 'Ventas del mes', 'Total comprado'].includes(column)) return <strong>{formatQ(value)}</strong>;
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
        <div><dt>Costo unitario</dt><dd>{typeof entry['Costo unitario'] === 'number' ? formatQ(entry['Costo unitario']) : '—'}</dd></div>
        <div><dt>Precio de venta</dt><dd>{typeof entry['Precio de venta'] === 'number' ? formatQ(entry['Precio de venta']) : typeof entry.Valor === 'number' ? formatQ(entry.Valor) : '—'}</dd></div>
        <div><dt>Stock</dt><dd>{String(entry.Existencias ?? '—')} unidades</dd></div>
        <div><dt>Ubicación</dt><dd>{String(entry.Ubicación || 'Sin ubicación registrada')}</dd></div>
        <div><dt>Estado</dt><dd>{String(entry.Estado || '—')}</dd></div>
      </dl>
      <div className="modal-actions"><button className="button button-outline" onClick={onClose}>Cerrar</button></div>
    </div>
  </div>;
}

async function prepareProductImage(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Selecciona una imagen JPG, PNG o WEBP.');
  if (file.size > 5 * 1024 * 1024) throw new Error('La imagen debe pesar menos de 5 MB.');
  const source = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo leer la imagen.')); };
    image.src = url;
  });
  const dimensions = productImageCompressionDimensions(source.width, source.height);
  if (!dimensions.length) throw new Error(`La imagen original debe medir al menos ${PRODUCT_IMAGE_MIN_SIDE} × ${PRODUCT_IMAGE_MIN_SIDE} px. No se ampliarán imágenes pequeñas.`);
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) throw new Error('No se pudo preparar la imagen.');
  for (const target of dimensions) {
    canvas.width = target.width;
    canvas.height = target.height;
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.88, 0.84, 0.8, 0.76]) {
      const image = canvas.toDataURL('image/jpeg', quality);
      if (image.length <= PRODUCT_IMAGE_MAX_DATA_URL_LENGTH) return image;
    }
  }
  throw new Error('La imagen supera 140 KB después de comprimirla sin reducirla por debajo de la resolución mínima. Usa una imagen optimizada o un recorte más ajustado.');
}

function AdminCrudEmptyState({ search }: { search: string }) { return <div className="empty-state"><Search size={28} /><h3>{search ? 'No encontramos resultados' : 'No hay registros disponibles'}</h3><p>{search ? 'Prueba con otra búsqueda.' : 'Crea un registro para comenzar.'}</p></div>; }
