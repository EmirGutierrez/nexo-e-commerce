import { describe, expect, it } from 'vitest';
import { canVisitAdminPath, getAdminPathPermissionModules } from '../services/adminAccess';
import type { PermissionModule, Role } from '../types';

const roles: Role[] = ['admin', 'sales', 'warehouse', 'employee', 'superadmin'];
const routeByModule: Record<PermissionModule, string> = {
  dashboard: '/admin/dashboard',
  products: '/admin/products',
  inventory: '/admin/inventory',
  orders: '/admin/orders',
  sales: '/admin/sales',
  customers: '/admin/customers',
  suppliers: '/admin/suppliers',
  accounting: '/admin/accounting',
  promotions: '/admin/offers',
  settings: '/admin/settings',
  users: '/admin/users',
};

describe('permisos y rutas administrativas', () => {
  it.each(roles.flatMap((role) => Object.entries(routeByModule).map(([module, path]) => [role, module, path] as const)))(
    '%s puede ver %s cuando su sesión tiene view',
    (role, module, path) => {
      expect(canVisitAdminPath(role, path, [`${module}:view`])).toBe(true);
    },
  );

  it('mapea Ofertas y anuncios al permiso promotions:view y lo exige para la ruta', () => {
    expect(getAdminPathPermissionModules('/admin/offers')).toEqual(['promotions']);
    expect(canVisitAdminPath('sales', '/admin/offers', ['dashboard:view', 'promotions:view'])).toBe(true);
    expect(canVisitAdminPath('sales', '/admin/offers', ['dashboard:view', 'promotions:create'])).toBe(false);
  });

  it('mapea las referencias de pedidos al mismo permiso orders que valida la API', () => {
    expect(getAdminPathPermissionModules('/admin/invoices')).toEqual(['orders']);
    expect(canVisitAdminPath('sales', '/admin/invoices', ['orders:view'])).toBe(true);
    expect(canVisitAdminPath('sales', '/admin/invoices', ['sales:view'])).toBe(false);
  });

  it('no concede un módulo por defecto si la ruta no tiene mapeo explícito', () => {
    expect(getAdminPathPermissionModules('/admin/modulo-inexistente')).toBeNull();
    expect(canVisitAdminPath('sales', '/admin/modulo-inexistente', ['dashboard:view'])).toBe(false);
    expect(canVisitAdminPath('customer', '/admin/offers', ['promotions:view'])).toBe(false);
  });

  it('mantiene ambos permisos requeridos para administrar roles', () => {
    expect(getAdminPathPermissionModules('/admin/settings/roles-permissions')).toEqual(['settings', 'users']);
    expect(canVisitAdminPath('sales', '/admin/settings/roles-permissions', ['settings:view'])).toBe(false);
    expect(canVisitAdminPath('sales', '/admin/settings/roles-permissions', ['settings:view', 'users:view'])).toBe(true);
  });

  it('rechaza rutas codificadas o con segmentos de navegación', () => {
    expect(canVisitAdminPath('sales', '/admin/offers%2f..', ['promotions:view'])).toBe(false);
    expect(canVisitAdminPath('sales', '/admin/../offers', ['promotions:view'])).toBe(false);
  });
});
