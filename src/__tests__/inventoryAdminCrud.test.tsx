// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import AdminCrudModule, { statusChoices, tableColumnWidth } from '../modules/products/components/AdminCrudModule';
import { moduleConfig } from '../modules/app/components/NexoPages';
import { adminTableService, brandService, customerService, inventoryService, userService } from '../services';
import { roleService } from '../services/roleService';

const appContext = vi.hoisted(() => ({
  reportLowStock: vi.fn(),
  assignRole: vi.fn(),
  user: null as { id: string } | null,
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
  appContext.user = null;
  vi.spyOn(adminTableService, 'list').mockResolvedValue([inventoryEntry]);
  vi.spyOn(adminTableService, 'create').mockResolvedValue({ id: 'product-2', data: inventoryEntry.data });
  vi.spyOn(inventoryService, 'products').mockResolvedValue([inventoryProduct]);
  vi.spyOn(brandService, 'list').mockResolvedValue([]);
  vi.spyOn(inventoryService, 'locations').mockResolvedValue(['Bodega A', 'Bodega B']);
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

  it('limita campos numéricos y conserva nombres mixtos y SKU válidos', async () => {
    render(<AdminCrudModule section="inventory" config={inventoryConfig} />);
    await screen.findByText('Monitor');
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo producto' }));

    fireEvent.change(screen.getByLabelText('Producto'), { target: { value: 'Router 5G' } });
    fireEvent.change(screen.getByLabelText('Código del producto (SKU)'), { target: { value: 'ABC# 12' } });
    fireEvent.change(screen.getByLabelText('Costo unitario'), { target: { value: '1.001' } });
    fireEvent.change(screen.getByLabelText('Precio de venta'), { target: { value: '1e3' } });
    fireEvent.change(screen.getByLabelText('Existencias'), { target: { value: '2.5' } });
    fireEvent.change(screen.getByLabelText('Descripción'), { target: { value: 'Texto\u0001 del producto' } });

    expect((screen.getByLabelText('Producto') as HTMLInputElement).value).toBe('Router 5G');
    expect((screen.getByLabelText('Código del producto (SKU)') as HTMLInputElement).value).toBe('ABC12');
    expect((screen.getByLabelText('Costo unitario') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('Precio de venta') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('Existencias') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('Descripción') as HTMLInputElement).value).toBe('Texto del producto');
  });

  it('bloquea un monto con precisión inválida antes de actualizar un registro existente', async () => {
    const malformedEntry = { ...inventoryEntry, data: { ...inventoryEntry.data, 'Precio de venta': '1.001' } };
    vi.mocked(adminTableService.list).mockResolvedValue([malformedEntry]);
    const update = vi.spyOn(adminTableService, 'update');
    render(<AdminCrudModule section="inventory" config={inventoryConfig} />);
    await screen.findByText('Monitor');
    fireEvent.click(screen.getByRole('button', { name: 'Editar Inventario: Monitor' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect((await screen.findByRole('alert')).textContent).toContain('monto con hasta dos decimales');
    expect(update).not.toHaveBeenCalled();
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
    expect(document.querySelector('#inventory-location-options option[value="Bodega B"]')).toBeTruthy();
    fireEvent.change(location, { target: { value: 'Bodega nueva' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(update).toHaveBeenCalledWith('inventory', 'product-1', expect.objectContaining({
      Marca: brandId, Ubicación: 'Bodega nueva',
    })));
  });

  it('recarga el catálogo de ubicaciones después de guardar una nueva ubicación', async () => {
    vi.mocked(inventoryService.locations)
      .mockResolvedValueOnce(['Bodega A'])
      .mockResolvedValueOnce(['Bodega A', 'Bodega C']);
    render(<AdminCrudModule section="inventory" config={inventoryConfig} />);
    await screen.findByText('Monitor');
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo producto' }));
    fillRequiredInventoryFields();
    fireEvent.change(screen.getByLabelText('Ubicación'), { target: { value: 'Bodega C' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(inventoryService.locations).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo producto' }));
    await waitFor(() => expect(document.querySelector('#inventory-location-options option[value="Bodega C"]')).toBeTruthy());
  });

  it('muestra error y permite reintentar cuando falla el catálogo de ubicaciones', async () => {
    vi.mocked(inventoryService.locations)
      .mockRejectedValueOnce(new Error('API no disponible'))
      .mockResolvedValueOnce(['Bodega A']);
    render(<AdminCrudModule section="inventory" config={inventoryConfig} />);
    await screen.findByText('Monitor');
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo producto' }));

    expect(await screen.findByText('API no disponible')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    await waitFor(() => expect(inventoryService.locations).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByText('API no disponible')).toBeNull());
    expect(document.querySelector('#inventory-location-options option[value="Bodega A"]')).toBeTruthy();
  });

  it('muestra la acción de eliminar inventario y conserva el producto como inactivo si tiene historial', async () => {
    const remove = vi.spyOn(adminTableService, 'delete').mockResolvedValue({ deleted: false });
    const inactiveProduct = { ...inventoryProduct, status: 'Inactivo' as const };
    vi.mocked(inventoryService.products).mockResolvedValueOnce([inventoryProduct]).mockResolvedValueOnce([inactiveProduct]);
    render(<AdminCrudModule section="inventory" config={inventoryConfig} />);
    await screen.findByText('Monitor');

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar Inventario: Monitor' }));
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar producto' }));

    await waitFor(() => expect(remove).toHaveBeenCalledWith('inventory', 'product-1', { pendingInvitation: false }));
    expect(screen.getByText('Monitor')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('desactivó para conservar su historial');
    expect(screen.getAllByText('Inactivo').some((element) => element.closest('.table-row'))).toBe(true);
    await waitFor(() => expect(appContext.reportLowStock).toHaveBeenLastCalledWith([inactiveProduct]));
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

  it('oculta la eliminación de la cuenta propia incluso con permiso de administración', async () => {
    appContext.user = { id: 'user-1' };
    vi.mocked(adminTableService.list).mockResolvedValue([activeTeamUser]);

    render(<AdminCrudModule section="users" config={usersConfig} />);

    await screen.findByText('Administradora NEXO');
    expect(screen.queryByRole('button', { name: 'Eliminar usuario del equipo: Administradora NEXO' })).toBeNull();
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

  it('crea una invitación, muestra el enlace de un solo uso y permite cerrar el mensaje', async () => {
    vi.mocked(adminTableService.list).mockResolvedValue([]);
    vi.mocked(adminTableService.create).mockResolvedValue({
      id: 'invitation-new', inviteUrl: 'https://nexo.example/accept-invitation?token=once',
      data: { Nombre: 'Ana García', Correo: 'ana@example.com', Rol: 'Ventas', 'Último acceso': 'Nunca', Estado: 'Pendiente' },
    });
    render(<AdminCrudModule section="users" config={usersConfig} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Invitar usuario' }));
    expect(screen.queryByLabelText('Último acceso')).toBeNull();
    expect(screen.queryByLabelText('Estado')).toBeNull();
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Ana García' } });
    fireEvent.change(screen.getByLabelText('Correo'), { target: { value: 'ana@example.com' } });
    fireEvent.change(screen.getByLabelText('Rol'), { target: { value: 'Vendedor' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(adminTableService.create).toHaveBeenCalledWith('users', expect.objectContaining({ Nombre: 'Ana García', Correo: 'ana@example.com', Rol: 'Vendedor' })));
    expect((await screen.findByRole('status')).textContent).toContain('Invitación creada');
    expect(screen.getByRole('link', { name: /accept-invitation\?token=once/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar mensaje' }));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('ordena el último acceso por fecha, filtra registros y limpia la búsqueda', async () => {
    vi.mocked(adminTableService.list).mockResolvedValue([
      { id: 'older', data: { Nombre: 'Usuario Antiguo', Correo: 'old@example.com', Rol: 'Ventas', 'Último acceso': 'Ayer', __lastLoginAt: 1_700_000_000_000, Estado: 'Activo' } },
      { id: 'newer', data: { Nombre: 'Usuario Reciente', Correo: 'new@example.com', Rol: 'Ventas', 'Último acceso': 'Hoy', __lastLoginAt: 1_800_000_000_000, Estado: 'Activo' } },
      { id: 'never', data: { Nombre: 'Usuario Nunca', Correo: 'never@example.com', Rol: 'Ventas', 'Último acceso': 'Nunca', __lastLoginAt: -1, Estado: 'Inactivo' } },
    ]);
    render(<AdminCrudModule section="users" config={usersConfig} />);
    await screen.findByText('Usuario Antiguo');
    fireEvent.change(screen.getByLabelText('Ordenar tabla'), { target: { value: 'Último acceso' } });

    const names = Array.from(document.querySelectorAll('.crud-table .table-row strong')).map((node) => node.textContent);
    expect(names.slice(0, 3)).toEqual(['Usuario Reciente', 'Usuario Antiguo', 'Usuario Nunca']);
    fireEvent.change(screen.getByPlaceholderText('Buscar usuarios y equipo...'), { target: { value: 'never@' } });
    expect(screen.getByText('Usuario Nunca')).toBeTruthy();
    expect(screen.queryByText('Usuario Reciente')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar búsqueda' }));
    expect(screen.getByText('Usuario Reciente')).toBeTruthy();
  });
});

describe('acciones y detalles de registros administrativos', () => {
  it('archiva proveedores con confirmación y conserva el registro', async () => {
    const supplier = { id: 'supplier-1', data: { Nombre: 'Proveedor Uno', Estado: 'Activo' } };
    vi.mocked(adminTableService.list).mockResolvedValue([supplier]);
    const update = vi.spyOn(adminTableService, 'update').mockResolvedValue({ ...supplier, data: { ...supplier.data, Estado: 'Inactivo' } });
    const config = { ...usersConfig, title: 'Proveedores', action: 'Nuevo proveedor', columns: ['Nombre', 'Estado'] };

    render(<AdminCrudModule section="suppliers" config={config} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Archivar proveedor Proveedor Uno' }));
    expect(screen.getByText(/¿Confirmas archivar este registro/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar archivar' }));

    await waitFor(() => expect(update).toHaveBeenCalledWith('suppliers', 'supplier-1', { Nombre: 'Proveedor Uno', Estado: 'Inactivo' }));
    expect(screen.getByRole('status').textContent).toContain('Proveedor archivado correctamente');
    expect(screen.getByRole('button', { name: 'Ver Proveedores: Proveedor Uno' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Archivar proveedor Proveedor Uno' })).toBeNull();
  });

  it('anula ventas con el estado de cancelación y muestra error cuando falla el guardado', async () => {
    const sale = { id: 'sale-1', data: { Referencia: 'V-1', Cliente: 'Cliente uno', Total: 125, Estado: 'Completada' } };
    vi.mocked(adminTableService.list).mockResolvedValue([sale]);
    const update = vi.spyOn(adminTableService, 'update').mockRejectedValueOnce(new Error('No se pudo actualizar'));
    const config = { ...usersConfig, title: 'Ventas', columns: ['Referencia', 'Cliente', 'Total', 'Estado'] };

    render(<AdminCrudModule section="sales" config={config} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Anular Ventas: V-1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar anular' }));
    expect((await screen.findByRole('alert')).textContent).toContain('No se pudo actualizar');
    expect(update).toHaveBeenCalledWith('sales', 'sale-1', expect.objectContaining({ Estado: 'Cancelado' }));
  });

  it('elimina un inventario sin relaciones y muestra el estado vacío resultante', async () => {
    vi.spyOn(adminTableService, 'delete').mockResolvedValue({ deleted: true });
    vi.mocked(inventoryService.products).mockResolvedValueOnce([inventoryProduct]).mockResolvedValueOnce([]);
    render(<AdminCrudModule section="inventory" config={inventoryConfig} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Eliminar Inventario: Monitor' }));
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar producto' }));

    await waitFor(() => expect(screen.queryByText('Monitor')).toBeNull());
    expect(screen.getByRole('status').textContent).toContain('Registro eliminado correctamente');
    expect(screen.getByText('No hay registros disponibles')).toBeTruthy();
    await waitFor(() => expect(appContext.reportLowStock).toHaveBeenLastCalledWith([]));
  });

  it('muestra la ficha completa de cliente y maneja datos opcionales del historial', async () => {
    const customer = { id: 'customer-1', data: { Nombre: 'Cliente Uno', Correo: 'cliente@example.com', Estado: 'Activo' } };
    vi.mocked(adminTableService.list).mockResolvedValue([customer]);
    vi.spyOn(customerService, 'details').mockResolvedValue({
      customer: { name: 'Cliente Uno', email: 'cliente@example.com', status: 'Activo' },
      wishlistItems: 3,
      addresses: ['Zona 1, Ciudad'],
      orders: [{ id: 'order-1', orderNumber: 'NEXO-1', status: 'Entregado', total: 75, items: [{ productName: 'Teclado', quantity: 1, unitPrice: 75 }, {}] }],
    });
    const config = { ...usersConfig, title: 'Clientes', columns: ['Nombre', 'Correo', 'Estado'] };

    render(<AdminCrudModule section="customers" config={config} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Ver Clientes: Cliente Uno' }));

    expect(await screen.findByText('Historial de compras')).toBeTruthy();
    expect(screen.getByText('Zona 1, Ciudad')).toBeTruthy();
    expect(screen.getByText('NEXO-1')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByText(/Teclado · 1 ×/)).toBeTruthy();
    expect(screen.getByText(/Producto · 0 ×/)).toBeTruthy();
  });

  it('renderiza nombres heredados con etiquetas como texto plano en lista y detalle', async () => {
    const unsafeName = '<img src=x onerror=alert(1)>';
    vi.mocked(adminTableService.list).mockResolvedValue([{ id: 'customer-1', data: { Nombre: unsafeName, Correo: 'cliente@example.test', Estado: 'Activo' } }]);
    vi.spyOn(customerService, 'details').mockResolvedValue({ customer: { name: unsafeName, email: 'cliente@example.test' }, wishlistItems: 0, addresses: [], orders: [] });
    const config = { ...usersConfig, title: 'Clientes', columns: ['Nombre', 'Correo', 'Estado'] };
    const { container } = render(<AdminCrudModule section="customers" config={config} />);

    expect(await screen.findByText(unsafeName)).toBeTruthy();
    expect(container.querySelector('img[src="x"]')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: `Ver Clientes: ${unsafeName}` }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog.querySelector('img[src="x"]')).toBeNull();
    expect(dialog.textContent).toContain(unsafeName);
  });

  it('rechaza etiquetas HTML al editar el nombre de un cliente', async () => {
    vi.mocked(adminTableService.list).mockResolvedValue([{ id: 'customer-1', data: { Nombre: 'Cliente Uno', Correo: 'cliente@example.test', Estado: 'Activo' } }]);
    const update = vi.spyOn(adminTableService, 'update');
    const config = { ...usersConfig, title: 'Clientes', action: 'Nuevo cliente', columns: ['Nombre', 'Correo', 'Estado'] };
    render(<AdminCrudModule section="customers" config={config} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Editar Clientes: Cliente Uno' }));
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: '<h1>Cliente</h1>' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect((await screen.findByRole('alert')).textContent).toContain('solo puede contener letras');
    expect(update).not.toHaveBeenCalled();
  });

  it('presenta error cuando no se puede cargar el detalle del cliente', async () => {
    vi.mocked(adminTableService.list).mockResolvedValue([{ id: 'customer-1', data: { Nombre: 'Cliente Uno' } }]);
    vi.spyOn(customerService, 'details').mockRejectedValue(new Error('Servicio de clientes no disponible'));
    const config = { ...usersConfig, title: 'Clientes', columns: ['Nombre'] };

    render(<AdminCrudModule section="customers" config={config} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Ver Clientes: Cliente Uno' }));

    expect((await screen.findByRole('alert')).textContent).toContain('Servicio de clientes no disponible');
  });

  it('muestra los estados vacíos del historial y no ofrece crear clientes desde el panel', async () => {
    vi.mocked(adminTableService.list).mockResolvedValue([{ id: 'customer-1', data: { Nombre: 'Cliente Uno' } }]);
    vi.spyOn(customerService, 'details').mockResolvedValue({ customer: {}, wishlistItems: 0, addresses: [], orders: [] });
    const config = { ...usersConfig, title: 'Clientes', action: undefined, columns: ['Nombre'] };

    render(<AdminCrudModule section="customers" config={config} />);
    expect(screen.queryByRole('button', { name: 'Nuevo cliente' })).toBeNull();
    fireEvent.click(await screen.findByRole('button', { name: 'Ver Clientes: Cliente Uno' }));

    expect(await screen.findByText('Aún no hay compras asociadas a este cliente.')).toBeTruthy();
    expect(screen.getByText('No hay direcciones registradas.')).toBeTruthy();
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('permite reintentar cargar las marcas después de un error de la API', async () => {
    vi.mocked(brandService.list).mockRejectedValueOnce(new Error('Marcas no disponibles'))
      .mockRejectedValueOnce(new Error('Marcas no disponibles')).mockResolvedValueOnce([
      { id: 'brand-1', name: 'NEXO', description: '', contact: '', website: '', status: 'Activa' },
    ]);
    render(<AdminCrudModule section="inventory" config={inventoryConfig} />);
    await screen.findByText('Monitor');
    fireEvent.click(screen.getByRole('button', { name: 'Editar Inventario: Monitor' }));

    expect((await screen.findByRole('alert')).textContent).toContain('Marcas no disponibles');
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByRole('option', { name: 'NEXO' })).toBeTruthy();
  });
});
