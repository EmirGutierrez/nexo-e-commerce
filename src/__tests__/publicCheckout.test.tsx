// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { CheckoutExperience } from '../modules/commerce/components/CommercePages';
import { checkoutService } from '../services';

const appState = vi.hoisted(() => ({
  cart: [{ id: 'product-1', brandId: 'brand-1', name: 'Monitor', category: 'Tecnología', price: 100, stock: 8,
    status: 'Activo' as const, image: '', description: 'Monitor demo', sku: 'MON-1', quantity: 1 }],
  cartLoaded: true,
  cartCount: 1,
  cartTotal: 100,
  paymentMethods: { card: true, transfer: true },
  user: null,
  removeFromCart: vi.fn(),
}));

vi.mock('../contexts/AppContext', () => ({ useApp: () => appState }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), useParams: () => ({}) }));
vi.mock('../modules/app/components/PublicAccountControls', () => ({ default: () => null }));
vi.mock('../modules/app/components/FloatingCartButton', () => ({ default: () => null }));
vi.mock('../modules/commerce/components/CustomerNotificationBell', () => ({ default: () => null }));

beforeEach(() => {
  window.history.replaceState({}, '', '/checkout');
  window.sessionStorage.clear();
  appState.removeFromCart.mockClear();
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
  });
});
