// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import AccountingPage from '../modules/accounting/components/AccountingPage';
import SuppliersPage from '../modules/suppliers/components/SuppliersPage';
import { accountingService, merchandisePurchaseService, productInventoryService, supplierService } from '../services';
import { roleService } from '../services/roleService';

const app = vi.hoisted(() => ({ role: 'superadmin' }));
vi.mock('../contexts/AppContext', () => ({ useApp: () => app }));

const movement = { id: 'move-1', date: '2026-10-19', concept: 'Servicio de internet', category: 'Servicios', type: 'Ingreso' as const, amount: 250, status: 'Registrado' as const };
const product = { id: 'product-1', name: 'Monitor', category: 'Pantallas', price: 100, cost: 50, image: '', description: '', sku: 'MON-1', stock: 4, status: 'Activo' as const };
const supplier = { id: 'supplier-1', name: 'Distribuidora NEXO', contactPerson: 'Ana', phone: '5555-0000', email: 'ana@nexo.gt', status: 'Activo' as const, productIds: ['product-1'] };
const purchase = { id: 'purchase-1', supplierId: supplier.id, supplier: supplier.name, date: '2026-10-19', items: [], total: 100, status: 'Registrada' as const };

beforeEach(() => {
  vi.spyOn(roleService, 'can').mockReturnValue(true);
  vi.spyOn(accountingService, 'list').mockResolvedValue([movement]);
  vi.spyOn(accountingService, 'create').mockResolvedValue(movement);
  vi.spyOn(accountingService, 'updateStatus').mockResolvedValue({ ...movement, status: 'Pendiente' });
  vi.spyOn(supplierService, 'list').mockResolvedValue([supplier]);
  vi.spyOn(supplierService, 'create').mockResolvedValue(supplier);
  vi.spyOn(supplierService, 'update').mockResolvedValue(supplier);
  vi.spyOn(supplierService, 'archive').mockResolvedValue(supplier);
  vi.spyOn(supplierService, 'delete').mockResolvedValue(true);
  vi.spyOn(productInventoryService, 'list').mockResolvedValue([product]);
  vi.spyOn(merchandisePurchaseService, 'list').mockResolvedValue([purchase]);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('ingresos y egresos', () => {
  it('presenta el detalle y permite cambiar y anular un movimiento con confirmación', async () => {
    render(<AccountingPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Ver movimiento Servicio de internet' }));
    expect(screen.getByRole('dialog').textContent).toContain('Q 250.00');
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));

    fireEvent.click(screen.getByRole('button', { name: 'Editar estado Servicio de internet' }));
    fireEvent.change(within(screen.getByRole('dialog')).getByLabelText('Estado'), { target: { value: 'Pendiente' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar estado' }));
    await waitFor(() => expect(accountingService.updateStatus).toHaveBeenCalledWith('move-1', 'Pendiente'));

    fireEvent.click(await screen.findByRole('button', { name: 'Editar estado Servicio de internet' }));
    fireEvent.change(within(screen.getByRole('dialog')).getByLabelText('Estado'), { target: { value: 'Anulado' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar estado' }));
    expect(await screen.findByText(/Se conservará en el historial/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar anulación' }));
    await waitFor(() => expect(accountingService.updateStatus).toHaveBeenLastCalledWith('move-1', 'Anulado'));
  });

  it('valida, guarda un egreso y muestra un error del servicio', async () => {
    vi.mocked(accountingService.create).mockRejectedValueOnce(new Error('No se pudo guardar el movimiento'));
    render(<AccountingPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Registrar ingreso o egreso' }));
    fireEvent.change(screen.getByLabelText('Tipo de movimiento'), { target: { value: 'Egreso' } });
    fireEvent.change(screen.getByLabelText('Concepto'), { target: { value: 'Compra de cajas' } });
    fireEvent.change(screen.getByLabelText('Categoría'), { target: { value: 'Suministros' } });
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar movimiento' }));
    expect((await screen.findByRole('alert')).textContent).toContain('monto mayor que cero');

    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '75' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar movimiento' }));
    expect((await screen.findByRole('alert')).textContent).toContain('No se pudo guardar el movimiento');
  });
});

describe('proveedores', () => {
  it('muestra compras y productos relacionados, y archiva en lugar de eliminar relaciones', async () => {
    render(<SuppliersPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Ver proveedor Distribuidora NEXO' }));
    const dialog = screen.getByRole('dialog');
    expect(dialog.textContent).toContain('Monitor');
    expect(dialog.textContent).toContain('Compras registradas');
    expect(dialog.textContent).toContain('Q 100.00');
    fireEvent.click(within(dialog).getAllByRole('button', { name: 'Cerrar' })[0]);

    fireEvent.click(await screen.findByRole('button', { name: 'Eliminar proveedor Distribuidora NEXO' }));
    expect(screen.getByText(/No se puede eliminar sin perder referencias/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Archivar proveedor' }));
    await waitFor(() => expect(supplierService.archive).toHaveBeenCalledWith('supplier-1'));
    expect((await screen.findByRole('status')).textContent).toContain('Proveedor archivado');
  });

  it('permite asociar productos existentes al crear un proveedor', async () => {
    vi.mocked(supplierService.list).mockResolvedValue([]);
    vi.mocked(merchandisePurchaseService.list).mockResolvedValue([]);
    render(<SuppliersPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Nuevo proveedor' }));
    fireEvent.change(screen.getByLabelText('Empresa / nombre *'), { target: { value: '  Proveedor Nuevo  ' } });
    fireEvent.click(screen.getByLabelText(/Monitor/));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar proveedor' }));

    await waitFor(() => expect(supplierService.create).toHaveBeenCalledWith(expect.objectContaining({ name: 'Proveedor Nuevo', productIds: ['product-1'] })));
  });
});
