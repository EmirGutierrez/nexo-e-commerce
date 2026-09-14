import { products as localProducts } from '../data/mockData';
import type { Product } from '../types';

interface DummyJsonProduct {
  id: number;
  title: string;
  description: string;
  category: string;
  price: number;
  stock: number;
  thumbnail: string;
  sku?: string;
  rating?: number;
  discountPercentage?: number;
}

interface DummyJsonResponse { products: DummyJsonProduct[] }

const categoryMap: Record<string, Product['category']> = {
  beauty: 'Bienestar', fragrances: 'Bienestar', furniture: 'Hogar', groceries: 'Hogar',
  laptops: 'Tecnología', smartphones: 'Tecnología', tablets: 'Tecnología', 'mens-shirts': 'Accesorios',
  'womens-dresses': 'Accesorios', tops: 'Accesorios', 'womens-shoes': 'Accesorios', 'mens-shoes': 'Accesorios',
  'mens-watches': 'Accesorios', 'womens-watches': 'Accesorios', sunglasses: 'Accesorios', bags: 'Accesorios',
  motorcycle: 'Accesorios', vehicle: 'Accesorios', 'skin-care': 'Bienestar', 'sports-accessories': 'Bienestar',
};

const mapProduct = (item: DummyJsonProduct): Product => {
  const price = Math.round(item.price * 7.8);
  const stock = item.stock || 0;
  return {
    id: `api-${item.id}`,
    name: item.title,
    category: categoryMap[item.category] || 'Accesorios',
    price,
    compareAt: item.discountPercentage && item.discountPercentage > 8 ? Math.round(price / (1 - item.discountPercentage / 100)) : undefined,
    stock,
    status: stock === 0 ? 'Agotado' : stock < 10 ? 'Bajo stock' : 'Activo',
    image: item.thumbnail,
    description: item.description,
    featured: (item.rating || 0) >= 4.6,
    sku: item.sku || `API-${item.id}`,
  };
};

/** API de catálogo externa para la demo. Si no está disponible, conserva el catálogo local. */
export async function fetchCatalogFromApi(): Promise<{ products: Product[]; source: 'api' | 'fallback' }> {
  try {
    const response = await fetch('https://dummyjson.com/products?limit=0&select=id,title,description,category,price,stock,thumbnail,sku,rating,discountPercentage');
    if (!response.ok) throw new Error(`Catalog API responded with ${response.status}`);
    const data = await response.json() as DummyJsonResponse;
    return { products: data.products.map(mapProduct), source: 'api' };
  } catch {
    return { products: localProducts, source: 'fallback' };
  }
}

export const productService = { list: fetchCatalogFromApi, getLocal: () => localProducts };
