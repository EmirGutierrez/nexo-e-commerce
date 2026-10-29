// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { AppProvider, useApp } from '../contexts/AppContext';
import { authService, paymentSettingsService } from '../services';
import type { Product } from '../types';

const product: Product = {
  id: 'stock-bound-product', brandId: 'brand-1', name: 'Producto de prueba', category: 'Accesorios',
  price: 20, stock: 2, status: 'Activo', image: '', description: '', sku: 'STOCK-1', featured: false,
};

function CartControls({ stock }: { stock: number }) {
  const { cart, addToCart, updateQuantity } = useApp();
  const quantity = cart.find((item) => item.id === product.id)?.quantity ?? 0;
  return <div>
    <button type="button" onClick={() => addToCart({ ...product, stock })}>Sumar</button>
    <button type="button" onClick={() => updateQuantity(product.id, 99)}>Solicitar cantidad alta</button>
    <button type="button" onClick={() => updateQuantity(product.id, Number.NaN)}>Solicitar cantidad inválida</button>
    <output>{quantity}</output>
  </div>;
}

describe('límites del carrito', () => {
  beforeEach(() => {
    window.localStorage.removeItem('nexo.cart.v1');
    vi.spyOn(authService, 'currentUser').mockResolvedValue(null);
    vi.spyOn(paymentSettingsService, 'load').mockResolvedValue({ card: true, transfer: true });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('no agrega sin existencias, limita cantidades y actualiza el tope al cambiar el stock', () => {
    const view = render(<AppProvider><CartControls stock={2} /></AppProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Sumar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sumar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sumar' }));
    expect(screen.getByText('2')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Solicitar cantidad alta' }));
    expect(screen.getByText('2')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Solicitar cantidad inválida' }));
    expect(screen.getByText('2')).toBeTruthy();

    view.rerender(<AppProvider><CartControls stock={1} /></AppProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Sumar' }));
    expect(screen.getByText('1')).toBeTruthy();
  });

  it('no agrega productos con stock cero', () => {
    render(<AppProvider><CartControls stock={0} /></AppProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Sumar' }));
    expect(screen.getByText('0')).toBeTruthy();
  });
});
