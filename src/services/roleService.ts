import type { PermissionAction, PermissionModule, Role, RolePermissions } from '../types';
import { roleLabels } from '../types';

export const permissionModules: { id: PermissionModule; label: string; actions: PermissionAction[] }[] = [
  { id: 'dashboard', label: 'Dashboard', actions: ['view'] },
  { id: 'products', label: 'Productos', actions: ['view', 'create', 'edit', 'delete'] },
  { id: 'inventory', label: 'Inventario', actions: ['view', 'create', 'edit', 'approve'] },
  { id: 'orders', label: 'Pedidos', actions: ['view', 'edit', 'approve'] },
  { id: 'sales', label: 'Ventas', actions: ['view', 'create', 'edit', 'approve'] },
  { id: 'customers', label: 'Clientes', actions: ['view', 'create', 'edit', 'delete'] },
  { id: 'suppliers', label: 'Proveedores', actions: ['view', 'create', 'edit', 'delete'] },
  { id: 'reports', label: 'Reportes', actions: ['view', 'create'] },
  { id: 'settings', label: 'Configuración', actions: ['view', 'edit'] },
  { id: 'users', label: 'Usuarios y roles', actions: ['view', 'create', 'edit', 'delete'] },
];
export const permissionActionLabels: Record<PermissionAction, string> = { view: 'Ver', create: 'Crear', edit: 'Editar', delete: 'Eliminar', approve: 'Aprobar' };
const actions = (module: PermissionModule): PermissionAction[] => permissionModules.find((item) => item.id === module)!.actions;
const fullPermissions = (): RolePermissions => Object.fromEntries(permissionModules.map(({ id }) => [id, actions(id)])) as RolePermissions;
const defaults: Record<Role, RolePermissions> = {
  superadmin: fullPermissions(),
  admin: fullPermissions(),
  sales: { dashboard: ['view'], products: ['view'], inventory: [], orders: ['view', 'edit', 'approve'], sales: ['view', 'create', 'edit'], customers: ['view', 'create', 'edit'], suppliers: [], reports: ['view', 'create'], settings: [], users: [] },
  warehouse: { dashboard: ['view'], products: ['view'], inventory: ['view', 'create', 'edit'], orders: ['view'], sales: [], customers: [], suppliers: ['view', 'create', 'edit'], reports: ['view'], settings: [], users: [] },
  employee: { dashboard: [], products: [], inventory: [], orders: [], sales: [], customers: [], suppliers: [], reports: [], settings: [], users: [] },
};
const storageKey = 'nexo.role-permissions.v1';
const userRoleStorageKey = 'nexo.user-roles.v1';
const copy = (value: RolePermissions): RolePermissions => Object.fromEntries(permissionModules.map(({ id }) => [id, [...value[id]]])) as RolePermissions;
function read(): Record<Role, RolePermissions> {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || '{}') as Partial<Record<Role, Partial<RolePermissions>>>;
    return Object.fromEntries((Object.keys(defaults) as Role[]).map((role) => [role, role === 'superadmin' ? fullPermissions() : Object.fromEntries(permissionModules.map(({ id }) => [id, (saved[role]?.[id] || defaults[role][id]).filter((action) => actions(id).includes(action))]))])) as Record<Role, RolePermissions>;
  } catch { return Object.fromEntries((Object.keys(defaults) as Role[]).map((role) => [role, copy(defaults[role])])) as Record<Role, RolePermissions>; }
}
let current = read();
export const roleService = {
  list: async () => (Object.keys(roleLabels) as Role[]).map((id) => ({ id, name: roleLabels[id], permissions: copy(current[id]) })),
  getPermissions: (role: Role) => copy(current[role]),
  can: (role: Role, module: PermissionModule, action: PermissionAction = 'view') => role === 'superadmin' || current[role][module].includes(action),
  getUserRole: (userId: string, fallback: Role) => {
    try { const assignments = JSON.parse(localStorage.getItem(userRoleStorageKey) || '{}') as Record<string, Role>; return assignments[userId] && roleLabels[assignments[userId]] ? assignments[userId] : fallback; } catch { return fallback; }
  },
  assignUserRole: (userId: string, role: Role) => {
    try { const assignments = JSON.parse(localStorage.getItem(userRoleStorageKey) || '{}') as Record<string, Role>; localStorage.setItem(userRoleStorageKey, JSON.stringify({ ...assignments, [userId]: role })); } catch { /* La asignación permanece disponible en la sesión actual de la pantalla. */ }
  },
  save: async (role: Role, permissions: RolePermissions) => {
    if (role === 'superadmin') throw new Error('El rol Súper Administrador siempre conserva todos los permisos.');
    const normalized = Object.fromEntries(permissionModules.map(({ id }) => [id, permissions[id].filter((action) => actions(id).includes(action))])) as RolePermissions;
    current = { ...current, [role]: normalized };
    try { localStorage.setItem(storageKey, JSON.stringify(current)); } catch { /* La sesión sigue funcionando aunque el almacenamiento del navegador esté bloqueado. */ }
    return copy(normalized);
  },
};
