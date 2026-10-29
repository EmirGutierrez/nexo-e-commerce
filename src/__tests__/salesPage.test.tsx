// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import SalesPage from '../modules/sales/components/SalesPage';
import { orderService, productInventoryService, salesService } from '../services';
import { roleService } from '../services/roleService';

const app = vi.hoisted(() => ({
  user: { name: 'Emir' },
  role: 'superadmin',
  paymentMethods: { card: false, transfer: false },
}));

vi.mock('../contexts/AppContext', () => ({ useApp: () => app }));

const product = {
  id: 'product-1', name: 'Monitor NEXO', category: 'Pantallas', price: 100, image: '',
  description: 'Monitor', sku: 'MON-1', stock: 4, status: 'Activo' as const,
};
const soldOut = { ...product, id: 'product-empty', name: 'Agotado', sku: 'MON-0', stock: 0 };
const inactive = { ...product, id: 'product-inactive', name: 'Inactivo', sku: 'MON-X', status: 'Inactivo' as const };
const sale = {
  id: 'SALE-1', date: '2026-10-19T12:00:00Z', seller: 'Emir', customerName: 'Ana Pérez',
  customerEmail: 'ana@example.com', nit: '1234567-8', paymentMethod: 'cash' as const,
  paymentStatus: 'Completada' as const, amountReceived: 120, change: 20, total: 100,
  items: [{ productId: 'product-1', productName: 'Monitor NEXO', sku: 'MON-1', quantity: 1, unitPrice: 100, subtotal: 100 }],
};
const order = {
  id: 'ORDER-1', customer: 'Luis Gómez', date: '2026-10-18T12:00:00Z', items: 1,
  itemDetails: [{ productId: 'product-1', productName: 'Monitor NEXO', sku: 'MON-1', quantity: 1, unitPrice: 100, subtotal: 100 }],
  total: 100, status: 'Pendiente de pago' as const, payment: 'Tarjeta' as const,
  customerEmail: 'luis@example.com', customerPhone: '5555-1234', address: 'Zona 1', nit: 'CF',
  paymentStatus: 'Pendiente', subtotal: 100, discountAmount: 0, previousStatus: 'Pendiente de pago',
};

beforeEach(() => {
  vi.spyOn(productInventoryService, 'list').mockResolvedValue([product, soldOut, inactive]);
  vi.spyOn(salesService, 'listInPerson').mockResolvedValue([]);
  vi.spyOn(orderService, 'list').mockResolvedValue([]);
  vi.spyOn(salesService, 'createInPerson').mockResolvedValue(sale);
  vi.spyOn(orderService, 'updateStatus').mockResolvedValue(order);
  vi.spyOn(roleService, 'can').mockReturnValue(true);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('ventas presenciales e historial', () => {
  it('oculta productos no disponibles, valida cliente y registra la venta con comprobante', async () => {
    render(<SalesPage />);
    fireEvent.click(screen.getByRole('button', { name: /Venta presencial/ }));

    expect(await screen.findByText('Monitor NEXO')).toBeTruthy();
    expect(screen.queryByText('Agotado')).toBeNull();
    expect(screen.queryByText('Inactivo')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Agregar Monitor NEXO/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Continuar al cobro' }));
    fireEvent.change(screen.getByPlaceholderText('Ej. 1234567-8 o CF'), { target: { value: '1234567-8' } });
    fireEvent.click(screen.getByRole('button', { name: /Registrar venta y comprobante/ }));
    expect((await screen.findByRole('alert')).textContent).toContain('Ingresa el nombre del cliente');

    fireEvent.change(screen.getByPlaceholderText('Nombre para el comprobante'), { target: { value: '1234' } });
    fireEvent.change(screen.getByPlaceholderText('cliente@correo.com'), { target: { value: '7777@77777' } });
    fireEvent.click(screen.getByRole('button', { name: /Registrar venta y comprobante/ }));
    expect((await screen.findByRole('alert')).textContent).toContain('Ingresa el nombre del cliente');

    fireEvent.change(screen.getByPlaceholderText('Nombre para el comprobante'), { target: { value: 'Ana Pérez' } });
    fireEvent.click(screen.getByRole('button', { name: /Registrar venta y comprobante/ }));
    expect((await screen.findByRole('alert')).textContent).toContain('Ingresa un correo válido');

    fireEvent.change(screen.getByPlaceholderText('cliente@correo.com'), { target: { value: 'ana@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /Registrar venta y comprobante/ }));
    expect((await screen.findByRole('alert')).textContent).toContain('El monto recibido debe cubrir');

    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '120' } });
    fireEvent.click(screen.getByRole('button', { name: /Registrar venta y comprobante/ }));
    await screen.findByRole('dialog', { name: 'SALE-1' });
    expect(salesService.createInPerson).toHaveBeenCalledWith({
      customerName: 'Ana Pérez', customerEmail: 'ana@example.com', nit: '1234567-8',
      paymentMethod: 'cash', amountReceived: 120, items: [{ productId: 'product-1', quantity: 1 }],
    });
  });

  it('muestra el detalle del pedido y guarda una transición de estado permitida', async () => {
    vi.mocked(orderService.list).mockResolvedValue([order]);
    vi.mocked(salesService.listInPerson).mockResolvedValue([sale]);
    render(<SalesPage />);
    fireEvent.click(screen.getByRole('button', { name: /Ver historial/ }));

    await screen.findByText('ORDER-1');
    fireEvent.click(screen.getByRole('button', { name: 'Ver Pedido en línea ORDER-1' }));
    expect(await screen.findByRole('dialog', { name: 'ORDER-1' })).toBeTruthy();
    const orderDialog = screen.getByRole('dialog', { name: 'ORDER-1' });
    expect(orderDialog.textContent).toContain('luis@example.com');
    expect(orderDialog.textContent).toContain('Zona 1');
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar detalle' }));

    fireEvent.click(screen.getByRole('button', { name: 'Editar pedido ORDER-1' }));
    fireEvent.change(screen.getByLabelText('Estado del pedido'), { target: { value: 'En preparación' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(orderService.updateStatus).toHaveBeenCalledWith('ORDER-1', 'En preparación'));
    await waitFor(() => expect(screen.getAllByText('En preparación').length).toBeGreaterThanOrEqual(2));

    fireEvent.click(screen.getByRole('button', { name: 'Ver Venta presencial SALE-1' }));
    const saleDialog = await screen.findByRole('dialog', { name: 'SALE-1' });
    expect(saleDialog.textContent).toContain('ana@example.com');
    expect(saleDialog.textContent).toContain('1234567-8');
    expect(saleDialog.textContent).toContain('Efectivo recibido / cambio');
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar detalle de la venta' }));
    expect(screen.queryByRole('dialog', { name: 'SALE-1' })).toBeNull();
  });
});
