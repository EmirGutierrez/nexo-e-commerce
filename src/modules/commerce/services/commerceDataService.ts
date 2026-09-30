import { products } from '../../../data/mockData';
import type { Announcement, DiscountCode, Offer, Product, TransferReceipt } from '../../../types';

const promotionStorageKey = 'nexo-promotions-v1';
const receiptStorageKey = 'nexo-transfer-receipts-v1';
const recentStorageKey = 'nexo-recent-products-v1';

export interface PromotionData {
  offers: Offer[];
  announcements: Announcement[];
  discountCodes: DiscountCode[];
}

const dateWindow = () => {
  const year = new Date().getFullYear();
  return { startsAt: `${year}-01-01`, endsAt: `${year + 1}-12-31` };
};

export function defaultPromotionData(catalog: Product[] = products): PromotionData {
  const { startsAt, endsAt } = dateWindow();
  return {
    offers: catalog.flatMap((product) => product.compareAt && product.compareAt > product.price ? [{
      id: `offer-${product.id}`, productId: product.id, originalPrice: product.compareAt,
      discountedPrice: product.price, startsAt, endsAt, status: 'Activa' as const,
    }] : []),
    announcements: [
      { id: 'announcement-shipping', title: 'Envío gratis en tus pedidos', description: 'Recibe tus productos sin costo adicional.', href: '/store', status: 'Activa' },
      { id: 'announcement-new', title: 'Descubre la selección NEXO', description: 'Encuentra productos elegidos para tu día a día.', href: '/store', status: 'Activa' },
    ],
    discountCodes: [
      { id: 'code-nexo10', code: 'NEXO10', discountPercent: 10, minPurchase: 0, maxUses: 100, usedCount: 0, startsAt, endsAt, status: 'Activo' },
      { id: 'code-bienvenida', code: 'BIENVENIDA', discountPercent: 10, minPurchase: 0, maxUses: 100, usedCount: 0, startsAt, endsAt, status: 'Activo' },
    ],
  };
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) as T : fallback;
  } catch {
    return fallback;
  }
}

export function loadPromotionData(catalog: Product[] = products): PromotionData {
  const defaults = defaultPromotionData(catalog);
  const stored = readJson<Partial<PromotionData>>(promotionStorageKey, {});
  return {
    offers: Array.isArray(stored.offers) ? stored.offers : defaults.offers,
    announcements: Array.isArray(stored.announcements) ? stored.announcements : defaults.announcements,
    discountCodes: Array.isArray(stored.discountCodes) ? stored.discountCodes : defaults.discountCodes,
  };
}

export function savePromotionData(data: PromotionData) {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(promotionStorageKey, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function isPromotionActive(offer: Offer, now = new Date()) {
  const today = now.toISOString().slice(0, 10);
  return offer.status === 'Activa' && offer.startsAt <= today && offer.endsAt >= today;
}

export function applyPromotion(product: Product, offers: Offer[], now = new Date()): Product {
  const offer = offers.find((item) => item.productId === product.id && isPromotionActive(item, now));
  if (!offer) return product;
  return { ...product, price: offer.discountedPrice, compareAt: offer.originalPrice };
}

export function validateDiscountCode(code: string, subtotal: number, codes: DiscountCode[], now = new Date()) {
  const candidate = codes.find((item) => item.code.trim().toUpperCase() === code.trim().toUpperCase());
  if (!candidate) return { valid: false as const, message: 'El código no existe.' };
  const today = now.toISOString().slice(0, 10);
  if (candidate.status !== 'Activo' || candidate.startsAt > today || candidate.endsAt < today) return { valid: false as const, message: 'El código no está activo.' };
  if (candidate.usedCount >= candidate.maxUses) return { valid: false as const, message: 'El código alcanzó su límite de usos.' };
  if (subtotal < candidate.minPurchase) return { valid: false as const, message: `La compra mínima para este código es Q ${candidate.minPurchase.toFixed(2)}.` };
  return { valid: true as const, code: candidate, discount: Math.round(subtotal * candidate.discountPercent) / 100 };
}

export function loadTransferReceipts() {
  return readJson<TransferReceipt[]>(receiptStorageKey, []);
}

export function saveTransferReceipt(receipt: TransferReceipt) {
  if (typeof window === 'undefined') return false;
  try {
    const current = loadTransferReceipts();
    window.localStorage.setItem(receiptStorageKey, JSON.stringify([receipt, ...current]));
    return true;
  } catch {
    return false;
  }
}

export function updateTransferReceipt(id: string, status: TransferReceipt['status']) {
  const receipts = loadTransferReceipts();
  const next = receipts.map((receipt) => receipt.id === id ? { ...receipt, status } : receipt);
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(receiptStorageKey, JSON.stringify(next));
    return true;
  } catch {
    return false;
  }
}

export function loadRecentlyViewed() {
  return readJson<string[]>(recentStorageKey, []).slice(0, 8);
}

export function recordRecentlyViewed(productId: string) {
  if (typeof window === 'undefined') return;
  try {
    const next = [productId, ...loadRecentlyViewed().filter((id) => id !== productId)].slice(0, 8);
    window.localStorage.setItem(recentStorageKey, JSON.stringify(next));
  } catch {
    // Product browsing remains available when storage is disabled or full.
  }
}
