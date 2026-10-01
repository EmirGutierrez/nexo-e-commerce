import { useEffect, useMemo, useState } from 'react';
import { Check, ShieldCheck } from 'lucide-react';
import { roleLabels, type PermissionAction, type PermissionModule, type Role, type RolePermissions } from '../../../types';
import { permissionActionLabels, permissionModules, roleService } from '../../../services/roleService';

export default function RolesPermissionsPage() {
  const [availableRoles, setAvailableRoles] = useState<Role[]>([]);
  const [selected, setSelected] = useState<Role>('admin');
  const [saved, setSaved] = useState<RolePermissions>(() => roleService.getPermissions('admin'));
  const [draft, setDraft] = useState<RolePermissions>(saved);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const isDirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(saved), [draft, saved]);
  const changedCount = permissionModules.reduce((count, module) => count + module.actions.filter((action) => draft[module.id].includes(action) !== saved[module.id].includes(action)).length, 0);

  useEffect(() => {
    let active = true;
    roleService.list().then((rows) => {
      if (!active) return;
      const roles = rows.map((row) => row.id);
      setAvailableRoles(roles);
      const nextRole = roles.includes(selected) ? selected : roles[0];
      if (nextRole) {
        setSelected(nextRole);
        const current = roleService.getPermissions(nextRole);
        setSaved(current); setDraft(current);
      }
    }).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'No se pudieron cargar los roles.'); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!availableRoles.includes(selected)) return;
    const current = roleService.getPermissions(selected);
    setSaved(current); setDraft(current); setError(''); setMessage('');
  }, [selected, availableRoles]);

  const setModule = (module: PermissionModule, checked: boolean) => setDraft((current) => ({ ...current, [module]: checked ? [...permissionModules.find((item) => item.id === module)!.actions] : [] }));
  const setAction = (module: PermissionModule, action: PermissionAction, checked: boolean) => setDraft((current) => ({ ...current, [module]: checked ? [...new Set([...current[module], action])] : current[module].filter((value) => value !== action) }));
  const save = async () => {
    setError('');
    if (selected === 'superadmin') { setError('Súper Administrador conserva el acceso completo.'); return; }
    try {
      const next = await roleService.save(selected, draft);
      setSaved(next); setDraft(next); setMessage(`Permisos de ${roleLabels[selected]} guardados en PostgreSQL.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudieron guardar los permisos.'); }
  };
  return <div className="module-page permissions-page">
    <div className="admin-page-heading"><div><span className="eyebrow">Gestión NEXO · Acceso</span><h1>Roles y permisos</h1><p>Configura qué puede hacer cada perfil en los módulos de la operación.</p></div></div>
    <div className="permission-notice"><ShieldCheck size={19}/><p>Los cambios se guardan en PostgreSQL y Spring Security los valida en cada operación protegida.</p></div>
    {(message || error) && <div className={error ? 'crud-error' : 'crud-feedback'} role={error ? 'alert' : 'status'}>{error || message}</div>}
    <section className="panel permission-panel"><div className="permission-toolbar"><label className="field"><span>Rol que vas a configurar</span><select value={selected} onChange={(event) => setSelected(event.target.value as Role)}>{availableRoles.map((role) => <option key={role} value={role}>{roleLabels[role] || role}</option>)}</select></label><div className="permission-toolbar-note">{selected === 'superadmin' ? 'Acceso completo protegido' : `${permissionModules.reduce((sum, item) => sum + draft[item.id].length, 0)} permisos activos`}</div></div>
      <div className="permission-matrix-wrap"><table className="permission-matrix"><thead><tr><th scope="col">Módulo / función</th>{(['view','create','edit','delete','approve'] as PermissionAction[]).map((action) => <th key={action} scope="col">{permissionActionLabels[action]}</th>)}</tr></thead><tbody>{permissionModules.map(({ id, label, actions }) => { const all = actions.every((action) => draft[id].includes(action)); const disabled = selected === 'superadmin' || selected === 'customer'; return <tr key={id}><th scope="row"><label className="permission-module-check"><input type="checkbox" aria-label={`Seleccionar todos los permisos de ${label}`} checked={all} disabled={disabled} onChange={(event) => setModule(id, event.target.checked)}/><span>{label}</span></label></th>{(['view','create','edit','delete','approve'] as PermissionAction[]).map((action) => <td key={action}>{actions.includes(action) ? <input type="checkbox" aria-label={`${permissionActionLabels[action]} ${label}`} checked={draft[id].includes(action)} disabled={disabled} onChange={(event) => setAction(id, action, event.target.checked)}/> : <span className="permission-not-applicable" aria-label="No aplica">—</span>}</td>)}</tr>; })}</tbody></table></div>
      {(selected === 'superadmin' || selected === 'customer') && <p className="permission-locked">{selected === 'superadmin' ? 'El Súper Administrador siempre tiene todas las acciones disponibles y no se puede editar.' : 'El perfil de cliente no recibe permisos administrativos.'}</p>}
      <div className="permission-footer"><p>{isDirty ? <><strong>Cambios sin guardar:</strong> {changedCount} {changedCount === 1 ? 'permiso modificado' : 'permisos modificados'}.</> : 'No hay cambios pendientes.'}</p><div><button className="button button-outline" disabled={!isDirty} onClick={() => { setDraft(saved); setError(''); }}>Cancelar</button><button className="button button-primary" disabled={!isDirty || selected === 'superadmin' || selected === 'customer'} onClick={save}><Check size={16}/>Guardar permisos</button></div></div>
    </section>
  </div>;
}
