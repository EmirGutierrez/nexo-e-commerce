import { describe, expect, it } from 'vitest';
import { productImageSourceSet } from '../modules/commerce/utils/productImageSourceSet';
import { PRODUCT_IMAGE_MIN_SIDE, productImageCompressionDimensions } from '../modules/products/utils/productImageProcessing';

describe('calidad de imágenes de productos', () => {
  it('mantiene resolución para productos de alta densidad sin ampliar la fuente', () => {
    const source = productImageCompressionDimensions(2400, 2400);

    expect(source).toEqual([
      { width: 1800, height: 1800 },
      { width: 1600, height: 1600 },
      { width: 1440, height: 1440 },
      { width: 1280, height: 1280 },
      { width: 1140, height: 1140 },
    ]);
    expect(source.every(({ width, height }) => width <= 2400 && height <= 2400 && width >= PRODUCT_IMAGE_MIN_SIDE && height >= PRODUCT_IMAGE_MIN_SIDE)).toBe(true);
  });

  it('rechaza fuentes pequeñas y no genera una versión ampliada', () => {
    expect(productImageCompressionDimensions(900, 900)).toEqual([]);
    expect(productImageCompressionDimensions(800, 1600)).toEqual([]);
  });

  it('ofrece resolución alta del mismo original Unsplash en tarjeta y detalle', () => {
    const original = 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=85';
    const candidates = productImageSourceSet(original);

    expect(candidates).toContain(`${original} 900w`);
    expect(candidates).toContain('photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=1800&q=90 1800w');
  });

  it('no inventa variantes para imágenes cargadas en la API o para URLs externas no compatibles', () => {
    expect(productImageSourceSet('/api/catalog/products/product-1/image')).toBeUndefined();
    expect(productImageSourceSet('https://example.test/product.jpg')).toBeUndefined();
  });
});
