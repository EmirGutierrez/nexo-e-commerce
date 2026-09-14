import type { Product } from '../types';

/** Contrato local para sustituir el historial temporal por un endpoint del backend. */
export const recentlyViewedService = {
  add: async (product: Product) => product,
  list: async (products: Product[]) => products.slice(0, 8),
  clear: async () => true,
};
