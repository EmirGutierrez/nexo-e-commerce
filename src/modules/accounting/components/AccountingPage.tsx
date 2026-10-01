import { useEffect, useMemo, useState } from 'react';
import { ArrowDownToLine, ArrowUpRight, Ban, Check, CheckCircle2, Download, Eye, Plus, Search, Wallet, X } from 'lucide-react';
import { accountingService } from '../../../services';
import { formatQ } from '../../../data/mockData';
import type { AccountingMovement } from '../../../types';
import { useApp } from '../../../contexts/AppContext';
import { roleService } from '../../../services/roleService';

export default function AccountingPage() {
  const { role } = useApp();
  const canCreate = Boolean(role && roleService.can(role, 'accounting', 'create'));
  const canEdit = Boolean(role && roleService.can(role, 'accounting', 'edit'));
  const [movements, setMovements] = useState<AccountingMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [period, setPeriod] = useState('all');
  const [typeFilter, setTypeFilter] = useState('Todos');
  const [query, setQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [success, setSuccess] = useState('');
  const [formError, setFormError] = useState('');
  const [selected, setSelected] = useState<AccountingMovement | null>(null);
  const [confirmVoid, setConfirmVoid] = useState<AccountingMovement | null>(null);
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), concept: '', category: '', type: 'Ingreso' as AccountingMovement['type'], amount: '', status: 'Registrado' as AccountingMovement['status'] });
  useEffect(() => { accountingService.list().then(setMovements).catch(() => setLoadError('No fue posible cargar los movimientos. Intenta recargar la vista.')).finally(() => setLoading(false)); }, []);
  const filtered = useMemo(() => movements.filter((item) => (period === 'all' || item.date.startsWith(period)) && (typeFilter === 'Todos' || item.type === typeFilter) && `${item.concept} ${item.category}`.toLowerCase().includes(query.toLowerCase())), [movements, period, typeFilter, query]);
  const periodMovements = useMemo(() => movements.filter((item) => period === 'all' || item.date.startsWith(period)), [movements, period]);
  const totals = useMemo(() => periodMovements.filter((item) => item.status !== 'Anulado').reduce((acc, item) => { if (item.type === 'Ingreso') acc.income += item.amount; else acc.expenses += item.amount; return acc; }, { income: 0, expenses: 0 }), [periodMovements]);
  const months = Array.from(new Set(movements.map((item) => item.date.slice(0, 7)))).sort().reverse();
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setFormError(''); setSuccess('');
    const amount = Number(form.amount);
    if (!form.date || !form.concept.trim() || !form.category || !Number.isFinite(amount) || amount <= 0) { setFormError('Completa todos los campos y escribe un monto mayor que cero.'); return; }
    try {
      const saved = await accountingService.create({ ...form, concept: form.concept.trim(), amount });
      setMovements((current) => [saved, ...current]);
      setForm({ date: new Date().toISOString().slice(0, 10), concept: '', category: '', type: 'Ingreso', amount: '', status: 'Registrado' });
      setShowForm(false); setSuccess('Movimiento guardado en PostgreSQL.');
    } catch (cause) { setFormError(cause instanceof Error ? cause.message : 'No se pudo guardar el movimiento. Intenta nuevamente.'); }
  };
  const closeForm = () => { setShowForm(false); setFormError(''); };
  const tone = (status: string) => status === 'Registrado' ? 'success' : 'warning';
  const voidMovement = async () => {
    if (!confirmVoid) return;
    try {
      await accountingService.updateStatus(confirmVoid.id, 'Anulado');
      setMovements((current) => current.map((item) => item.id === confirmVoid.id ? { ...item, status: 'Anulado' } : item));
      setSuccess('Movimiento anulado en PostgreSQL.'); setConfirmVoid(null);
    } catch (cause) { setLoadError(cause instanceof Error ? cause.message : 'No se pudo anular el movimiento. Intenta nuevamente.'); }
  };
  const exportMovements = () => {
    const rows = [['Fecha', 'Concepto', 'Categoría', 'Tipo', 'Monto (Q)', 'Estado'], ...filtered.map((item) => [item.date, item.concept, item.category, item.type, item.amount.toFixed(2), item.status])];
    const csv = `\uFEFF${rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\r\n')}`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = `contabilidad-${new Date().toISOString().slice(0, 10)}.csv`; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <div className="accounting-page">
    <div className="admin-page-heading"><div><span className="eyebrow">Gestión NEXO · PostgreSQL</span><h1>Contabilidad</h1><p>Consulta ingresos y egresos registrados para el periodo seleccionado.</p></div><div className="heading-actions"><label className="accounting-period">Periodo <select value={period} onChange={(e) => setPeriod(e.target.value)}><option value="all">Todos los periodos</option>{months.map((month) => <option key={month} value={month}>{new Date(`${month}-02`).toLocaleDateString('es-GT', { month: 'long', year: 'numeric' })}</option>)}</select></label><button className="button button-outline" onClick={exportMovements} disabled={!filtered.length}><Download size={16} /> Exportar CSV</button>{canCreate && <button className="button button-primary" onClick={() => { setShowForm(true); setSuccess(''); }}><Plus size={17} /> Registrar movimiento</button>}</div></div>
    {success && <div className="accounting-success" role="status"><CheckCircle2 size={17} />{success}</div>}{loadError && <div className="accounting-error" role="alert">{loadError}</div>}
    <div className="accounting-summary"><article className="panel accounting-total"><span><ArrowDownToLine size={17} /> Ingresos</span><strong>{formatQ(totals.income)}</strong><small>Total del periodo seleccionado</small></article><article className="panel accounting-total expense"><span><ArrowUpRight size={17} /> Egresos</span><strong>{formatQ(totals.expenses)}</strong><small>Total del periodo seleccionado</small></article><article className="panel accounting-total balance"><span><Wallet size={17} /> Balance</span><strong>{formatQ(totals.income - totals.expenses)}</strong><small>Ingresos menos egresos</small></article></div>
    <section className="panel accounting-table-panel"><div className="panel-heading"><div><h2>Movimientos</h2><span>{filtered.length} registros · montos en quetzales</span></div></div><div className="module-toolbar accounting-toolbar"><div className="search-box admin-search"><Search size={17} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar concepto o categoría..." /></div><label className="accounting-filter">Tipo <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}><option>Todos</option><option>Ingreso</option><option>Egreso</option></select></label></div>
    {loading ? <div className="accounting-empty">Cargando movimientos...</div> : filtered.length ? <div className="data-table accounting-table"><div className="table-head"><span>Fecha</span><span>Concepto</span><span>Categoría</span><span>Tipo</span><span>Monto</span><span>Estado</span><span>Acciones</span></div>{filtered.map((item) => <div className="table-row" key={item.id}><span>{new Date(`${item.date}T12:00:00`).toLocaleDateString('es-GT')}</span><strong>{item.concept}</strong><span>{item.category}</span><span className={`accounting-kind ${item.type === 'Ingreso' ? 'income' : 'expense'}`}>{item.type}</span><strong>{item.type === 'Egreso' ? '−' : '+'}{formatQ(item.amount)}</strong><span className={`status-pill ${item.status === 'Anulado' ? 'danger' : tone(item.status)}`}><i />{item.status}</span><div className="table-actions"><button className="icon-button" aria-label={`Ver movimiento ${item.concept}`} title="Ver detalle" onClick={() => setSelected(item)}><Eye size={15} /></button>{canEdit && item.status !== 'Anulado' && <button className="icon-button danger" aria-label={`Anular movimiento ${item.concept}`} title="Anular con confirmación" onClick={() => setConfirmVoid(item)}><Ban size={15} /></button>}</div></div>)}</div> : <div className="accounting-empty"><Wallet size={27} /><strong>Sin movimientos para estos filtros</strong><span>Prueba otro periodo o registra un movimiento para comenzar.</span></div>}</section>
    {(selected || confirmVoid) && <div className="modal-backdrop" onClick={() => { setSelected(null); setConfirmVoid(null); }}><div className="modal crud-modal" role="dialog" aria-modal="true" aria-labelledby="accounting-action-title" onClick={(event) => event.stopPropagation()}><div className="modal-header"><div><span className="eyebrow">{selected ? 'Detalle del movimiento' : 'Confirmar anulación'}</span><h2 id="accounting-action-title">{selected ? selected.concept : 'Anular movimiento'}</h2></div><button className="icon-button" aria-label="Cerrar" onClick={() => { setSelected(null); setConfirmVoid(null); }}><X size={18} /></button></div>{selected ? <div className="crud-detail-list">{[['Fecha', selected.date], ['Concepto', selected.concept], ['Categoría', selected.category], ['Tipo', selected.type], ['Monto', formatQ(selected.amount)], ['Estado', selected.status]].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div> : <div className="crud-confirm"><p>¿Confirmas anular este movimiento? Se conservará en el historial y no contará en los totales del periodo.</p><div className="modal-actions"><button className="button button-outline" onClick={() => setConfirmVoid(null)}>Volver</button><button className="button button-primary" onClick={voidMovement}>Confirmar anulación</button></div></div>}</div></div>}
    {showForm && <div className="modal-backdrop accounting-backdrop" onClick={closeForm}><div className="modal accounting-modal" role="dialog" aria-modal="true" aria-labelledby="accounting-title" aria-describedby="accounting-description" onClick={(e) => e.stopPropagation()}><div className="accounting-modal-heading"><div className="accounting-modal-icon"><Wallet size={20} /></div><div><span className="eyebrow">Nuevo registro</span><h2 id="accounting-title">Registrar movimiento</h2><p id="accounting-description">Completa los datos para agregar un ingreso o egreso.</p></div><button className="icon-button" onClick={closeForm} aria-label="Cerrar formulario">×</button></div><form className="accounting-form" onSubmit={save} noValidate>
      <div className="accounting-form-section"><span className="accounting-section-title">Información del movimiento</span><div className="accounting-fields"><label className="field"><span>Tipo de movimiento</span><select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as AccountingMovement['type'], category: '' })}><option>Ingreso</option><option>Egreso</option></select></label><label className="field"><span>Fecha</span><input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required /></label><label className="field accounting-field-wide"><span>Concepto</span><input value={form.concept} onChange={(e) => setForm({ ...form, concept: e.target.value })} placeholder="Ej. Servicio de internet" required /></label><label className="field"><span>Categoría</span><select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} required><option value="">Selecciona una categoría</option>{(form.type === 'Ingreso' ? ['Ventas', 'Otros ingresos', 'Servicios'] : ['Suministros', 'Servicios', 'Nómina', 'Otros egresos']).map((category) => <option key={category}>{category}</option>)}</select></label><label className="field"><span>Monto en quetzales</span><div className="accounting-amount-input"><span>Q</span><input type="number" min="0.01" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0.00" required /></div></label><label className="field"><span>Estado</span><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as AccountingMovement['status'] })}><option>Registrado</option><option>Pendiente</option></select></label></div></div>
      {formError && <div className="accounting-error" role="alert">{formError}</div>}<p className="accounting-demo-note">El movimiento y su estado quedan guardados en PostgreSQL.</p><div className="modal-actions"><button type="button" className="button button-outline" onClick={closeForm}>Cancelar</button><button type="submit" className="button button-primary"><Check size={16} /> Guardar movimiento</button></div></form></div></div>}
  </div>;
}
