import { accountingMovements, activities, brands as mockBrands, categories, inPersonSales, merchandisePurchases, orders, products, suppliers, users } from '../data/mockData';
import type { AccountingMovement, Brand, InPersonSale, MerchandisePurchase, Order, PaymentMethod, PaymentMethodSettings, Product, Supplier, User } from '../types';
export { productService } from './productService';

const delay = <T,>(data: T) => new Promise<T>((resolve) => setTimeout(() => resolve(data), 120));
const sessionPurchases: MerchandisePurchase[] = merchandisePurchases.map((purchase) => ({ ...purchase, items: purchase.items.map((item) => ({ ...item })) }));
const sessionAccountingMovements: AccountingMovement[] = accountingMovements.map((movement) => ({ ...movement }));
const sessionProducts: Product[] = products.map((product) => ({ ...product }));
const sessionSales: InPersonSale[] = inPersonSales.map((sale) => ({ ...sale, items: sale.items.map((item) => ({ ...item })) }));
const sessionBrands: Brand[] = mockBrands.map((brand) => ({ ...brand }));

/** Servicios mock con firmas asíncronas equivalentes a una futura API REST. */
export const authService = {
  login: (email: string, _password: string) => delay<User | null>(users.find((user) => user.email === email) || null),
  logout: () => delay(true),
  currentUser: () => delay<User | null>(null),
};

export const categoryService = { list: () => delay(categories.filter((category) => category !== 'Todos')) };
export const cartService = { calculate: (items: { productId: string; quantity: number }[]) => delay(items.reduce((total, item) => total + (products.find((p) => p.id === item.productId)?.price || 0) * item.quantity, 0)) };
export const orderService = { list: () => delay(orders), getById: (id: string) => delay(orders.find((order) => order.id === id) || null), create: (order: Partial<Order>) => delay({ ...order, id: '#NX-DEMO' } as Order) };
export const merchandisePurchaseService = {
  list: () => delay(sessionPurchases.map((purchase) => ({ ...purchase, items: purchase.items.map((item) => ({ ...item })) }))),
  create: (purchase: Omit<MerchandisePurchase, 'id'>) => {
    const created = { ...purchase, items: purchase.items.map((item) => ({ ...item })), id: `AB-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}` };
    sessionPurchases.unshift(created);
    return delay(created);
  },
  updateStatus: (id: string, status: MerchandisePurchase['status']) => {
    const purchase = sessionPurchases.find((entry) => entry.id === id);
    if (purchase) purchase.status = status;
    return delay({ id, status });
  },
};
export const customerService = { list: () => delay(users.filter((user) => user.id.startsWith('c') || user.role === 'employee')) };
const sessionSuppliers: Supplier[] = suppliers.map((supplier) => ({ ...supplier, productIds: [...supplier.productIds] }));
const cloneSupplier = (supplier: Supplier): Supplier => ({ ...supplier, productIds: [...supplier.productIds] });
export const supplierService = {
  list: (): Promise<Supplier[]> => delay(sessionSuppliers.map(cloneSupplier)),
  create: (input: Omit<Supplier, 'id'>): Promise<Supplier> => {
    validateSupplier(input);
    const created = { ...input, id: `sup-${Date.now()}`, productIds: [...new Set(input.productIds)] };
    sessionSuppliers.unshift(created);
    return delay(cloneSupplier(created));
  },
  update: (id: string, input: Omit<Supplier, 'id'>): Promise<Supplier> => {
    const supplier = sessionSuppliers.find((entry) => entry.id === id);
    if (!supplier) throw new Error('El proveedor ya no está disponible.');
    validateSupplier(input, id);
    for (const purchase of sessionPurchases) if (!purchase.supplierId && purchase.supplier === supplier.name) purchase.supplierId = supplier.id;
    Object.assign(supplier, input, { productIds: [...new Set(input.productIds)] });
    return delay(cloneSupplier(supplier));
  },
  archive: (id: string): Promise<Supplier> => {
    const supplier = sessionSuppliers.find((entry) => entry.id === id);
    if (!supplier) throw new Error('El proveedor ya no está disponible.');
    supplier.status = 'Inactivo';
    return delay(cloneSupplier(supplier));
  },
  delete: (id: string): Promise<boolean> => {
    const supplier = sessionSuppliers.find((entry) => entry.id === id);
    if (!supplier) throw new Error('El proveedor ya no está disponible.');
    if (supplier.productIds.length || sessionPurchases.some((purchase) => purchase.supplierId === id || purchase.supplier === supplier.name)) throw new Error('Este proveedor tiene productos o compras relacionadas. Archívalo para conservar su historial.');
    sessionSuppliers.splice(sessionSuppliers.indexOf(supplier), 1);
    return delay(true);
  },
};
function validateSupplier(input: Omit<Supplier, 'id'>, excludeId?: string) {
  if (!input.name.trim()) throw new Error('El nombre de la empresa es obligatorio.');
  if (sessionSuppliers.some((supplier) => supplier.id !== excludeId && supplier.name.trim().toLocaleLowerCase() === input.name.trim().toLocaleLowerCase())) throw new Error('Ya existe un proveedor con ese nombre.');
  if (input.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) throw new Error('Ingresa un correo válido.');
  const invalidProduct = input.productIds.find((id) => !sessionProducts.some((product) => product.id === id));
  if (invalidProduct) throw new Error('Selecciona productos existentes en el catálogo.');
}
export const inventoryService = { summary: () => delay({ total: 2486, lowStock: 24, outOfStock: 8 }), movements: () => delay(activities) };
export const productInventoryService = {
  list: () => delay(sessionProducts.map((product) => ({ ...product }))),
  assignBrand: (sku: string, brandId: string | null) => {
    const product = sessionProducts.find((entry) => entry.sku === sku);
    if (!product) throw new Error('No se encontró el producto para asociar su marca.');
    if (brandId && !sessionBrands.some((brand) => brand.id === brandId)) throw new Error('La marca seleccionada ya no está disponible.');
    product.brandId = brandId || undefined;
    const baseProduct = products.find((entry) => entry.id === product.id);
    if (baseProduct) baseProduct.brandId = product.brandId;
    return delay({ ...product });
  },
};
export const brandService = {
  list: () => delay(sessionBrands.map((brand) => ({ ...brand }))),
  create: (input: Omit<Brand, 'id'>) => {
    if (sessionBrands.some((brand) => brand.name.trim().toLocaleLowerCase() === input.name.trim().toLocaleLowerCase())) throw new Error('Ya existe una marca con ese nombre.');
    const brand = { ...input, id: `brand-${Date.now()}` };
    sessionBrands.unshift(brand);
    return delay({ ...brand });
  },
  update: (id: string, input: Omit<Brand, 'id'>) => {
    const brand = sessionBrands.find((entry) => entry.id === id);
    if (!brand) throw new Error('La marca ya no está disponible.');
    if (sessionBrands.some((entry) => entry.id !== id && entry.name.trim().toLocaleLowerCase() === input.name.trim().toLocaleLowerCase())) throw new Error('Ya existe otra marca con ese nombre.');
    Object.assign(brand, input);
    return delay({ ...brand });
  },
  delete: (id: string, reassignToBrandId?: string | null) => {
    const brand = sessionBrands.find((entry) => entry.id === id);
    if (!brand) throw new Error('La marca ya no está disponible.');
    const linked = sessionProducts.filter((product) => product.brandId === id);
    if (linked.length && reassignToBrandId === undefined) throw new Error(`Hay ${linked.length} productos asociados. Reasígnalos antes de eliminar la marca.`);
    if (reassignToBrandId === id) throw new Error('Selecciona otra marca o deja los productos sin marca.');
    if (reassignToBrandId && !sessionBrands.some((entry) => entry.id === reassignToBrandId)) throw new Error('La marca destino ya no está disponible.');
    linked.forEach((product) => {
      product.brandId = reassignToBrandId || undefined;
      const baseProduct = products.find((entry) => entry.id === product.id);
      if (baseProduct) baseProduct.brandId = product.brandId;
    });
    sessionBrands.splice(sessionBrands.indexOf(brand), 1);
    return delay({ id, reassignedProducts: linked.length });
  },
  productCounts: () => delay(sessionProducts.reduce<Record<string, number>>((counts, product) => {
    if (product.brandId) counts[product.brandId] = (counts[product.brandId] || 0) + 1;
    return counts;
  }, {})),
};
export const salesService = {
  summary: () => delay({ total: 48290, orders: 128, averageTicket: 377.27 }),
  listInPerson: () => delay(sessionSales.map((sale) => ({ ...sale, items: sale.items.map((item) => ({ ...item })) }))),
  createInPerson: (input: { seller: string; paymentMethod: PaymentMethod; items: { productId: string; quantity: number }[] }) => {
    if (!input.items.length) throw new Error('Agrega al menos un producto para registrar la venta.');
    if (!input.seller.trim()) throw new Error('No se pudo identificar al vendedor.');
    if (!paymentSettingsService.getCurrent()[input.paymentMethod]) throw new Error('El método de pago seleccionado está desactivado.');
    const quantities = new Map<string, number>();
    for (const item of input.items) {
      if (!Number.isInteger(item.quantity) || item.quantity < 1) throw new Error('Las cantidades deben ser números enteros mayores que cero.');
      quantities.set(item.productId, (quantities.get(item.productId) || 0) + item.quantity);
    }
    const saleItems = Array.from(quantities, ([productId, quantity]) => {
      const product = sessionProducts.find((entry) => entry.id === productId);
      if (!product) throw new Error('Uno de los productos ya no está disponible.');
      if (quantity > product.stock) throw new Error(`Stock insuficiente para ${product.name}. Disponible: ${product.stock}.`);
      return { productId, productName: product.name, sku: product.sku, quantity, unitPrice: product.price, subtotal: product.price * quantity };
    });
    const now = new Date();
    const id = `VP-${now.getFullYear()}-${String(sessionSales.length + 1).padStart(4, '0')}`;
    const sale: InPersonSale = {
      id,
      date: now.toISOString(),
      seller: input.seller.trim(),
      paymentMethod: input.paymentMethod,
      paymentStatus: input.paymentMethod === 'transfer' ? 'Pendiente de verificación' : 'Simulada',
      items: saleItems,
      total: saleItems.reduce((sum, item) => sum + item.subtotal, 0),
    };
    for (const item of saleItems) {
      const product = sessionProducts.find((entry) => entry.id === item.productId)!;
      product.stock -= item.quantity;
      product.status = product.stock === 0 ? 'Agotado' : product.stock < 10 ? 'Bajo stock' : 'Activo';
      const publicProduct = products.find((entry) => entry.id === item.productId);
      if (publicProduct) { publicProduct.stock = product.stock; publicProduct.status = product.status; }
    }
    sessionSales.unshift(sale);
    return delay({ ...sale, items: sale.items.map((item) => ({ ...item })) });
  },
};
export const paymentSettingsStorageKey = 'nexo.payment-methods.v1';
let currentPaymentSettings: PaymentMethodSettings = { card: true, transfer: true };
let paymentSettingsMemoryOnly = false;

/** Preferencias locales de demostración; esta interfaz se puede sustituir por una API. */
export const paymentSettingsService = {
  getCurrent: (): PaymentMethodSettings => {
    if (typeof window !== 'undefined' && !paymentSettingsMemoryOnly) {
      try {
        const raw = window.localStorage.getItem(paymentSettingsStorageKey);
        if (raw) {
          const stored = JSON.parse(raw) as Partial<PaymentMethodSettings>;
          const next = { card: stored.card === true, transfer: stored.transfer === true };
          if (next.card || next.transfer) currentPaymentSettings = next;
        }
      } catch { paymentSettingsMemoryOnly = true; }
    }
    return { ...currentPaymentSettings };
  },
  setEnabled: async (method: PaymentMethod, enabled: boolean): Promise<PaymentMethodSettings> => {
    const current = paymentSettingsService.getCurrent();
    if (!enabled && current[method] && !current[method === 'card' ? 'transfer' : 'card']) {
      throw new Error('Debe quedar al menos un método de pago activo.');
    }
    const next = { ...current, [method]: enabled };
    currentPaymentSettings = next;
    if (typeof window !== 'undefined') {
      try { window.localStorage.setItem(paymentSettingsStorageKey, JSON.stringify(next)); }
      catch { paymentSettingsMemoryOnly = true; }
    }
    return { ...next };
  },
};

export const paymentService = {
  simulate: async (method: PaymentMethod) => {
    if (!paymentSettingsService.getCurrent()[method]) throw new Error('Este método de pago está desactivado.');
    await delay(true);
    if (!paymentSettingsService.getCurrent()[method]) throw new Error('Este método de pago se desactivó antes de completar la simulación.');
    return { status: method === 'card' ? 'approved' as const : 'pending_verification' as const, reference: 'MOCK-001' };
  },
};
export const transferService = { list: () => delay(orders.filter((order) => order.payment === 'Transferencia')), approve: (id: string) => delay({ id, status: 'approved' }) };
export const userService = { list: () => delay(users), invite: (email: string) => delay({ email, status: 'pending' }) };
export const roleService = { list: () => delay(['Súper Administrador', 'Administrador', 'Vendedor', 'Personal de bodega', 'Empleado']) };
export const dashboardService = { summary: () => delay({ sales: 48290, orders: 128, newCustomers: 64, averageTicket: 377.27 }) };
export const accountingService = {
  list: () => delay(sessionAccountingMovements.map((movement) => ({ ...movement }))),
  create: (movement: Omit<AccountingMovement, 'id'>) => {
    const created = { ...movement, id: `acc-${Date.now()}` };
    sessionAccountingMovements.unshift(created);
    return delay(created);
  },
  updateStatus: (id: string, status: AccountingMovement['status']) => {
    const movement = sessionAccountingMovements.find((entry) => entry.id === id);
    if (movement) movement.status = status;
    return delay({ id, status });
  },
};

export type AdminTableRecord = Record<string, string | number>;
export const adminTableService = {
  create: (section: string, record: AdminTableRecord) => delay({ section, record }),
  update: (section: string, id: string, record: AdminTableRecord) => delay({ section, id, record }),
  delete: (section: string, id: string) => delay({ section, id }),
};
