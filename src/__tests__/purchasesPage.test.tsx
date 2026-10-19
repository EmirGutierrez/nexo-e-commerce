// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import PurchasesPage from '../modules/purchases/components/PurchasesPage';
import { merchandisePurchaseService, productInventoryService, supplierService } from '../services';
import { roleService } from '../services/roleService';

const app = vi.hoisted(() => ({ role: 'superadmin', notifyAdmin: vi.fn() }));
vi.mock('../contexts/AppContext', () => ({ useApp: () => app }));

const supplier = { id: 'supplier-1', name: 'Distribuidora NEXO', contactPerson: 'Ana', phone: '', email: '', status: 'Activo' as const, productIds: ['product-1'] };
const product = { id: 'product-1', name: 'Monitor', category: 'Pantallas', price: 100, cost: 20, image: '', description: '', sku: 'MON-1', stock: 4, status: 'Activo' as const };
const purchase = {
  id: 'PUR-1', supplierId: supplier.id, supplier: supplier.name, date: '2026-10-19',
  items: [{ productId: product.id, productName: product.name, quantity: 2, unitCost: 25 }],
  total: 50, status: 'Registrada' as const,
};

beforeEach(() => {
  app.notifyAdmin.mockClear();
  vi.spyOn(merchandisePurchaseService, 'list').mockResolvedValue([]);
  vi.spyOn(merchandisePurchaseService, 'create').mockResolvedValue(purchase);
  vi.spyOn(merchandisePurchaseService, 'updateStatus').mockResolvedValue(purchase);
  vi.spyOn(supplierService, 'list').mockResolvedValue([supplier]);
  vi.spyOn(productInventoryService, 'list').mockResolvedValue([product]);
  vi.spyOn(roleService, 'can').mockReturnValue(true);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('compras de mercancía', () => {
  it('permite borrar la cantidad, calcula el total con el costo editable y anula la compra conservando historial', async () => {
    render(<PurchasesPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Registrar compra' }));

    const quantity = screen.getByLabelText('Cantidad') as HTMLInputElement;
    expect(quantity.value).toBe('1');
    fireEvent.change(quantity, { target: { value: '' } });
    expect(quantity.value).toBe('');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar compra' }));
    expect((await screen.findByRole('alert')).textContent).toContain('cantidades enteras');

    fireEvent.change(screen.getByLabelText('Cantidad'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Costo unitario (Q)'), { target: { value: '25' } });
    expect(screen.getAllByText('Q 50.00')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Guardar compra' }));

    await waitFor(() => expect(merchandisePurchaseService.create).toHaveBeenCalledWith(expect.objectContaining({
      supplierId: 'supplier-1', supplier: 'Distribuidora NEXO', total: 50, status: 'Registrada',
      items: [{ productId: 'product-1', productName: 'Monitor', quantity: 2, unitCost: 25 }],
    })));
    expect(app.notifyAdmin).toHaveBeenCalled();

    fireEvent.click(await screen.findByRole('button', { name: 'Anular compra PUR-1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar anulación' }));
    await waitFor(() => expect(merchandisePurchaseService.updateStatus).toHaveBeenCalledWith('PUR-1', 'Anulada'));
    expect(screen.getByRole('status').textContent).toContain('el movimiento de stock se revirtió');
  });
});
