import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkoutService } from '../services';
import { ApiError, apiClient } from '../shared/services/http-client';

afterEach(() => vi.restoreAllMocks());

describe('servicio de checkout', () => {
  it('obtiene la cotización vigente sin enviar datos personales', async () => {
    const quote = { subtotal: 200, discount: 20, total: 180, items: [] };
    const post = vi.spyOn(apiClient, 'post').mockResolvedValueOnce(quote as never);

    await expect(checkoutService.quote({ items: [{ productId: 'p-1', quantity: 2 }], discountCode: 'NEXO10' })).resolves.toEqual(quote);
    expect(post).toHaveBeenCalledWith('/api/catalog/orders/quote', {
      items: [{ productId: 'p-1', quantity: 2 }], discountCode: 'NEXO10',
    });
  });

  it('envía la clave de idempotencia y el total que la persona confirmó', async () => {
    const response = { reference: 'NX-ABC12345', total: 180, paymentMethod: 'card', paymentStatus: 'Simulada' };
    const post = vi.spyOn(apiClient, 'post').mockResolvedValueOnce(response as never);
    const input = {
      customerName: 'Cliente Demo', customerEmail: 'cliente@example.test', nit: 'CF', address: 'Zona 1', paymentMethod: 'card' as const,
      items: [{ productId: 'p-1', quantity: 2 }],
    };

    await expect(checkoutService.create(input, '4cc5e429-1ff2-4498-851d-2b4e4f4e5a11', 180)).resolves.toMatchObject({
      reference: 'NX-ABC12345', total: 180, paymentMethod: 'card', paymentStatus: 'Simulada',
    });
    expect(post).toHaveBeenCalledWith('/api/catalog/orders', { ...input, expectedTotal: 180 }, {
      'Idempotency-Key': '4cc5e429-1ff2-4498-851d-2b4e4f4e5a11',
    });
  });

  it('permite recuperar un pedido ya creado tras perder la respuesta', async () => {
    const get = vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
      reference: 'NX-ABC12345', total: 180, paymentMethod: 'card', paymentStatus: 'Simulada',
    } as never);

    await expect(checkoutService.findSubmission('4cc5e429-1ff2-4498-851d-2b4e4f4e5a11')).resolves.toMatchObject({
      reference: 'NX-ABC12345', total: 180,
    });
    expect(get).toHaveBeenCalledWith('/api/catalog/orders/submissions/4cc5e429-1ff2-4498-851d-2b4e4f4e5a11');
  });

  it('trata una clave aún sin pedido como ausencia, pero conserva otros errores', async () => {
    vi.spyOn(apiClient, 'get').mockRejectedValueOnce(new ApiError('No existe', 404));
    await expect(checkoutService.findSubmission('4cc5e429-1ff2-4498-851d-2b4e4f4e5a11')).resolves.toBeNull();

    const unavailable = new ApiError('No disponible', 503);
    vi.spyOn(apiClient, 'get').mockRejectedValueOnce(unavailable);
    await expect(checkoutService.findSubmission('4cc5e429-1ff2-4498-851d-2b4e4f4e5a11')).rejects.toBe(unavailable);
  });
});
