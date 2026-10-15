// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import AdminCrudModule, { statusChoices, tableColumnWidth } from '../modules/products/components/AdminCrudModule';
import { moduleConfig } from '../modules/app/components/NexoPages';
import { adminTableService, brandService, inventoryService } from '../services';
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
