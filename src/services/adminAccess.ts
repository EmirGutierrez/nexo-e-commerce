import type { PermissionModule, Role } from '../types';
import { roleService } from './roleService';

const permissionModuleByAdminSection: Record<string, PermissionModule> = {
  dashboard: 'dashboard',
  products: 'products',
  brands: 'products',
  categories: 'products',
  inventory: 'inventory',
  purchases: 'inventory',
  orders: 'orders',
  sales: 'sales',
  customers: 'customers',
  suppliers: 'suppliers',
  accounting: 'accounting',
  offers: 'promotions',
  transfers: 'orders',
  payments: 'orders',
  invoices: 'orders',
  users: 'users',
  'roles-permissions': 'users',
  settings: 'settings',
};

export function getAdminPathPermissionModules(pathname: string): PermissionModule[] | null {
  if (pathname.includes('\\') || /%2f|%5c/i.test(pathname) || pathname.split('/').some((segment) => segment === '.' || segment === '..')) return null;
  const segments = pathname.replace(/\/+$/, '').split('/').filter(Boolean);
  if (segments[0] !== 'admin') return null;
  const section = segments[1] || 'dashboard';

  if (section === 'profile' || section === 'support') return [];
  if (section === 'settings' && segments[2] === 'roles-permissions') return ['settings', 'users'];

  const module = permissionModuleByAdminSection[section];
  return module ? [module] : null;
}

export function canVisitAdminPath(role: Role, pathname: string, permissions?: string[]): boolean {
  const requiredModules = getAdminPathPermissionModules(pathname);
  if (requiredModules === null || role === 'customer') return false;
  if (requiredModules.length === 0) return true;
  if (role === 'superadmin' && permissions === undefined) return true;

  return requiredModules.every((module) => permissions !== undefined
    ? permissions.includes(`${module}:view`)
    : roleService.can(role, module, 'view'));
}
