// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CheckoutExperience, ConfirmationExperience } from '../modules/commerce/components/CommercePages';
import { Checkout } from '../modules/app/components/NexoPages';
import { checkoutService } from '../services';
import { ApiError } from '../shared/services/http-client';

const appState = vi.hoisted(() => ({
  cart: [{ id: 'product-1', brandId: 'brand-1', name: 'Monitor', category: 'Tecnología', price: 100, stock: 8,
    status: 'Activo' as const, image: '', description: 'Monitor demo', sku: 'MON-1', quantity: 1 }],
  cartLoaded: true,
  cartCount: 1,
  cartTotal: 100,
  paymentMethods: { card: true, transfer: true },
  user: null,
  removeFromCart: vi.fn(),
  clearCart: vi.fn(),
}));

vi.mock('../contexts/AppContext', () => ({ useApp: () => appState }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), useParams: () => ({}) }));
vi.mock('../modules/app/components/PublicAccountControls', () => ({ default: () => null }));
vi.mock('../modules/app/components/FloatingCartButton', () => ({ default: () => null }));
vi.mock('../modules/commerce/components/CustomerNotificationBell', () => ({ default: () => null }));

beforeEach(() => {
  window.history.replaceState({}, '', '/checkout');
  window.sessionStorage.clear();
  appState.cart = [{ id: 'product-1', brandId: 'brand-1', name: 'Monitor', category: 'Tecnología', price: 100, stock: 8,
    status: 'Activo', image: '', description: 'Monitor demo', sku: 'MON-1', quantity: 1 }];
  appState.cartTotal = 100;
  appState.removeFromCart.mockClear();
  appState.clearCart.mockClear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('checkout público', () => {
  it('muestra el precio vigente y exige una nueva confirmación antes de crear el pedido', async () => {
    const quote = {
      subtotal: 120, discount: 0, total: 120,
      items: [{ productId: 'product-1', productName: 'Monitor', quantity: 1, unitPrice: 120, subtotal: 120 }],
    };
    const quoteSpy = vi.spyOn(checkoutService, 'quote').mockResolvedValue(quote);
    const createSpy = vi.spyOn(checkoutService, 'create').mockResolvedValue({
      reference: 'NX-12345678', total: 120, paymentMethod: 'card', paymentStatus: 'Simulada',
    });
    render(<CheckoutExperience />);

    fireEvent.change(screen.getByLabelText('Nombre completo'), { target: { value: 'Cliente Demo' } });
    fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: 'cliente@example.test' } });
    fireEvent.change(screen.getByLabelText('NIT'), { target: { value: 'CF' } });
    fireEvent.change(screen.getByLabelText('Teléfono'), { target: { value: '5555-0101' } });
    fireEvent.change(screen.getByLabelText('Dirección de entrega'), { target: { value: 'Zona 1' } });
    fireEvent.change(screen.getByLabelText('Ciudad'), { target: { value: 'Guatemala' } });
    const form = screen.getByRole('button', { name: /Confirmar pedido/ }).closest('form');
    if (!form) throw new Error('No se encontró el formulario de checkout.');
    fireEvent.submit(form);

    expect((await screen.findByRole('alert')).textContent).toContain('Los precios, existencias o descuentos cambiaron');
    expect(screen.getAllByText('Q 120.00').length).toBeGreaterThan(0);
    expect(quoteSpy).toHaveBeenCalledWith({ items: [{ productId: 'product-1', quantity: 1 }], discountCode: undefined });
    expect(createSpy).not.toHaveBeenCalled();

    submitCommerceCheckout();
    await waitFor(() => expect(createSpy).toHaveBeenCalled());
    expect(createSpy.mock.calls[0][2]).toBe(120);
  });

  it('crea el pedido solo después de confirmar la cotización vigente', async () => {
    vi.spyOn(checkoutService, 'quote').mockResolvedValue({
      subtotal: 100, discount: 0, total: 100,
      items: [{ productId: 'product-1', productName: 'Monitor', quantity: 1, unitPrice: 100, subtotal: 100 }],
    });
    const createSpy = vi.spyOn(checkoutService, 'create').mockResolvedValue({
      reference: 'NX-12345678', total: 100, paymentMethod: 'card', paymentStatus: 'Simulada',
    });
    render(<CheckoutExperience />);
    fillCommerceCheckout();
    submitCommerceCheckout();

    await waitFor(() => expect(createSpy).toHaveBeenCalled());
    expect(createSpy.mock.calls[0][2]).toBe(100);
    expect(createSpy.mock.calls[0][1]).toMatch(/^[0-9a-f-]{36}$/i);
    expect(appState.removeFromCart).toHaveBeenCalledWith('product-1');
    expect(await screen.findByText('Procesando tu pedido...')).toBeTruthy();
  });

  it('recupera un pedido que ya se guardó aunque la respuesta original falle', async () => {
    const idempotencyKey = '13814000-1dd2-11b2-8000-000000000001';
    window.sessionStorage.setItem('nexo-checkout-idempotency.v1', idempotencyKey);
    vi.spyOn(checkoutService, 'findSubmission').mockResolvedValue({
      reference: 'NX-RECOVERED', total: 100, paymentMethod: 'card', paymentStatus: 'Simulada',
    });

    render(<CheckoutExperience />);

    await waitFor(() => expect(appState.removeFromCart).toHaveBeenCalledWith('product-1'));
    expect(await screen.findByText('Procesando tu pedido...')).toBeTruthy();
  });

  it('conserva el error original cuando no puede consultar un envío en conflicto', async () => {
    vi.spyOn(checkoutService, 'quote').mockResolvedValue({
      subtotal: 100, discount: 0, total: 100,
      items: [{ productId: 'product-1', productName: 'Monitor', quantity: 1, unitPrice: 100, subtotal: 100 }],
    });
    vi.spyOn(checkoutService, 'create').mockRejectedValue(new ApiError('El total cambió', 409));
    const findSpy = vi.spyOn(checkoutService, 'findSubmission').mockRejectedValue(new Error('sin conexión'));
    render(<CheckoutExperience />);
    fillCommerceCheckout();
    submitCommerceCheckout();

    expect((await screen.findByRole('alert')).textContent).toContain('El total cambió');
    expect(findSpy).toHaveBeenCalledOnce();
  });

  it('permite reintentar la recuperación cuando no se puede consultar el estado', async () => {
    const idempotencyKey = '13814000-1dd2-11b2-8000-000000000001';
    appState.cart = [];
    appState.cartCount = 0;
    appState.cartTotal = 0;
    window.sessionStorage.setItem('nexo-checkout-idempotency.v1', idempotencyKey);
    const findSpy = vi.spyOn(checkoutService, 'findSubmission').mockRejectedValue(new Error('sin conexión'));

    render(<CheckoutExperience />);
    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: 'Volver a comprobar' }));

    await waitFor(() => expect(findSpy).toHaveBeenCalledTimes(2));
    expect(screen.getByRole('alert').textContent).toContain('No pudimos verificar');
  });

  it('muestra la confirmación mínima desde la URL si el almacenamiento de sesión no está disponible', async () => {
    window.history.replaceState({}, '', '/confirmation?reference=NX-URL-123&total=75.5&paymentMethod=card&paymentStatus=Simulada');
    window.sessionStorage.setItem('nexo-checkout-idempotency.v1', 'key');
    render(<ConfirmationExperience />);

    expect(await screen.findByText('#NX-URL-123')).toBeTruthy();
    expect(screen.getByText('Q 75.50')).toBeTruthy();
    expect(window.sessionStorage.getItem('nexo-checkout-idempotency.v1')).toBeNull();
  });

  it('usa la confirmación guardada si la URL no contiene datos válidos', async () => {
    window.history.replaceState({}, '', '/confirmation?reference=invalida&total=no-es-numero');
    window.sessionStorage.setItem('nexo-confirmation-result', JSON.stringify({
      orderId: 'NX-SESSION-1', total: 42, paymentMethod: 'card', paymentStatus: 'Simulada',
    }));
    render(<ConfirmationExperience />);

    expect(await screen.findByText('#NX-SESSION-1')).toBeTruthy();
    expect(screen.getByText('Q 42.00')).toBeTruthy();
  });
});

describe('checkout del flujo administrativo heredado', () => {
  it('guarda un pedido con cotización aceptada y limpia el carrito', async () => {
    vi.spyOn(checkoutService, 'quote').mockResolvedValue({
      subtotal: 100, discount: 0, total: 100,
      items: [{ productId: 'product-1', productName: 'Monitor', quantity: 1, unitPrice: 100, subtotal: 100 }],
    });
    const createSpy = vi.spyOn(checkoutService, 'create').mockResolvedValue({
      reference: 'NX-LEGACY-1', total: 100, paymentMethod: 'card', paymentStatus: 'Simulada',
    });
    render(<Checkout />);
    fillLegacyCheckout();
    const form = screen.getByRole('button', { name: /Confirmar pedido/ }).closest('form');
    if (!form) throw new Error('No se encontró el formulario de checkout heredado.');
    fireEvent.submit(form);

    await waitFor(() => expect(createSpy).toHaveBeenCalled());
    expect(createSpy.mock.calls[0][2]).toBe(100);
    expect(appState.clearCart).toHaveBeenCalledOnce();
    expect(await screen.findByText('Procesando tu pedido...')).toBeTruthy();
  });

  it('muestra el precio nuevo y requiere aceptarlo antes de guardar', async () => {
    vi.spyOn(checkoutService, 'quote').mockResolvedValue({
      subtotal: 120, discount: 0, total: 120,
      items: [{ productId: 'product-1', productName: 'Monitor', quantity: 1, unitPrice: 120, subtotal: 120 }],
    });
    const createSpy = vi.spyOn(checkoutService, 'create').mockResolvedValue({
      reference: 'NX-LEGACY-PRICE', total: 120, paymentMethod: 'card', paymentStatus: 'Simulada',
    });
    render(<Checkout />);
    fillLegacyCheckout();
    const form = screen.getByRole('button', { name: /Confirmar pedido/ }).closest('form');
    if (!form) throw new Error('No se encontró el formulario de checkout heredado.');
    fireEvent.submit(form);

    expect((await screen.findByRole('alert')).textContent).toContain('Los precios o las existencias cambiaron');
    expect(createSpy).not.toHaveBeenCalled();
    fireEvent.submit(form);
    await waitFor(() => expect(createSpy).toHaveBeenCalled());
    expect(createSpy.mock.calls[0][2]).toBe(120);
  });

  it('recupera un pedido preexistente al repetir un envío en conflicto', async () => {
    vi.spyOn(checkoutService, 'quote').mockResolvedValue({
      subtotal: 100, discount: 0, total: 100,
      items: [{ productId: 'product-1', productName: 'Monitor', quantity: 1, unitPrice: 100, subtotal: 100 }],
    });
    vi.spyOn(checkoutService, 'create').mockRejectedValue(new ApiError('El pedido ya existe', 409));
    const findSpy = vi.spyOn(checkoutService, 'findSubmission').mockResolvedValue({
      reference: 'NX-LEGACY-RECOVERED', total: 100, paymentMethod: 'card', paymentStatus: 'Simulada',
    });
    render(<Checkout />);
    fillLegacyCheckout();
    const form = screen.getByRole('button', { name: /Confirmar pedido/ }).closest('form');
    if (!form) throw new Error('No se encontró el formulario de checkout heredado.');
    fireEvent.submit(form);

    await waitFor(() => expect(findSpy).toHaveBeenCalled());
    expect(appState.clearCart).toHaveBeenCalledOnce();
    expect(await screen.findByText('Procesando tu pedido...')).toBeTruthy();
  });

  it('permite corregir el total después de un conflicto que no dejó un pedido guardado', async () => {
    vi.spyOn(checkoutService, 'quote').mockResolvedValue({
      subtotal: 100, discount: 0, total: 100,
      items: [{ productId: 'product-1', productName: 'Monitor', quantity: 1, unitPrice: 100, subtotal: 100 }],
    });
    vi.spyOn(checkoutService, 'create').mockRejectedValue(new ApiError('El pedido cambió', 409));
    const findSpy = vi.spyOn(checkoutService, 'findSubmission').mockResolvedValue(null);
    render(<Checkout />);
    fillLegacyCheckout();
    const form = screen.getByRole('button', { name: /Confirmar pedido/ }).closest('form');
    if (!form) throw new Error('No se encontró el formulario de checkout heredado.');
    fireEvent.submit(form);

    expect((await screen.findByRole('alert')).textContent).toContain('El pedido cambió');
    expect(findSpy).toHaveBeenCalledOnce();
    expect(appState.clearCart).not.toHaveBeenCalled();
  });
});

function fillCommerceCheckout() {
  fireEvent.change(screen.getByLabelText('Nombre completo'), { target: { value: 'Cliente Demo' } });
  fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: 'cliente@example.test' } });
  fireEvent.change(screen.getByLabelText('NIT'), { target: { value: 'CF' } });
  fireEvent.change(screen.getByLabelText('Teléfono'), { target: { value: '5555-0101' } });
  fireEvent.change(screen.getByLabelText('Dirección de entrega'), { target: { value: 'Zona 1' } });
  fireEvent.change(screen.getByLabelText('Ciudad'), { target: { value: 'Guatemala' } });
}

function submitCommerceCheckout() {
  const form = screen.getByRole('button', { name: /Confirmar (pedido|total actualizado)/ }).closest('form');
  if (!form) throw new Error('No se encontró el formulario de checkout.');
  fireEvent.submit(form);
}

function fillLegacyCheckout() {
  fireEvent.change(screen.getByLabelText('Nombre completo'), { target: { value: 'Cliente Demo' } });
  fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: 'cliente@example.test' } });
  fireEvent.change(screen.getByLabelText('NIT'), { target: { value: 'CF' } });
  fireEvent.change(screen.getByLabelText('Teléfono'), { target: { value: '5555-0101' } });
  fireEvent.change(screen.getByLabelText('Dirección de entrega'), { target: { value: 'Zona 1, Guatemala' } });
}
