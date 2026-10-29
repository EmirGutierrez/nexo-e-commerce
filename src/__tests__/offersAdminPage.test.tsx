// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { OffersAdminPage } from '../modules/commerce/components/CommerceAdminPages';
import * as commerceData from '../modules/commerce/services/commerceDataService';
import { productInventoryService } from '../services';

const product = { id: 'product-1', name: 'Monitor', category: 'Pantallas', price: 100, image: '/monitor.jpg', description: '', sku: 'MON-1', stock: 3, status: 'Activo' as const };
const emptyData = { offers: [], announcements: [], discountCodes: [] };

beforeEach(() => {
  vi.spyOn(commerceData, 'loadAdminPromotionData').mockResolvedValue(emptyData);
  vi.spyOn(commerceData, 'savePromotionData').mockImplementation(async (data) => data);
  vi.spyOn(productInventoryService, 'list').mockResolvedValue([product]);
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:announcement');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  vi.stubGlobal('Image', class {
    width = 640;
    height = 480;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    set src(_value: string) { queueMicrotask(() => this.onload?.()); }
  });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: vi.fn() } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/jpeg;base64,compressed');
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('anuncios y ofertas', () => {
  it('rechaza enlaces externos y guarda el anuncio con la imagen comprimida', async () => {
    render(<OffersAdminPage />);
    fireEvent.click(screen.getByRole('button', { name: /Anuncios/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Publicar anuncio' }));
    expect((await screen.findByRole('status')).textContent).toContain('título');
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Nueva colección' } });
    fireEvent.change(screen.getByLabelText('Descripción'), { target: { value: 'Descubre novedades' } });
    fireEvent.change(screen.getByLabelText('Enlace interno'), { target: { value: '//sitio-externo.example' } });
    fireEvent.click(screen.getByRole('button', { name: 'Publicar anuncio' }));
    expect((await screen.findByRole('status')).textContent).toContain('enlace interno');
    expect(commerceData.savePromotionData).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Enlace interno'), { target: { value: '/store' } });
    const unsupported = new File(['text'], 'novedad.txt', { type: 'text/plain' });
    fireEvent.change(screen.getByLabelText('Imagen (opcional)'), { target: { files: [unsupported] } });
    expect((await screen.findByRole('status')).textContent).toContain('JPG, PNG o WEBP');
    const image = new File(['image-content'], 'novedad.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('Imagen (opcional)'), { target: { files: [image] } });
    expect(await screen.findByAltText('Vista previa del anuncio')).toBeTruthy();
    expect(URL.createObjectURL).toHaveBeenCalledWith(image);
    fireEvent.click(screen.getByRole('button', { name: 'Quitar imagen' }));
    expect(screen.queryByAltText('Vista previa del anuncio')).toBeNull();
    fireEvent.change(screen.getByLabelText('Imagen (opcional)'), { target: { files: [image] } });
    expect(await screen.findByAltText('Vista previa del anuncio')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Publicar anuncio' }));

    await waitFor(() => expect(commerceData.savePromotionData).toHaveBeenCalledWith(expect.objectContaining({
      announcements: [expect.objectContaining({
        title: 'Nueva colección', description: 'Descubre novedades', href: '/store',
        image: 'data:image/jpeg;base64,compressed', status: 'Activa',
      })],
    })));
  });

  it('valida descuentos y códigos, y guarda valores dentro de los límites', async () => {
    render(<OffersAdminPage />);
    await screen.findByLabelText('Producto');

    fireEvent.change(screen.getByLabelText('Descuento (%)'), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar oferta' }));
    expect((await screen.findByRole('status')).textContent).toContain('1% a 80%');
    fireEvent.change(screen.getByLabelText('Descuento (%)'), { target: { value: '80' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar oferta' }));
    await waitFor(() => expect(commerceData.savePromotionData).toHaveBeenCalledWith(expect.objectContaining({
      offers: [expect.objectContaining({ productId: product.id, discountedPrice: 20 })],
    })));

    fireEvent.click(screen.getByRole('button', { name: /Códigos/ }));
    fireEvent.change(screen.getByLabelText('Código'), { target: { value: 'NX' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear código' }));
    expect((await screen.findByRole('status')).textContent).toContain('código');
    fireEvent.change(screen.getByLabelText('Código'), { target: { value: 'nexo 15%' } });
    expect((screen.getByLabelText('Código') as HTMLInputElement).value).toBe('NEXO15');
    fireEvent.change(screen.getByLabelText('Descuento (%)'), { target: { value: '1.5' } });
    expect((screen.getByLabelText('Descuento (%)') as HTMLInputElement).value).toBe('80');
    fireEvent.change(screen.getByLabelText('Descuento (%)'), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear código' }));
    expect((await screen.findByRole('status')).textContent).toContain('código');

    fireEvent.change(screen.getByLabelText('Descuento (%)'), { target: { value: '15' } });
    fireEvent.change(screen.getByLabelText('Compra mínima (Q)'), { target: { value: '12.50' } });
    fireEvent.change(screen.getByLabelText('Usos máximos'), { target: { value: '20' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear código' }));
    await waitFor(() => expect(commerceData.savePromotionData).toHaveBeenLastCalledWith(expect.objectContaining({
      discountCodes: [expect.objectContaining({ code: 'NEXO15', discountPercent: 15, minPurchase: 12.5, maxUses: 20 })],
    })));

    fireEvent.change(screen.getByLabelText('Código'), { target: { value: 'NEXO15' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear código' }));
    expect((await screen.findByRole('status')).textContent).toContain('código');
    expect(commerceData.savePromotionData).toHaveBeenCalledTimes(2);
  });

  it('informa cuando no hay un producto seleccionable para crear una oferta', async () => {
    vi.mocked(productInventoryService.list).mockResolvedValue([]);
    render(<OffersAdminPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Guardar oferta' }));
    expect((await screen.findByRole('status')).textContent).toContain('Elige un producto');
  });
});
