// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import CustomerAccountPage from '../modules/commerce/components/CustomerAccountPage';
import CustomerOrderDetailPage from '../modules/commerce/components/CustomerOrderDetailPage';
import { customerPortalService, type CustomerOrder } from '../services';
import { fetchCatalogFromApi } from '../modules/products/services/productService';

const appContext = vi.hoisted(() => ({
  user: null as null | { id: string; name: string; email: string; role: string; initials: string; status: string },
  userType: 'customer' as 'customer' | 'admin' | null,
  authLoading: false,
}));

vi.mock('../contexts/AppContext', () => ({ useApp: () => appContext }));
vi.mock('../modules/products/services/productService', () => ({ fetchCatalogFromApi: vi.fn() }));

const makeOrder = (data: CustomerOrder['data'] = {}, orderFields: Partial<CustomerOrder> = {}): CustomerOrder => ({
  id: 'order-1',
  createdAt: '2026-10-15T12:00:00.000Z',
  data: {
    orderNumber: 'NX-100',
    customer: 'Emir Gutierrez',
    customerEmail: 'emir@example.com',
    customerPhone: '5555-0101',
    address: 'Zona 1, Ciudad de Guatemala',
    date: '2026-10-15T12:00:00.000Z',
    status: 'Completado',
    paymentStatus: 'Aprobado',
    paymentMethod: 'card',
    payment: 'Tarjeta simulada',
    subtotal: 100,
    discountAmount: 10,
    discountCode: 'NEXO10',
    total: 90,
    items: [{ productId: 'product-1', productName: 'Monitor', sku: 'MON-1', quantity: 2, unitPrice: 50, subtotal: 100 }],
    ...data,
  },
  ...orderFields,
});

const catalog = {
  source: 'api' as const,
  products: [{ id: 'product-1', image: 'https://example.test/monitor.webp' }],
};

beforeEach(() => {
  appContext.user = { id: 'customer-1', name: 'Emir Gutierrez', email: 'emir@example.com', role: 'customer', initials: 'EG', status: 'Activo' };
  appContext.userType = 'customer';
  appContext.authLoading = false;
  window.history.replaceState({}, '', '/account');
  vi.spyOn(customerPortalService, 'orders').mockResolvedValue([makeOrder()]);
  vi.mocked(fetchCatalogFromApi).mockResolvedValue(catalog as never);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('detalle de pedido del cliente', () => {
  it('muestra importes, seguimiento, artículos e imagen del catálogo', async () => {
    render(<CustomerOrderDetailPage orderId="order-1" />);

    expect(await screen.findByRole('heading', { name: 'NX-100' })).toBeTruthy();
    expect(screen.getAllByText('Completado').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Aprobado')).toBeTruthy();
    expect(screen.getByText('Monitor')).toBeTruthy();
    expect(screen.getByText('SKU MON-1')).toBeTruthy();
    expect(screen.getAllByText('Q 100.00').length).toBe(2);
    expect(screen.getByText('Q 90.00')).toBeTruthy();
    expect(screen.getByText('(NEXO10)')).toBeTruthy();
    expect(screen.getByText('Tarjeta simulada')).toBeTruthy();
    expect(screen.getByText('Zona 1, Ciudad de Guatemala')).toBeTruthy();
    expect(screen.getByAltText('Monitor').getAttribute('src')).toBe('https://example.test/monitor.webp');
    expect(screen.getByRole('list', { name: 'Progreso del pedido' })).toBeTruthy();
  });

  it('presenta el aviso de cancelación y el estado vacío de artículos', async () => {
    vi.mocked(customerPortalService.orders).mockResolvedValueOnce([makeOrder({ status: 'Cancelado', orderNumber: undefined, date: undefined, items: undefined }, { createdAt: undefined })]);
    render(<CustomerOrderDetailPage orderId="order-1" />);

    expect(await screen.findByText(/Este pedido fue cancelado/)).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'NX-ORDER-1' })).toBeTruthy();
    expect(screen.getByText(/Fecha no disponible/)).toBeTruthy();
    expect(screen.queryByRole('list', { name: 'Progreso del pedido' })).toBeNull();
    expect(screen.getByText('El pedido no incluye el detalle de sus artículos.')).toBeTruthy();
  });

  it('explica la expiración de una reserva de transferencia', async () => {
    vi.mocked(customerPortalService.orders).mockResolvedValueOnce([
      makeOrder({ status: 'Cancelado', paymentStatus: 'Expirada' }),
    ]);
    render(<CustomerOrderDetailPage orderId="order-1" />);

    expect(await screen.findByText(/La reserva venció tras 24 horas/)).toBeTruthy();
    expect(screen.getByText(/Si ya realizaste la transferencia/)).toBeTruthy();
  });

  it('muestra el inicio de sesión si la sesión aún carga o no hay cliente', () => {
    appContext.authLoading = true;
    const loading = render(<CustomerOrderDetailPage orderId="order-1" />);
    expect(screen.getByRole('status').textContent).toContain('Comprobando sesión');
    loading.unmount();

    appContext.authLoading = false;
    appContext.user = null;
    appContext.userType = null;
    render(<CustomerOrderDetailPage orderId="order-1" />);
    expect(screen.getByRole('heading', { name: 'Inicia sesión para ver este pedido' })).toBeTruthy();
    expect(customerPortalService.orders).not.toHaveBeenCalled();

    cleanup();
    appContext.user = { id: 'admin-1', name: 'Admin', email: 'admin@example.com', role: 'admin', initials: 'AD', status: 'Activo' };
    appContext.userType = 'admin';
    render(<CustomerOrderDetailPage orderId="order-1" />);
    expect(screen.getByRole('heading', { name: 'Inicia sesión para ver este pedido' })).toBeTruthy();
    expect(customerPortalService.orders).not.toHaveBeenCalled();
  });

  it('indica que el pedido no pertenece al historial disponible', async () => {
    vi.mocked(customerPortalService.orders).mockResolvedValueOnce([]);
    render(<CustomerOrderDetailPage orderId="unknown-order" />);

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByText('No encontramos ese pedido en tu historial.')).toBeTruthy();
  });

  it('mantiene el detalle si falla el catálogo y usa datos derivados del pedido', async () => {
    vi.mocked(customerPortalService.orders).mockResolvedValueOnce([makeOrder({
      status: 'En preparación', paymentMethod: 'transfer', payment: undefined,
      date: 'fecha inválida', subtotal: undefined, discountAmount: undefined, discountCode: undefined,
      items: [{ productName: 'Teclado', quantity: 2, unitPrice: 25 }],
    })]);
    vi.mocked(fetchCatalogFromApi).mockRejectedValueOnce(new Error('Catálogo no disponible'));
    render(<CustomerOrderDetailPage orderId="order-1" />);

    expect((await screen.findAllByText('En preparación')).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Transferencia bancaria')).toBeTruthy();
    expect(screen.getAllByText('Q 50.00').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Fecha no disponible/)).toBeTruthy();
    expect(screen.getByText('Teclado')).toBeTruthy();
  });

  it('completa los datos faltantes con valores seguros y muestra el paso de pago pendiente', async () => {
    appContext.user!.email = '';
    vi.mocked(customerPortalService.orders).mockResolvedValueOnce([makeOrder({
      orderNumber: undefined, customer: undefined, customerEmail: undefined, customerPhone: undefined,
      address: undefined, date: undefined, status: undefined, paymentStatus: undefined,
      paymentMethod: 'card', payment: undefined, subtotal: undefined, discountAmount: 0,
      discountCode: 'SIN-DESCUENTO', total: undefined,
      items: [{ productId: 'product-without-image', productName: undefined, sku: undefined, quantity: 0, unitPrice: Number.NaN, subtotal: 0 }],
    })]);
    vi.mocked(fetchCatalogFromApi).mockResolvedValueOnce({ source: 'api', products: [{ id: 'product-without-image', image: '' }] } as never);
    render(<CustomerOrderDetailPage orderId="order-1" />);

    expect(await screen.findByRole('heading', { name: 'NX-ORDER-1' })).toBeTruthy();
    expect(screen.getByText('Pendiente de pago')).toBeTruthy();
    expect(screen.getByText('Pendiente de actualización')).toBeTruthy();
    expect(screen.getByText('Tarjeta simulada')).toBeTruthy();
    expect(screen.getByText('Código aplicado')).toBeTruthy();
    expect(screen.getByText('SIN-DESCUENTO')).toBeTruthy();
    expect(screen.getByText('Persona que recibe el pedido')).toBeTruthy();
    expect(screen.getByText('Dirección no disponible en el pedido')).toBeTruthy();
    expect(screen.getByText('Código no disponible')).toBeTruthy();
    expect(screen.getByText('Producto')).toBeTruthy();
    expect(screen.getByText('Estado de pago no disponible')).toBeTruthy();
    expect(screen.getByText('Precio unitario').parentElement?.querySelector('strong')?.textContent).toBe('—');
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('muestra un error entendible si falla la consulta del pedido', async () => {
    vi.mocked(customerPortalService.orders).mockRejectedValueOnce(new Error('API temporalmente no disponible'));
    render(<CustomerOrderDetailPage orderId="order-1" />);

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByText('API temporalmente no disponible')).toBeTruthy();
  });

  it('usa un mensaje genérico si el servicio rechaza con un valor que no es Error', async () => {
    vi.mocked(customerPortalService.orders).mockRejectedValueOnce('fallo inesperado');
    render(<CustomerOrderDetailPage orderId="order-1" />);

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByText('No se pudo cargar el detalle del pedido.')).toBeTruthy();
  });
});

describe('historial de compras del cliente', () => {
  it('permite cambiar la contraseña desde el perfil de cliente', async () => {
    window.history.replaceState({}, '', '/account');
    vi.mocked(customerPortalService.orders).mockResolvedValueOnce([]);
    vi.spyOn(customerPortalService, 'wishlist').mockResolvedValueOnce([]);
    render(<CustomerAccountPage />);

    expect(await screen.findByRole('heading', { name: 'Cambiar contraseña' })).toBeTruthy();
    expect(screen.getByLabelText('Confirmar nueva contraseña')).toBeTruthy();
  });

  it('enlaza pedidos y presenta valores alternativos cuando faltan datos', async () => {
    window.history.replaceState({}, '', '/account?section=orders');
    vi.mocked(customerPortalService.orders).mockResolvedValueOnce([
      makeOrder({ items: [{ quantity: 2 }], paymentStatus: 'Aprobado' }),
      makeOrder({
        orderNumber: undefined, customer: undefined, date: undefined, status: undefined,
        paymentStatus: undefined, total: undefined, items: [{ quantity: undefined }],
      }, { id: 'order-2' }),
      makeOrder({ items: undefined }, { id: 'order-3' }),
    ]);
    vi.spyOn(customerPortalService, 'wishlist').mockResolvedValueOnce([]);
    render(<CustomerAccountPage />);

    const detailLinks = await screen.findAllByRole('link', { name: /Ver detalle/ });
    expect(detailLinks.map((link) => link.getAttribute('href'))).toEqual([
      '/account/orders/order-1', '/account/orders/order-2', '/account/orders/order-3',
    ]);
    expect(screen.getByText('Pedido')).toBeTruthy();
    expect(screen.getByText('NX-ORDER-2')).toBeTruthy();
    expect(screen.getByText('Registrado')).toBeTruthy();
    expect(screen.getByText('0 productos · pago registrado')).toBeTruthy();
  });

  it('muestra el estado vacío cuando la cuenta no tiene pedidos', async () => {
    window.history.replaceState({}, '', '/account?section=orders');
    vi.mocked(customerPortalService.orders).mockResolvedValueOnce([]);
    vi.spyOn(customerPortalService, 'wishlist').mockResolvedValueOnce([]);
    render(<CustomerAccountPage />);

    expect(await screen.findByRole('heading', { name: 'Aún no tienes compras' })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Explorar la tienda/ }).getAttribute('href')).toBe('/store');
  });
});
