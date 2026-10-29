// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import PurchasesPage from '../modules/purchases/components/PurchasesPage';
import { merchandisePurchaseService, productInventoryService, supplierService } from '../services';
import { roleService } from '../services/roleService';
import { businessToday } from '../shared/utils/businessDate';

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
    fireEvent.change(screen.getByLabelText('Fecha de compra'), { target: { value: businessToday() } });
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

  it('rechaza proveedor o fecha vacíos, cantidades fraccionarias y costos que no son positivos', async () => {
    render(<PurchasesPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Registrar compra' }));

    const save = () => fireEvent.click(screen.getByRole('button', { name: 'Guardar compra' }));
    const supplierSelect = screen.getByLabelText('Proveedor');
    fireEvent.change(supplierSelect, { target: { value: '' } });
    save();
    expect((await screen.findByRole('alert')).textContent).toContain('Selecciona un proveedor');

    fireEvent.change(supplierSelect, { target: { value: supplier.id } });
    fireEvent.change(screen.getByLabelText('Fecha de compra'), { target: { value: '' } });
    save();
    expect(screen.getByRole('alert').textContent).toContain('fecha de compra válida');

    fireEvent.change(screen.getByLabelText('Fecha de compra'), { target: { value: businessToday() } });
    fireEvent.change(screen.getByLabelText('Cantidad'), { target: { value: '1.5' } });
    save();
    expect(screen.getByRole('alert').textContent).toContain('cantidades enteras');

    fireEvent.change(screen.getByLabelText('Cantidad'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Costo unitario (Q)'), { target: { value: '0' } });
    save();

    expect(screen.getByRole('alert').textContent).toContain('costos mayores que cero');
    expect(merchandisePurchaseService.create).not.toHaveBeenCalled();
  });

  it('exige confirmar una compra retroactiva antes de enviarla', async () => {
    render(<PurchasesPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Registrar compra' }));
    fireEvent.change(screen.getByLabelText('Fecha de compra'), { target: { value: '2026-10-19' } });
    expect(screen.getByRole('status').textContent).toContain('anterior a hoy');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar compra' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Confirma que esta compra');
    expect(merchandisePurchaseService.create).not.toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText('Confirmo que es un registro histórico'));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar compra' }));
    await waitFor(() => expect(merchandisePurchaseService.create).toHaveBeenCalledWith(
      expect.objectContaining({ date: '2026-10-19' }), { confirmHistoricalDate: true },
    ));
  });

  it('agrega otra línea, rechaza el producto duplicado y permite quitarlo', async () => {
    const secondProduct = { ...product, id: 'product-2', name: 'Teclado', sku: 'TEC-2', cost: 30 };
    const supplierWithTwoProducts = { ...supplier, productIds: [product.id, secondProduct.id] };
    vi.mocked(supplierService.list).mockResolvedValueOnce([supplierWithTwoProducts]);
    vi.mocked(productInventoryService.list).mockResolvedValueOnce([product, secondProduct]);

    render(<PurchasesPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Registrar compra' }));
    fireEvent.click(screen.getByRole('button', { name: 'Agregar producto' }));

    const productSelects = screen.getAllByLabelText('Producto');
    expect(productSelects).toHaveLength(2);
    fireEvent.change(productSelects[1], { target: { value: product.id } });
    expect((await screen.findByRole('alert')).textContent).toContain('ya está en otra línea');

    fireEvent.change(productSelects[1], { target: { value: secondProduct.id } });
    expect((screen.getAllByLabelText('Costo unitario (Q)')[1] as HTMLInputElement).value).toBe('30');
    expect(screen.getByText('Q 50.00')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Quitar Teclado' }));
    expect(screen.getAllByLabelText('Producto')).toHaveLength(1);
  });

  it('mantiene un control accesible para la flecha de Proveedor, Estado y Producto', async () => {
    render(<PurchasesPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Registrar compra' }));

    const purchaseForm = within(screen.getByRole('dialog', { name: 'Registrar compra' }));
    const selects = [purchaseForm.getByLabelText('Proveedor'), purchaseForm.getByLabelText('Estado'), purchaseForm.getByLabelText('Producto')] as HTMLSelectElement[];
    expect(selects.every((select) => select.classList.contains('purchase-select'))).toBe(true);
    selects[0].focus();
    expect(document.activeElement).toBe(selects[0]);

    fireEvent.change(selects[0], { target: { value: supplier.id } });
    fireEvent.change(selects[1], { target: { value: 'Pendiente' } });
    fireEvent.change(selects[2], { target: { value: product.id } });
    expect(selects.map((select) => select.value)).toEqual([supplier.id, 'Pendiente', product.id]);
  });
});
