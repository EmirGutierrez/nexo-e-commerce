import { afterEach, describe, expect, it, vi } from 'vitest';
import { adminTableService, brandService, inventoryService, userService } from '../services';
import { apiClient } from '../shared/services/http-client';

const productRecord = {
  id: 'product-1',
  resource: 'products',
  data: {
    name: 'Monitor', brandId: null, category: 'Electrónica', sku: 'MON-1', price: 149,
    cost: '', stock: 8, status: 'Activo', image: '', location: 'Bodega A', description: 'Monitor de prueba',
  },
};

afterEach(() => vi.restoreAllMocks());

describe('servicios de inventario', () => {
  it('consulta los productos con la ruta y los permisos de inventario', async () => {
    const get = vi.spyOn(apiClient, 'get').mockResolvedValueOnce([productRecord] as never);

    const [product] = await inventoryService.products();

    expect(get).toHaveBeenCalledWith('/api/business/inventory/products');
    expect(product).toMatchObject({ id: 'product-1', name: 'Monitor', stock: 8, location: 'Bodega A' });
    expect(product.cost).toBeUndefined();
  });

  it('consulta las ubicaciones persistentes mediante la API de inventario', async () => {
    const get = vi.spyOn(apiClient, 'get').mockResolvedValueOnce(['Bodega A', 'Bodega B'] as never);

    await expect(inventoryService.locations()).resolves.toEqual(['Bodega A', 'Bodega B']);

    expect(get).toHaveBeenCalledWith('/api/business/inventory/locations');
  });

  it('carga la tabla del inventario sin usar permisos de catálogo', async () => {
    const get = vi.spyOn(apiClient, 'get').mockResolvedValueOnce([productRecord] as never);

    const [row] = await adminTableService.list('inventory');

    expect(get).toHaveBeenCalledWith('/api/business/inventory/products');
    expect(row).toEqual({
      id: 'product-1',
      data: expect.objectContaining({ Producto: 'Monitor', SKU: 'MON-1', Existencias: 8, Ubicación: 'Bodega A', 'Costo unitario': '', Descripción: 'Monitor de prueba' }),
    });
  });

  it('filtra alertas de productos inactivos y respeta el límite de bajo stock', async () => {
    const records = [
      { ...productRecord, id: 'active-low', data: { ...productRecord.data, name: 'Activo con poco stock', stock: 3 } },
      { ...productRecord, id: 'inactive-low', data: { ...productRecord.data, name: 'Inactivo', stock: 3, status: 'Inactivo' } },
      { ...productRecord, id: 'active-stocked', data: { ...productRecord.data, name: 'Activo con stock suficiente', stock: 10 } },
    ];
    const get = vi.spyOn(apiClient, 'get').mockResolvedValueOnce(records as never);

    const alerts = await adminTableService.list('inventory/alerts');

    expect(get).toHaveBeenCalledWith('/api/business/inventory/products');
    expect(alerts).toEqual([
      { id: 'active-low', data: expect.objectContaining({ Producto: 'Activo con poco stock', Existencias: 3 }) },
    ]);
  });

  it('actualiza costo, precio, existencias y ubicación mediante la ruta de inventario', async () => {
    const get = vi.spyOn(apiClient, 'get').mockResolvedValueOnce([productRecord] as never);
    const put = vi.spyOn(apiClient, 'put').mockResolvedValueOnce({
      ...productRecord,
      data: { ...productRecord.data, cost: null, price: 159, stock: 5, location: 'Bodega B', description: 'Monitor actualizado' },
    } as never);

    await adminTableService.update('inventory', 'product-1', {
      Producto: 'Monitor', Marca: '', Categoría: 'Electrónica', SKU: 'MON-1',
      'Costo unitario': '', 'Precio de venta': 159, Existencias: 5,
      Ubicación: 'Bodega B', Estado: 'En stock', Descripción: 'Monitor actualizado', Imagen: '',
    });

    expect(get).toHaveBeenCalledWith('/api/business/inventory/products');
    expect(put).toHaveBeenCalledWith('/api/business/inventory/products/product-1', expect.objectContaining({
      cost: null, price: 159, stock: 5, location: 'Bodega B', description: 'Monitor actualizado',
    }));
  });

  it('elimina por la ruta protegida del inventario y devuelve si el borrado fue físico', async () => {
    const remove = vi.spyOn(apiClient, 'delete').mockResolvedValueOnce({ deleted: false } as never);

    const result = await adminTableService.delete('inventory', 'product-1');

    expect(remove).toHaveBeenCalledWith('/api/business/inventory/products/product-1');
    expect(result).toEqual({ deleted: false });
  });

  it('carga las marcas persistentes desde la API de negocios', async () => {
    const get = vi.spyOn(apiClient, 'get').mockResolvedValueOnce([{
      id: 'brand-1', resource: 'brands', data: { name: 'Marca API', status: 'Activa' },
    }] as never);

    await expect(brandService.list()).resolves.toEqual([expect.objectContaining({ id: 'brand-1', name: 'Marca API', status: 'Activa' })]);
    expect(get).toHaveBeenCalledWith('/api/business/brands');
  });

  it('elimina un usuario del equipo mediante el endpoint de cuenta', async () => {
    const remove = vi.spyOn(apiClient, 'delete').mockResolvedValueOnce(undefined as never);

    await userService.delete('user-1');

    expect(remove).toHaveBeenCalledWith('/api/users/user-1');
  });
});
