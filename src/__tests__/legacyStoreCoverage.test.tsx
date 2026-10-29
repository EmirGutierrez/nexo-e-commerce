// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Store } from '../modules/app/components/NexoPages';
import { fetchCatalogFromApi } from '../modules/products/services/productService';
import type { Product } from '../types';

const app = vi.hoisted(() => ({ cartCount: 1, addToCart: vi.fn() }));
const route = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
const api = vi.hoisted(() => ({ fetchCatalog: vi.fn() }));

vi.mock('../contexts/AppContext', () => ({ useApp: () => app }));
vi.mock('next/navigation', () => ({
  useRouter: () => route,
  useParams: () => ({ id: 'product-1' }),
}));
vi.mock('../modules/products/services/productService', () => ({ fetchCatalogFromApi: api.fetchCatalog, productService: {} }));
vi.mock('../modules/app/components/PublicAccountControls', () => ({ default: () => null }));
vi.mock('../modules/app/components/FloatingCartButton', () => ({ default: () => null }));
vi.mock('../modules/commerce/components/CustomerNotificationBell', () => ({ default: () => null }));
vi.mock('../modules/commerce/components/CommercePages', () => ({ SeasonalSpotlight: () => null }));
vi.mock('../modules/auth/components/ChangePasswordCard', () => ({ default: () => null }));
vi.mock('../modules/auth/components/MfaSettingsCard', () => ({ default: () => null }));

const products: Product[] = [
  { id: 'p-1', brandId: 'b-1', name: 'Monitor Uno', category: 'Tecnología', price: 100, stock: 3, status: 'Activo', image: '/monitor.jpg', description: 'Monitor', sku: 'MON-1', featured: true },
  { id: 'p-2', brandId: 'b-1', name: 'Teclado Dos', category: 'Accesorios', price: 50, stock: 0, status: 'Activo', image: '/teclado.jpg', description: 'Teclado', sku: 'TEC-2', featured: false },
];

beforeEach(() => {
  api.fetchCatalog.mockReset();
  api.fetchCatalog.mockResolvedValue({ products });
  app.addToCart.mockReset();
  route.push.mockReset();
  route.replace.mockReset();
  window.history.replaceState({}, '', '/store');
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('catálogo público heredado', () => {
  it('filtra, ordena, agrega al carrito y cambia de página de resultados', async () => {
    render(<Store />);
    expect(await screen.findByText('2 productos · página 1 de 1')).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText('Buscar productos...'), { target: { value: 'monitor' } });
    expect(screen.getByText('Monitor Uno')).toBeTruthy();
    expect(screen.queryByText('Teclado Dos')).toBeNull();
    fireEvent.change(document.querySelector('select')!, { target: { value: 'price-high' } });
    fireEvent.click(document.querySelector('button.add-button')!);
    expect(app.addToCart).toHaveBeenCalledWith(products[0]);
    const clearSearch = document.querySelector('.search-box button');
    expect(clearSearch).toBeTruthy();
    fireEvent.click(clearSearch!);
    expect(screen.getByText('Teclado Dos')).toBeTruthy();
    expect((screen.getByRole('button', { name: /Siguiente/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('muestra un error recuperable cuando el servicio del catálogo falla', async () => {
    api.fetchCatalog.mockRejectedValue(new Error('Catálogo no disponible'));
    render(<Store />);
    expect((await screen.findByRole('alert')).textContent).toContain('Catálogo no disponible');
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeTruthy();
    expect(api.fetchCatalog).toHaveBeenCalledTimes(1);
  });

  it('muestra un estado vacío cuando no hay coincidencias', async () => {
    api.fetchCatalog.mockResolvedValue({ products: [] });
    render(<Store />);
    expect(await screen.findByText('No encontramos resultados')).toBeTruthy();
    await waitFor(() => expect(api.fetchCatalog).toHaveBeenCalledOnce());
  });
});
