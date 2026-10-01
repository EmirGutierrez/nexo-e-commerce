import { apiClient } from '../../../shared/services/http-client';
import type { Announcement, DiscountCode, Offer, Product, TransferReceipt } from '../../../types';

const recentStorageKey = 'nexo-recent-products-v1';

export interface PromotionData {
  offers: Offer[];
  announcements: Announcement[];
  discountCodes: DiscountCode[];
}

export const emptyPromotionData = (): PromotionData => ({ offers: [], announcements: [], discountCodes: [] });

export const currentDateString = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

export const loadPromotionData = () => apiClient.get<PromotionData>('/api/catalog/promotions');
export const loadAdminPromotionData = () => apiClient.get<PromotionData>('/api/business/promotions');
export const savePromotionData = (data: PromotionData) => apiClient.put<PromotionData>('/api/business/promotions', data);
export const validateDiscountCode = (code: string, subtotal: number) =>
  apiClient.post<{ valid: boolean; message?: string; discount?: number; code?: DiscountCode }>('/api/catalog/discounts/validate', { code, subtotal });
export const loadTransferReceipts = () => apiClient.get<TransferReceipt[]>('/api/business/transfers/receipts');
export const updateTransferReceipt = (id: string, status: TransferReceipt['status']) =>
  apiClient.patch<{ id: string; status: TransferReceipt['status'] }>(`/api/business/transfers/receipts/${encodeURIComponent(id)}`, { status });

export function isPromotionActive(offer: Offer, now = new Date()) {
  const currentDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return offer.status === 'Activa' && offer.startsAt <= currentDate && offer.endsAt >= currentDate;
}

export function applyPromotion(product: Product, offers: Offer[], now = new Date()): Product {
  const offer = offers.find((item) => item.productId === product.id && item.originalPrice === product.price && isPromotionActive(item, now));
  return offer ? { ...product, price: offer.discountedPrice, compareAt: offer.originalPrice } : product;
}

export function loadRecentlyViewed() {
  if (typeof window === 'undefined') return [] as string[];
  try { return (JSON.parse(window.localStorage.getItem(recentStorageKey) || '[]') as string[]).slice(0, 8); }
  catch { return [] as string[]; }
}

export function recordRecentlyViewed(productId: string) {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(recentStorageKey, JSON.stringify([productId, ...loadRecentlyViewed().filter((id) => id !== productId)].slice(0, 8))); }
  catch { /* Browsing works without local storage. */ }
}
