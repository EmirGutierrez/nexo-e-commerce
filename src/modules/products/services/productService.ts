import { apiClient } from '../../../shared/services/http-client';
import type { Product } from '../../../types';

interface CatalogProduct {
  id: string;
  brandId?: string | null;
  name: string;
  category: string;
  price: number;
  compareAt?: number | null;
  stock: number;
  status: string;
  image?: string | null;
  description?: string | null;
  featured?: boolean;
  sku: string;
}

const mapProduct = (item: CatalogProduct): Product => ({
  id: item.id,
  brandId: item.brandId || undefined,
  name: item.name,
  category: item.category,
  price: Number(item.price),
  compareAt: item.compareAt == null ? undefined : Number(item.compareAt),
  stock: Number(item.stock),
  status: item.status === 'Inactivo' ? 'Inactivo' : Number(item.stock) === 0 ? 'Agotado' : Number(item.stock) < 10 ? 'Bajo stock' : 'Activo',
  image: item.image || '',
  description: item.description || '',
  featured: Boolean(item.featured),
  sku: item.sku,
});

/** El catálogo público y el panel administrativo leen el mismo catálogo de PostgreSQL. */
export async function fetchCatalogFromApi(): Promise<{ products: Product[]; source: 'api' }> {
  const rows = await apiClient.get<CatalogProduct[]>('/api/catalog/products');
  return { products: rows.map(mapProduct), source: 'api' };
}

export const productService = {
  list: fetchCatalogFromApi,
  getById: async (id: string): Promise<Product | null> => {
    const item = await apiClient.get<CatalogProduct>(`/api/catalog/products/${encodeURIComponent(id)}`);
    return mapProduct(item);
  },
};
