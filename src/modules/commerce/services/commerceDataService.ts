import { products } from '../../../data/mockData';
import type { Announcement, DiscountCode, Offer, Product, TransferReceipt } from '../../../types';

const promotionStorageKey = 'nexo-promotions-v1';
const receiptStorageKey = 'nexo-transfer-receipts-v1';
const recentStorageKey = 'nexo-recent-products-v1';
const legacyKeys = { offers: 'nexo-offers', announcements: 'nexo-product-announcements', codes: 'nexo-discount-codes', receipts: 'nexo-transfer-receipts' };

export interface PromotionData {
  offers: Offer[];
  announcements: Announcement[];
  discountCodes: DiscountCode[];
}

const dateWindow = () => {
  const year = new Date().getFullYear();
  return { startsAt: `${year}-01-01`, endsAt: `${year + 1}-12-31` };
};

export const currentDateString = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
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
      { id: 'code-nexo10', code: 'NEXO10', discountPercent: 10, minPurchase: 500, maxUses: 100, usedCount: 18, startsAt, endsAt: `${new Date().getFullYear()}-12-31`, status: 'Activo' },
      { id: 'code-bienvenida', code: 'BIENVENIDA', discountPercent: 15, minPurchase: 800, maxUses: 50, usedCount: 6, startsAt, endsAt: `${new Date().getFullYear()}-10-31`, status: 'Activo' },
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
  const stored = readJson<Partial<PromotionData> | null>(promotionStorageKey, null);
  if (stored && (Array.isArray(stored.offers) || Array.isArray(stored.announcements) || Array.isArray(stored.discountCodes))) {
    return {
      offers: Array.isArray(stored.offers) ? stored.offers : defaults.offers,
      announcements: Array.isArray(stored.announcements) ? stored.announcements : defaults.announcements,
      discountCodes: Array.isArray(stored.discountCodes) ? stored.discountCodes : defaults.discountCodes,
    };
  }

  const legacyOffers = readJson<Array<Record<string, unknown>>>(legacyKeys.offers, []);
  const legacyAnnouncements = readJson<Array<Record<string, unknown>>>(legacyKeys.announcements, []);
  const legacyCodes = readJson<Array<Record<string, unknown>>>(legacyKeys.codes, []);
  let hasLegacyData = false;
  try { hasLegacyData = typeof window !== 'undefined' && Object.values(legacyKeys).slice(0, 3).some((key) => window.localStorage.getItem(key) !== null); } catch { /* Use the defaults when browser storage is unavailable. */ }
  if (!hasLegacyData) return defaults;

  const migrated: PromotionData = {
    offers: legacyOffers.flatMap((entry) => {
      const productId = typeof entry.productId === 'string' ? entry.productId : '';
      const product = catalog.find((item) => item.id === productId);
      const salePrice = Number(entry.salePrice);
      const percentage = Number(entry.discount);
      if (!product || !Number.isFinite(salePrice) || salePrice <= 0 || !Number.isFinite(percentage) || percentage <= 0 || percentage >= 100) return [];
      const originalPrice = product.compareAt && product.compareAt > product.price ? product.compareAt : Math.round(salePrice / (1 - percentage / 100));
      const startDate = typeof entry.startDate === 'string' ? entry.startDate : dateWindow().startsAt;
      const endDate = typeof entry.endDate === 'string' ? entry.endDate : dateWindow().endsAt;
      const seededDefault = entry.createdAt === '01 sep 2025' && entry.status === 'Activa' && endDate < currentDateString();
      return [{
        id: typeof entry.id === 'string' ? entry.id : `offer-${productId}`,
        productId, originalPrice, discountedPrice: salePrice,
        startsAt: seededDefault ? currentDateString() : startDate,
        endsAt: seededDefault ? dateWindow().endsAt : endDate,
        status: entry.status === 'Pausada' ? 'Pausada' as const : 'Activa' as const,
      }];
    }),
    announcements: legacyAnnouncements.flatMap((entry) => {
      if (typeof entry.title !== 'string' || typeof entry.message !== 'string') return [];
      const productId = typeof entry.productId === 'string' ? entry.productId : '';
      return [{
        id: typeof entry.id === 'string' ? entry.id : `announcement-${Date.now()}`,
        title: entry.title, description: entry.message,
        href: productId ? `/product/${encodeURIComponent(productId)}` : '/store',
        status: entry.status === 'Publicado' ? 'Activa' as const : 'Pausada' as const,
      }];
    }),
    discountCodes: legacyCodes.flatMap((entry) => {
      if (typeof entry.code !== 'string') return [];
      const expiresAt = typeof entry.expiresAt === 'string' ? entry.expiresAt : dateWindow().endsAt;
      return [{
        id: typeof entry.id === 'string' ? entry.id : `code-${entry.code.toLowerCase()}`,
        code: entry.code, discountPercent: Number(entry.discount) || 0,
        minPurchase: Number(entry.minSubtotal) || 0, maxUses: Number(entry.usageLimit) || 100,
        usedCount: Number(entry.used) || 0, startsAt: '2000-01-01', endsAt: expiresAt,
        status: entry.status === 'Pausado' ? 'Pausado' as const : 'Activo' as const,
      }];
    }),
  };
  savePromotionData(migrated);
  return migrated;
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
  const currentDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return offer.status === 'Activa' && offer.startsAt <= currentDate && offer.endsAt >= currentDate;
}

export function applyPromotion(product: Product, offers: Offer[], now = new Date()): Product {
  const offer = offers.find((item) => item.productId === product.id && isPromotionActive(item, now));
  if (!offer) return product;
  return { ...product, price: offer.discountedPrice, compareAt: offer.originalPrice };
}

export function validateDiscountCode(code: string, subtotal: number, codes: DiscountCode[], now = new Date()) {
  const candidate = codes.find((item) => item.code.trim().toUpperCase() === code.trim().toUpperCase());
  if (!candidate) return { valid: false as const, message: 'El código no existe.' };
  const currentDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  if (candidate.status !== 'Activo' || candidate.startsAt > currentDate || candidate.endsAt < currentDate) return { valid: false as const, message: 'El código no está activo.' };
  if (candidate.maxUses > 0 && candidate.usedCount >= candidate.maxUses) return { valid: false as const, message: 'El código alcanzó su límite de usos.' };
  if (subtotal < candidate.minPurchase) return { valid: false as const, message: `La compra mínima para este código es Q ${candidate.minPurchase.toFixed(2)}.` };
  return { valid: true as const, code: candidate, discount: Math.round(subtotal * candidate.discountPercent) / 100 };
}

export function loadTransferReceipts() {
  const current = readJson<TransferReceipt[] | null>(receiptStorageKey, null);
  if (Array.isArray(current)) return current;
  const legacy = readJson<Array<Record<string, unknown>>>(legacyKeys.receipts, []);
  const migrated = legacy.flatMap((item) => {
    if (typeof item.id !== 'string' || typeof item.customer !== 'string' || typeof item.imageDataUrl !== 'string') return [];
    const date = typeof item.submittedAt === 'string' ? item.submittedAt : typeof item.date === 'string' ? item.date : new Date().toISOString();
    return [{
      id: item.id, orderId: typeof item.orderId === 'string' ? item.orderId : item.id,
      customer: item.customer, phone: typeof item.phone === 'string' ? item.phone : undefined,
      address: typeof item.address === 'string' ? item.address : undefined,
      date, submittedAt: typeof item.submittedAt === 'string' ? item.submittedAt : undefined,
      total: Number(item.amount) || 0, image: item.imageDataUrl,
      reference: typeof item.reference === 'string' ? item.reference : undefined,
      fileName: typeof item.fileName === 'string' ? item.fileName : undefined,
      status: item.status === 'Aprobada' || item.status === 'Rechazada' ? item.status : 'Pendiente',
    } satisfies TransferReceipt];
  });
  if (migrated.length && typeof window !== 'undefined') {
    try { window.localStorage.setItem(receiptStorageKey, JSON.stringify(migrated)); } catch { /* Keep the legacy copy if the browser storage is full. */ }
  }
  return migrated;
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
