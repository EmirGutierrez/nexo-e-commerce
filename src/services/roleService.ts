import type { PermissionAction, PermissionModule, Role, RolePermissions } from '../types';
import { roleLabels } from '../types';
import { apiClient } from '../shared/services/http-client';

export const permissionModules: { id: PermissionModule; label: string; actions: PermissionAction[] }[] = [
  { id: 'dashboard', label: 'Dashboard', actions: ['view'] },
  { id: 'products', label: 'Productos', actions: ['view', 'create', 'edit', 'delete'] },
  { id: 'inventory', label: 'Inventario', actions: ['view', 'create', 'edit', 'approve'] },
  { id: 'orders', label: 'Pedidos', actions: ['view', 'edit', 'approve'] },
  { id: 'sales', label: 'Ventas', actions: ['view', 'create', 'edit', 'approve'] },
  { id: 'customers', label: 'Clientes', actions: ['view', 'create', 'edit', 'delete'] },
  { id: 'suppliers', label: 'Proveedores', actions: ['view', 'create', 'edit', 'delete'] },
  { id: 'reports', label: 'Reportes', actions: ['view', 'create'] },
  { id: 'accounting', label: 'Ingresos y egresos', actions: ['view', 'create', 'edit'] },
  { id: 'promotions', label: 'Promociones', actions: ['view', 'create', 'edit', 'delete'] },
  { id: 'settings', label: 'Configuración', actions: ['view', 'edit'] },
  { id: 'users', label: 'Usuarios y roles', actions: ['view', 'create', 'edit', 'delete'] },
];
export const permissionActionLabels: Record<PermissionAction, string> = { view: 'Ver', create: 'Crear', edit: 'Editar', delete: 'Eliminar', approve: 'Aprobar' };
const actions = (module: PermissionModule): PermissionAction[] => permissionModules.find((item) => item.id === module)!.actions;
const fullPermissions = (): RolePermissions => Object.fromEntries(permissionModules.map(({ id }) => [id, actions(id)])) as RolePermissions;
const defaults: Record<Role, RolePermissions> = {
  superadmin: fullPermissions(),
  admin: fullPermissions(),
  sales: { dashboard: ['view'], products: ['view'], inventory: [], orders: ['view', 'edit', 'approve'], sales: ['view', 'create', 'edit'], customers: ['view', 'create', 'edit'], suppliers: [], reports: ['view', 'create'], accounting: [], promotions: [], settings: [], users: [] },
  warehouse: { dashboard: ['view'], products: ['view'], inventory: ['view', 'create', 'edit'], orders: ['view'], sales: [], customers: [], suppliers: ['view', 'create', 'edit'], reports: ['view'], accounting: [], promotions: [], settings: [], users: [] },
  employee: { dashboard: ['view'], products: ['view'], inventory: ['view'], orders: [], sales: ['view', 'create'], customers: [], suppliers: [], reports: [], accounting: [], promotions: [], settings: [], users: [] },
  customer: { dashboard: [], products: [], inventory: [], orders: [], sales: [], customers: [], suppliers: [], reports: [], accounting: [], promotions: [], settings: [], users: [] },
};
const copy = (value: RolePermissions): RolePermissions => Object.fromEntries(permissionModules.map(({ id }) => [id, [...value[id]]])) as RolePermissions;
type RoleDto = { code: string; displayName: string; users: number; permissions: Partial<RolePermissions> };
let current = Object.fromEntries((Object.keys(defaults) as Role[]).map((role) => [role, copy(defaults[role])])) as Record<Role, RolePermissions>;
let authenticated: { role: Role; permissions?: string[] } | null = null;
const normalize = (permissions: Partial<RolePermissions>): RolePermissions => Object.fromEntries(permissionModules.map(({ id }) =>
  [id, (permissions[id] || []).filter((action) => actions(id).includes(action))])) as RolePermissions;
export const roleService = {
  setAuthenticatedPermissions: (role: Role | null, permissions?: string[]) => {
    authenticated = role ? { role, permissions: permissions === undefined ? undefined : [...permissions] } : null;
  },
  list: async () => {
    const rows = await apiClient.get<RoleDto[]>('/api/roles');
    rows.forEach((row) => { if (row.code in current) current[row.code as Role] = row.code === 'superadmin' ? fullPermissions() : normalize(row.permissions); });
    return rows.map((row) => ({ id: row.code as Role, name: roleLabels[row.code as Role] || row.displayName, users: row.users, permissions: copy(current[row.code as Role] || normalize(row.permissions)) }));
  },
  getPermissions: (role: Role) => copy(current[role]),
  can: (role: Role, module: PermissionModule, action: PermissionAction = 'view') => {
    if (role === 'customer') return false;
    if (authenticated?.role === role && authenticated.permissions !== undefined) return authenticated.permissions.includes(`${module}:${action}`);
    if (role === 'superadmin') return true;
    return current[role][module].includes(action);
  },
  getUserRole: (_userId: string, fallback: Role) => fallback,
  assignUserRole: async (userId: string, role: Role) => apiClient.patch<void>(`/api/users/${userId}/role`, { role }),
  save: async (role: Role, permissions: RolePermissions) => {
    if (role === 'superadmin' || role === 'customer') throw new Error('Los permisos de este rol están protegidos.');
    const normalized = normalize(permissions);
    const saved = await apiClient.put<RoleDto>(`/api/roles/${role}/permissions`, normalized);
    current = { ...current, [role]: normalize(saved.permissions) };
    return copy(current[role]);
  },
};
