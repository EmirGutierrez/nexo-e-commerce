// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import AdminCrudModule, { statusChoices, tableColumnWidth } from '../modules/products/components/AdminCrudModule';
import { moduleConfig } from '../modules/app/components/NexoPages';
import { adminTableService, brandService, inventoryService, userService } from '../services';
import { roleService } from '../services/roleService';

const appContext = vi.hoisted(() => ({
  reportLowStock: vi.fn(),
  assignRole: vi.fn(),
  user: null,
  role: 'superadmin',
}));

vi.mock('../contexts/AppContext', () => ({ useApp: () => appContext }));

const inventoryConfig = {
  title: 'Inventario',
  description: 'Administra existencias.',
  action: 'Nuevo producto',
  formColumns: ['Producto', 'Marca', 'Categoría', 'SKU', 'Costo unitario', 'Precio de venta', 'Existencias', 'Ubicación', 'Estado', 'Descripción'],
  columns: ['Producto', 'Marca', 'SKU', 'Existencias', 'Ubicación', 'Estado'],
  stats: [],
  rows: [],
};

const inventoryEntry = {
  id: 'product-1',
  data: {
    Producto: 'Monitor', Marca: '', SKU: 'MON-1', 'Costo unitario': 50,
    'Precio de venta': 149, Existencias: 8, Ubicación: 'Bodega A', Estado: 'En stock', Descripción: 'Monitor de prueba',
  },
};

const inventoryProduct = {
  id: 'product-1', name: 'Monitor', category: 'Pantallas', price: 149, image: '',
  description: 'Monitor de prueba', sku: 'MON-1', stock: 8, status: 'Activo' as const,
};

const usersConfig = {
  title: 'Usuarios y equipo', description: 'Administra accesos y roles.', action: 'Invitar usuario',
  columns: ['Nombre', 'Correo', 'Rol', 'Último acceso', 'Estado'], stats: [], rows: [],
};
const pendingInvitation = {
  id: 'invitation-1', data: { Nombre: 'Danny Velásquez', Correo: 'danny@example.com', Rol: 'Administrador', 'Último acceso': 'Nunca', Estado: 'Pendiente' },
};
const activeTeamUser = {
  id: 'user-1', data: { Nombre: 'Administradora NEXO', Correo: 'admin@example.com', Rol: 'Administradora', 'Último acceso': 'Hoy', Estado: 'Activo' },
};

function fillRequiredInventoryFields() {
  fireEvent.change(screen.getByLabelText('Producto'), { target: { value: 'Monitor nuevo' } });
  fireEvent.change(screen.getByLabelText('Código del producto (SKU)'), { target: { value: 'MON-2' } });
  fireEvent.change(screen.getByLabelText('Precio de venta'), { target: { value: '149' } });
  fireEvent.change(screen.getByLabelText('Existencias'), { target: { value: '8' } });
}

beforeEach(() => {
  appContext.reportLowStock.mockClear();
  appContext.assignRole.mockClear();
  vi.spyOn(adminTableService, 'list').mockResolvedValue([inventoryEntry]);
  vi.spyOn(adminTableService, 'create').mockResolvedValue({ id: 'product-2', data: inventoryEntry.data });
  vi.spyOn(inventoryService, 'products').mockResolvedValue([inventoryProduct]);
  vi.spyOn(brandService, 'list').mockResolvedValue([]);
  vi.spyOn(roleService, 'can').mockReturnValue(true);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('configuración y formularios de inventario', () => {
  it('define los estados correctos para cada módulo', () => {
    expect(statusChoices('inventory')).toEqual(['En stock', 'Sin stock', 'Inactivo']);
    expect(statusChoices('products')).toEqual(['Activo', 'Inactivo']);
    expect(statusChoices('customers')).toEqual(['Activo', 'Inactivo', 'Pendiente']);
    expect(statusChoices('brands')).toEqual(['Activa', 'Inactiva']);
    expect(statusChoices('purchases')).toEqual(['Pendiente', 'Registrada', 'Anulada']);
    expect(statusChoices('accounting')).toEqual(['Registrado', 'Pendiente', 'Anulado']);
    expect(statusChoices('unknown')).toEqual(['Activo', 'Inactivo']);
  });

  it('calcula anchuras específicas de tabla y usa el valor general para otras columnas', () => {
    expect(tableColumnWidth('Producto')).toBe(210);
    expect(tableColumnWidth('Acciones')).toBe(132);
    expect(tableColumnWidth('Fecha')).toBe(150);
    expect(tableColumnWidth('Estado')).toBe(145);
    expect(tableColumnWidth('Costo unitario')).toBe(150);
    expect(tableColumnWidth('SKU')).toBe(132);
  });

  it('configura costo, precio y ubicación en el inventario y traduce los estados de muestra', () => {
    expect(moduleConfig.inventory.formColumns).toContain('Costo unitario');
    expect(moduleConfig.inventory.formColumns).toContain('Precio de venta');
    expect(moduleConfig.inventory.formColumns).toContain('Ubicación');
    expect(moduleConfig.inventory.rows.some((row) => row.Estado === 'En stock')).toBe(true);
    expect(moduleConfig.inventory.rows.some((row) => row.Estado === 'Agotado')).toBe(true);
  });

  it('carga inventario con permiso propio y permite dejar vacíos los campos opcionales', async () => {
    const listProducts = vi.mocked(inventoryService.products);
    const create = vi.mocked(adminTableService.create);

    render(<AdminCrudModule section="inventory" config={inventoryConfig} />);

    await screen.findByText('Monitor');
    await waitFor(() => expect(listProducts).toHaveBeenCalledOnce());
    expect(appContext.reportLowStock).toHaveBeenCalledWith([inventoryProduct]);
    expect(roleService.can).toHaveBeenCalledWith('superadmin', 'inventory', 'create');

    fireEvent.click(screen.getByRole('button', { name: 'Nuevo producto' }));
    expect(screen.getByLabelText('Costo unitario')).toBeTruthy();
    expect(screen.getAllByLabelText('Imagen')).toHaveLength(1);
    expect((screen.getByLabelText('Estado actual') as HTMLSelectElement).value).toBe('En stock');
    expect(screen.getByRole('option', { name: 'Sin stock' })).toBeTruthy();

    fillRequiredInventoryFields();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(create).toHaveBeenCalledWith('inventory', expect.objectContaining({
      Producto: 'Monitor nuevo', SKU: 'MON-2', 'Costo unitario': '', 'Precio de venta': 149,
      Existencias: 8, Ubicación: '', Categoría: '', Descripción: '', Imagen: '', Estado: 'En stock',
    })));
  });

  it('rechaza stock cero cuando el estado elegido es En stock', async () => {
    const create = vi.mocked(adminTableService.create);
    render(<AdminCrudModule section="inventory" config={inventoryConfig} />);
    await screen.findByText('Monitor');
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo producto' }));
    fillRequiredInventoryFields();
    fireEvent.change(screen.getByLabelText('Existencias'), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect((await screen.findByRole('alert')).textContent).toContain('Un producto En stock debe tener al menos una existencia.');
    expect(create).not.toHaveBeenCalled();
  });

  it('carga las marcas persistentes y conserva la ubicación existente al editar inventario', async () => {
    const brandId = 'brand-api-1';
    vi.mocked(adminTableService.list).mockResolvedValue([{ ...inventoryEntry, data: { ...inventoryEntry.data, Marca: brandId } }]);
    vi.mocked(brandService.list).mockResolvedValue([{ id: brandId, name: 'Marca API', description: '', contact: '', website: '', status: 'Activa' }]);
    const update = vi.spyOn(adminTableService, 'update').mockResolvedValue({ ...inventoryEntry, data: { ...inventoryEntry.data, Marca: brandId, Ubicación: 'Bodega nueva' } });

    render(<AdminCrudModule section="inventory" config={inventoryConfig} />);
    await screen.findByText('Monitor');
    fireEvent.click(screen.getByRole('button', { name: 'Editar Inventario: Monitor' }));

    await screen.findByRole('option', { name: 'Marca API' });
    expect((screen.getByLabelText('Marca') as HTMLSelectElement).value).toBe(brandId);
    const location = screen.getByLabelText('Ubicación') as HTMLInputElement;
    expect(location.value).toBe('Bodega A');
    expect(document.querySelector('#inventory-location-options option[value="Bodega A"]')).toBeTruthy();
    fireEvent.change(location, { target: { value: 'Bodega nueva' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(update).toHaveBeenCalledWith('inventory', 'product-1', expect.objectContaining({
      Marca: brandId, Ubicación: 'Bodega nueva',
    })));
  });

  it('muestra la acción de eliminar inventario y conserva el producto como inactivo si tiene historial', async () => {
    const remove = vi.spyOn(adminTableService, 'delete').mockResolvedValue({ deleted: false });
    render(<AdminCrudModule section="inventory" config={inventoryConfig} />);
    await screen.findByText('Monitor');

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar Inventario: Monitor' }));
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar producto' }));

    await waitFor(() => expect(remove).toHaveBeenCalledWith('inventory', 'product-1', { pendingInvitation: false }));
    expect(screen.getByText('Monitor')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('desactivó para conservar su historial');
    expect(screen.getAllByText('Inactivo').some((element) => element.closest('.table-row'))).toBe(true);
  });

  it('usa las columnas del listado como formulario de catálogo y agrega una sola entrada de imagen', async () => {
    const productConfig = { ...inventoryConfig, title: 'Productos', formColumns: undefined, columns: ['Producto', 'SKU', 'Valor', 'Estado'] };
    render(<AdminCrudModule section="products" config={productConfig} />);
    await screen.findByText('Monitor');
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo producto' }));

    expect(screen.getAllByLabelText('Imagen')).toHaveLength(1);
    expect((screen.getByLabelText('Publicación en tienda') as HTMLSelectElement).value).toBe('Activo');
    expect(screen.getByRole('option', { name: 'Inactivo' })).toBeTruthy();
  });
});

describe('revocación de invitaciones del equipo', () => {
  it('permite eliminar usuarios activos y revocar invitaciones pendientes', async () => {
    vi.mocked(adminTableService.list).mockResolvedValue([pendingInvitation, activeTeamUser]);
    const revoke = vi.spyOn(adminTableService, 'delete').mockResolvedValue(undefined);

    render(<AdminCrudModule section="users" config={usersConfig} />);

    const revokeButton = await screen.findByRole('button', { name: 'Revocar invitación: Danny Velásquez' });
    const deleteUserButton = screen.getByRole('button', { name: 'Eliminar usuario del equipo: Administradora NEXO' });

    fireEvent.click(revokeButton);
    expect(screen.getByText(/El enlace dejará de funcionar/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Revocar invitación' }));

    await waitFor(() => expect(revoke).toHaveBeenCalledWith('users', 'invitation-1', { pendingInvitation: true }));
    await waitFor(() => expect(screen.queryByText('Danny Velásquez')).toBeNull());
    expect(screen.getByRole('status').textContent).toContain('Invitación revocada');

    fireEvent.click(deleteUserButton);
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar usuario' }));
    await waitFor(() => expect(revoke).toHaveBeenCalledWith('users', 'user-1', { pendingInvitation: false }));
    await waitFor(() => expect(screen.queryByText('Administradora NEXO')).toBeNull());
    expect(screen.getByRole('status').textContent).toContain('Usuario eliminado del equipo');
  });

  it('no muestra la opción si el rol no tiene permiso users:delete', async () => {
    vi.mocked(adminTableService.list).mockResolvedValue([pendingInvitation]);
    vi.mocked(roleService.can).mockImplementation((_role, _module, action) => action !== 'delete');

    render(<AdminCrudModule section="users" config={usersConfig} />);

    await screen.findByText('Danny Velásquez');
    expect(screen.queryByRole('button', { name: 'Revocar invitación: Danny Velásquez' })).toBeNull();
  });

  it('envía la revocación al endpoint de invitaciones del usuario', async () => {
    const revoke = vi.spyOn(userService, 'revokeInvitation').mockResolvedValue(undefined);

    await adminTableService.delete('users', 'invitation-1', { pendingInvitation: true });

    expect(revoke).toHaveBeenCalledWith('invitation-1');
  });

  it('envía la eliminación de usuarios activos al endpoint de usuarios', async () => {
    const remove = vi.spyOn(userService, 'delete').mockResolvedValue(undefined);

    await adminTableService.delete('users', 'user-1');

    expect(remove).toHaveBeenCalledWith('user-1');
  });
});
