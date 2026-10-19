// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CartExperience, CheckoutExperience, ProductDetail, Storefront } from '../modules/commerce/components/CommercePages';
import { checkoutService, customerPortalService } from '../services';
import { fetchCatalogFromApi } from '../modules/products/services/productService';
import type { Product } from '../types';

const state = vi.hoisted(() => ({
  cart: [] as Array<Product & { quantity: number }>,
  cartTotal: 100,
  cartCount: 1,
  cartLoaded: true,
  paymentMethods: { card: true, transfer: true },
  user: null as { name: string; email: string } | null,
  userType: null as string | null,
  addToCart: vi.fn(),
  updateQuantity: vi.fn(),
  removeFromCart: vi.fn(),
}));

const route = vi.hoisted(() => ({ productId: 'product-1', push: vi.fn(), replace: vi.fn() }));
const commerce = vi.hoisted(() => ({
  fetchCatalog: vi.fn(), loadPromotions: vi.fn(), loadRecent: vi.fn(), recordRecent: vi.fn(),
  validateCode: vi.fn(), applyOffer: vi.fn((product: Product) => product), isActive: vi.fn((offer: { status: string }) => offer.status === 'Activa'),
}));

vi.mock('../contexts/AppContext', () => ({ useApp: () => state }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: route.push, replace: route.replace }),
  useParams: () => ({ id: route.productId }),
}));
vi.mock('../modules/app/components/PublicAccountControls', () => ({ default: () => null }));
vi.mock('../modules/app/components/FloatingCartButton', () => ({ default: () => null }));
vi.mock('../modules/commerce/components/CustomerNotificationBell', () => ({ default: () => null }));
vi.mock('../modules/products/services/productService', () => ({ fetchCatalogFromApi: commerce.fetchCatalog }));
vi.mock('../modules/commerce/services/commerceDataService', () => ({
  applyPromotion: commerce.applyOffer,
  emptyPromotionData: () => ({ offers: [], announcements: [], discountCodes: [] }),
  isPromotionActive: commerce.isActive,
  loadPromotionData: commerce.loadPromotions,
  loadRecentlyViewed: commerce.loadRecent,
  recordRecentlyViewed: commerce.recordRecent,
  validateDiscountCode: commerce.validateCode,
}));

const monitor: Product = {
  id: 'product-1', brandId: 'brand-1', name: 'Monitor destacado', category: 'Tecnología', price: 100,
  stock: 8, status: 'Activo', image: 'monitor.jpg', description: 'Monitor demo', sku: 'MON-1', featured: true,
};
const keyboard: Product = {
  ...monitor, id: 'product-2', name: 'Teclado compacto', category: 'Accesorios', price: 50, stock: 4, sku: 'TEC-2', featured: false,
};
const promotionData = { offers: [], announcements: [], discountCodes: [] };

function setCatalog(products = [monitor, keyboard]) {
  commerce.fetchCatalog.mockResolvedValue({ products });
  commerce.loadPromotions.mockResolvedValue(promotionData);
  commerce.loadRecent.mockReturnValue([]);
}

function fillCheckout() {
  fireEvent.change(screen.getByLabelText('Nombre completo'), { target: { value: 'Ana García' } });
  fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: 'ana@example.test' } });
  fireEvent.change(screen.getByLabelText('NIT'), { target: { value: 'CF' } });
  fireEvent.change(screen.getByLabelText('Teléfono'), { target: { value: '5555-0101' } });
  fireEvent.change(screen.getByLabelText('Dirección de entrega'), { target: { value: 'Zona 1' } });
  fireEvent.change(screen.getByLabelText('Ciudad'), { target: { value: 'Guatemala' } });
}

function submitCheckout() {
  const form = screen.getByRole('button', { name: /Confirmar pedido/ }).closest('form');
  if (!form) throw new Error('No se encontró el formulario de checkout.');
  fireEvent.submit(form);
}

beforeEach(() => {
  window.history.replaceState({}, '', '/store');
  window.sessionStorage.clear();
  state.cart = [{ ...monitor, quantity: 1 }];
  state.cartTotal = 100;
  state.cartCount = 1;
  state.cartLoaded = true;
  state.paymentMethods = { card: true, transfer: true };
  state.user = null;
  state.userType = null;
  state.addToCart.mockClear();
  state.updateQuantity.mockClear();
  state.removeFromCart.mockClear();
  route.productId = monitor.id;
  route.push.mockClear();
  route.replace.mockClear();
  commerce.fetchCatalog.mockReset();
  commerce.loadPromotions.mockReset();
  commerce.loadRecent.mockReset();
  commerce.recordRecent.mockReset();
  commerce.validateCode.mockReset();
  commerce.applyOffer.mockImplementation((product: Product) => product);
  commerce.isActive.mockImplementation((offer: { status: string }) => offer.status === 'Activa');
  vi.spyOn(checkoutService, 'quote').mockResolvedValue({ subtotal: 100, discount: 0, total: 100, items: [] });
  setCatalog();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('tienda y detalle de productos', () => {
  it('carga catálogo y actividad reciente, filtra y permite guardar y agregar productos', async () => {
    state.userType = 'customer';
    commerce.loadPromotions.mockResolvedValue({
      offers: [{ id: 'offer-1', productId: monitor.id, status: 'Activa' }],
      announcements: [{ id: 'news-1', title: 'Nueva colección', description: 'Ya disponible', href: '/store', image: 'news.jpg', status: 'Activa' }],
      discountCodes: [],
    });
    commerce.loadRecent.mockReturnValue([keyboard.id]);
    commerce.applyOffer.mockImplementation((product: Product) => product.id === monitor.id
      ? { ...product, price: 80, compareAt: 100 }
      : product);
    vi.spyOn(customerPortalService, 'addWishlist').mockResolvedValue(undefined);

    render(<Storefront />);

    expect(await screen.findByText('Nueva colección')).toBeTruthy();
    expect((await screen.findAllByText('Monitor destacado')).length).toBeGreaterThan(0);
    expect(screen.getByText('Vistos recientemente')).toBeTruthy();
    expect(commerce.recordRecent).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Ofertas' }));
    expect(screen.getByText('1 productos · página 1 de 1')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: 'Guardar Monitor destacado en wishlist' })[0]);
    expect(await screen.findByText('Guardado en Mi wishlist')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: 'Agregar Monitor destacado al carrito' })[0]);
    expect(state.addToCart).toHaveBeenCalledWith(expect.objectContaining({ id: monitor.id, price: 80 }));
  });

  it('presenta un error de carga y el estado vacío del catálogo sin romper la página', async () => {
    commerce.loadPromotions.mockRejectedValue(new Error('promociones sin conexión'));
    commerce.fetchCatalog.mockRejectedValue(new Error('catálogo sin conexión'));
    render(<Storefront />);

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain('No se pudo cargar el catálogo');
    expect(screen.queryByText('No encontramos resultados')).toBeNull();
  });

  it('registra visita, limita cantidad y agrega el producto al carrito', async () => {
    commerce.applyOffer.mockImplementation((product: Product) => ({ ...product, compareAt: 125 }));
    render(<ProductDetail />);

    expect(await screen.findByRole('heading', { name: 'Monitor destacado' })).toBeTruthy();
    await waitFor(() => expect(commerce.recordRecent).toHaveBeenCalledWith(monitor.id));
    fireEvent.click(screen.getByRole('button', { name: 'Restar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sumar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Agregar al carrito' }));

    expect(state.addToCart).toHaveBeenCalledTimes(2);
    expect(await screen.findByRole('button', { name: /Ir al carrito/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Ir al carrito/ }));
    expect(route.push).toHaveBeenCalledWith('/cart');
  });

  it('muestra el estado no encontrado cuando el producto ya no está en el catálogo', async () => {
    commerce.fetchCatalog.mockResolvedValue({ products: [keyboard] });
    route.productId = 'missing-product';
    render(<ProductDetail />);

    expect(await screen.findByRole('heading', { name: 'Producto no encontrado' })).toBeTruthy();
  });
});

describe('carrito, descuento y checkout', () => {
  it('aplica el código guardado, refleja el descuento y permite cambiar cantidades y continuar', async () => {
    window.sessionStorage.setItem('nexo-applied-discount', 'NEXO10');
    commerce.validateCode.mockResolvedValue({ valid: true, discount: 10, code: { code: 'NEXO10', discountPercent: 10 } });
    render(<CartExperience />);

    expect(await screen.findByText('Q 90.00')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Restar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sumar' }));
    expect(state.updateQuantity).toHaveBeenNthCalledWith(1, monitor.id, 0);
    expect(state.updateQuantity).toHaveBeenNthCalledWith(2, monitor.id, 2);
    fireEvent.click(screen.getByRole('button', { name: /Continuar al checkout/ }));
    expect(route.push).toHaveBeenCalledWith('/checkout');
  });

  it('muestra errores de cupón inválido o de servicio y permite retirar productos', async () => {
    commerce.validateCode.mockResolvedValue({ valid: false, message: 'El cupón venció.' });
    render(<CartExperience />);
    fireEvent.change(screen.getByLabelText('Código de descuento'), { target: { value: 'vencido' } });
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }));
    expect(await screen.findByText('El cupón venció.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
    expect(state.removeFromCart).toHaveBeenCalledWith(monitor.id);
  });

  it('informa cuando no puede validar el código de descuento', async () => {
    commerce.validateCode.mockRejectedValue(new Error('sin conexión'));
    render(<CartExperience />);
    fireEvent.change(screen.getByLabelText('Código de descuento'), { target: { value: 'NEXO10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }));
    expect(await screen.findByText('No se pudo comprobar el código. Inténtalo de nuevo.')).toBeTruthy();
  });

  it('muestra el carrito vacío', () => {
    state.cart = [];
    state.cartCount = 0;
    state.cartTotal = 0;
    render(<CartExperience />);
    expect(screen.getByText('Tu carrito está esperando')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Explorar productos/ }).getAttribute('href')).toBe('/store');
  });

  it.each([
    ['Nombre completo', 'Cliente 123', 'Ingresa un nombre válido'],
    ['Correo electrónico', '7777@77777', 'Ingresa un correo electrónico válido'],
    ['NIT', '12/34', 'Ingresa un NIT válido'],
    ['Teléfono', '', 'Completa el teléfono y una dirección válida'],
    ['Dirección de entrega', '123456', 'Completa el teléfono y una dirección válida'],
  ])('rechaza datos inválidos en %s antes de cotizar', async (label, value, message) => {
    render(<CheckoutExperience />);
    fillCheckout();
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
    submitCheckout();
    expect((await screen.findByRole('alert')).textContent).toContain(message);
    expect(checkoutService.quote).not.toHaveBeenCalled();
  });

  it('impide enviar transferencia sin comprobante y valida tipo/tamaño de imagen', async () => {
    render(<CheckoutExperience />);
    fillCheckout();
    fireEvent.click(screen.getByRole('button', { name: /Transferencia bancaria/ }));
    submitCheckout();
    expect((await screen.findByRole('alert')).textContent).toContain('Adjunta el comprobante');

    const input = screen.getByLabelText(/Comprobante de transferencia/);
    fireEvent.change(input, { target: { files: [new File(['txt'], 'comprobante.txt', { type: 'text/plain' })] } });
    expect((await screen.findByRole('alert')).textContent).toContain('Sube una imagen JPG, PNG o WEBP');
    fireEvent.change(input, { target: { files: [new File(['x'.repeat(5 * 1024 * 1024 + 1)], 'grande.png', { type: 'image/png' })] } });
    expect((await screen.findByRole('alert')).textContent).toContain('menos de 5 MB');
  });
});
