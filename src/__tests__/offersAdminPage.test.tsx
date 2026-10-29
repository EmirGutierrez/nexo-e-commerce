// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { OffersAdminPage } from '../modules/commerce/components/CommerceAdminPages';
import * as commerceData from '../modules/commerce/services/commerceDataService';
import { productInventoryService } from '../services';

const product = { id: 'product-1', name: 'Monitor', category: 'Pantallas', price: 100, image: '', description: '', sku: 'MON-1', stock: 3, status: 'Activo' as const };
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
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Nueva colección' } });
    fireEvent.change(screen.getByLabelText('Descripción'), { target: { value: 'Descubre novedades' } });
    fireEvent.change(screen.getByLabelText('Enlace interno'), { target: { value: '//sitio-externo.example' } });
    fireEvent.click(screen.getByRole('button', { name: 'Publicar anuncio' }));
    expect((await screen.findByRole('status')).textContent).toContain('enlace interno');
    expect(commerceData.savePromotionData).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Enlace interno'), { target: { value: '/store' } });
    const image = new File(['image-content'], 'novedad.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('Imagen (opcional)'), { target: { files: [image] } });
    expect(await screen.findByAltText('Vista previa del anuncio')).toBeTruthy();
    expect(URL.createObjectURL).toHaveBeenCalledWith(image);
    fireEvent.click(screen.getByRole('button', { name: 'Publicar anuncio' }));

    await waitFor(() => expect(commerceData.savePromotionData).toHaveBeenCalledWith(expect.objectContaining({
      announcements: [expect.objectContaining({
        title: 'Nueva colección', description: 'Descubre novedades', href: '/store',
        image: 'data:image/jpeg;base64,compressed', status: 'Activa',
      })],
    })));
  });
});
