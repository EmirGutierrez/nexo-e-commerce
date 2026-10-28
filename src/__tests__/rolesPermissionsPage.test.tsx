// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import RolesPermissionsPage from '../modules/roles/components/RolesPermissionsPage';
import { permissionModules, roleService } from '../services/roleService';
import type { PermissionModule, Role, RolePermissions } from '../types';

const app = vi.hoisted(() => ({ role: 'superadmin' }));
vi.mock('../contexts/AppContext', () => ({ useApp: () => app }));

const permissionsFor = (enabled: PermissionModule[]): RolePermissions => Object.fromEntries(
  permissionModules.map(({ id, actions }) => [id, enabled.includes(id) ? [...actions] : []]),
) as RolePermissions;

const adminPermissions = permissionsFor(['dashboard', 'products', 'inventory', 'users']);
const salesPermissions = permissionsFor(['dashboard', 'products', 'sales', 'customers']);
const roles = [
  { id: 'admin' as Role, name: 'Administrador', users: 2, permissions: adminPermissions },
  { id: 'sales' as Role, name: 'Vendedor', users: 1, permissions: salesPermissions },
];

beforeEach(() => {
  vi.spyOn(roleService, 'can').mockReturnValue(true);
  vi.spyOn(roleService, 'list').mockResolvedValue(roles);
  vi.spyOn(roleService, 'getPermissions').mockImplementation((role) => role === 'sales' ? salesPermissions : adminPermissions);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('módulos asignados por rol', () => {
  it('muestra los módulos que devuelve el backend para cada rol', async () => {
    render(<RolesPermissionsPage />);

    const overview = screen.getByRole('region', { name: 'Módulos asignados por rol' });
    const adminCard = (await within(overview).findByRole('heading', { name: 'Administrador' })).closest('article');
    const salesCard = (await within(overview).findByRole('heading', { name: 'Vendedor' })).closest('article');

    expect(await within(adminCard as HTMLElement).findByText('Catálogo')).toBeTruthy();
    expect(within(adminCard as HTMLElement).getByText('Inventario')).toBeTruthy();
    expect(within(adminCard as HTMLElement).getByText('Usuarios y roles')).toBeTruthy();
    expect(within(salesCard as HTMLElement).getByText('Ventas')).toBeTruthy();
    expect(within(salesCard as HTMLElement).getByText('Clientes')).toBeTruthy();
    expect(within(salesCard as HTMLElement).queryByText('Inventario')).toBeNull();
  });

  it('actualiza el resumen del rol después de guardar permisos', async () => {
    const updatedPermissions = permissionsFor(['dashboard', 'products', 'inventory', 'users', 'accounting']);
    vi.spyOn(roleService, 'save').mockResolvedValue(updatedPermissions);
    render(<RolesPermissionsPage />);

    const overview = screen.getByRole('region', { name: 'Módulos asignados por rol' });
    const adminCard = (await within(overview).findByRole('heading', { name: 'Administrador' })).closest('article') as HTMLElement;
    expect(within(adminCard).queryByText('Ingresos y egresos')).toBeNull();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Seleccionar todos los permisos de Ingresos y egresos' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar permisos' }));

    await waitFor(() => expect(roleService.save).toHaveBeenCalledWith('admin', expect.any(Object)));
    expect(await within(adminCard).findByText('Ingresos y egresos')).toBeTruthy();
  });
});
