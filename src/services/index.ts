import type { AccountingMovement, Brand, InPersonSale, MerchandisePurchase, Order, PaymentMethod, PaymentMethodSettings, Product, Supplier, User } from '../types';
import { roleLabels } from '../types';
import { ApiError, apiClient, clearCsrfToken } from '../shared/services/http-client';
export { productService } from './productService';
export { roleService } from './roleService';
import { roleService } from './roleService';

type JsonRecord = Record<string, unknown>;
interface ApiRecord<T extends JsonRecord = JsonRecord> { id: string; resource: string; data: T; createdAt?: string; updatedAt?: string }
export type AdminTableRecord = Record<string, string | number>;

const business = {
  list: (resource: string) => apiClient.get<ApiRecord[]>(`/api/business/${encodeURIComponent(resource)}`),
  create: (resource: string, data: JsonRecord) => apiClient.post<ApiRecord>(`/api/business/${encodeURIComponent(resource)}`, data),
  update: (resource: string, id: string, data: JsonRecord) => apiClient.put<ApiRecord>(`/api/business/${encodeURIComponent(resource)}/${encodeURIComponent(id)}`, data),
  delete: (resource: string, id: string) => apiClient.delete<void>(`/api/business/${encodeURIComponent(resource)}/${encodeURIComponent(id)}`),
};
const dataWithId = <T extends JsonRecord>(record: ApiRecord<T>): T & { id: string } => ({ ...record.data, id: record.id });
const value = (data: JsonRecord, ...keys: string[]) => keys.map((key) => data[key]).find((entry) => entry !== undefined && entry !== null);
const stringValue = (data: JsonRecord, ...keys: string[]) => String(value(data, ...keys) ?? '');
const numberValue = (data: JsonRecord, ...keys: string[]) => Number(value(data, ...keys) ?? 0);

function mapProduct(record: ApiRecord): Product {
  const data = record.data;
  const stock = numberValue(data, 'stock', 'Existencias');
  const statusValue = stringValue(data, 'status', 'Estado');
  return {
    id: record.id,
    brandId: stringValue(data, 'brandId', 'Marca') || undefined,
    name: stringValue(data, 'name', 'Producto'),
    category: stringValue(data, 'category', 'Categoría'),
    price: numberValue(data, 'price', 'Valor'),
    compareAt: value(data, 'compareAt', 'Precio anterior') === undefined ? undefined : numberValue(data, 'compareAt', 'Precio anterior'),
    stock,
    status: statusValue === 'Inactivo' || statusValue === 'Inactiva' ? 'Inactivo' : statusValue === 'Agotado' || stock === 0 ? 'Agotado' : stock < 10 ? 'Bajo stock' : 'Activo',
    image: stringValue(data, 'image', 'Imagen'),
    description: stringValue(data, 'description', 'Descripción'),
    featured: Boolean(data.featured),
    sku: stringValue(data, 'sku', 'SKU'),
  };
}
function productData(product: Product): JsonRecord {
  return { name: product.name, brandId: product.brandId || null, category: product.category, price: product.price,
    compareAt: product.compareAt ?? null, stock: product.stock, status: product.status, image: product.image,
    description: product.description, featured: Boolean(product.featured), sku: product.sku };
}

interface ApiUser { id: string; name: string; email: string; role: string; status: string; lastLoginAt?: string | null; permissions?: string[] }
function mapApiUser(user: ApiUser): User {
  if (!(user.role in roleLabels)) throw new Error('El servidor devolvió un rol que el frontend no reconoce.');
  const initials = user.name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  return { id: user.id, name: user.name, email: user.email, role: user.role as User['role'], initials,
    status: user.status === 'ACTIVE' ? 'Activo' : user.status === 'PENDING' ? 'Pendiente' : 'Inactivo',
    permissions: user.permissions || [], lastLoginAt: user.lastLoginAt };
}

export const authService = {
  login: async (email: string, password: string): Promise<User | null> => {
    try { const user = await apiClient.post<ApiUser>('/api/auth/login', { email, password }); clearCsrfToken(); return mapApiUser(user); }
    catch (error) { if (error instanceof ApiError && error.status === 401) return null; throw error; }
  },
  registerCustomer: async (name: string, email: string, password: string): Promise<User> => {
    const user = await apiClient.post<ApiUser>('/api/auth/register', { name, email, password }); clearCsrfToken(); return mapApiUser(user);
  },
  acceptInvitation: async (token: string, password: string): Promise<void> => {
    await apiClient.post<void>('/api/auth/accept-invitation', { token, password });
  },
  logout: async (): Promise<void> => { try { await apiClient.post<void>('/api/auth/logout'); } finally { clearCsrfToken(); } },
  currentUser: async (): Promise<User | null> => {
    try { return mapApiUser(await apiClient.get<ApiUser>('/api/auth/me')); }
    catch (error) { if (error instanceof ApiError && error.status === 401) return null; throw error; }
  },
};

export const categoryService = {
  list: async (): Promise<string[]> => (await business.list('categories')).map((record) => String(value(record.data, 'name', 'Nombre') || '')).filter(Boolean),
};
export const cartService = {
  calculate: async (items: { productId: string; quantity: number }[]) => {
    const records = await apiClient.get<JsonRecord[]>('/api/catalog/products');
    return items.reduce((sum, item) => sum + numberValue(records.find((row) => row.id === item.productId) || {}, 'price') * item.quantity, 0);
  },
};

export const orderService = {
  list: async (): Promise<Order[]> => (await business.list('orders')).map((record) => mapOrder(record)),
  getById: async (id: string): Promise<Order | null> => (await orderService.list()).find((order) => order.id === id) || null,
  create: async (order: Partial<Order>): Promise<Order> => mapOrder(await business.create('orders', orderData(order))),
  updateStatus: async (id: string, status: Order['status']) => {
    const current = await business.list('orders');
    const record = current.find((item) => item.id === id);
    if (!record) throw new Error('No se encontró el pedido.');
    const previousStatus = stringValue(record.data, 'status', 'Estado');
    const updated = await business.update('orders', id, { ...record.data, status });
    return { ...mapOrder(updated), previousStatus };
  },
};
function mapOrder(record: ApiRecord): Order {
  const data = record.data;
  const rawPayment = stringValue(data, 'payment', 'paymentMethod');
  return { id: record.id, customer: stringValue(data, 'customer', 'Cliente'),
    date: stringValue(data, 'date', 'Fecha').slice(0, 10), items: Array.isArray(data.items) ? data.items.length : numberValue(data, 'itemsCount'),
    total: numberValue(data, 'total', 'Total'),
    status: stringValue(data, 'status', 'Estado') as Order['status'],
    payment: rawPayment === 'transfer' || rawPayment === 'Transferencia' ? 'Transferencia' : 'Tarjeta' };
}
function orderData(order: Partial<Order>): JsonRecord {
  return { customer: order.customer || '', date: order.date || new Date().toISOString(), total: order.total || 0,
    status: order.status || 'Pendiente de pago', payment: order.payment || 'Tarjeta', paymentMethod: order.payment === 'Transferencia' ? 'transfer' : 'card', paymentStatus: 'Pendiente de verificación' };
}

export const merchandisePurchaseService = {
  list: async (): Promise<MerchandisePurchase[]> => (await business.list('purchases')).map(mapPurchase),
  create: async (purchase: Omit<MerchandisePurchase, 'id'>): Promise<MerchandisePurchase> => mapPurchase(await business.create('purchases', purchase as unknown as JsonRecord)),
  updateStatus: async (id: string, status: MerchandisePurchase['status']) => {
    const record = (await business.list('purchases')).find((entry) => entry.id === id);
    if (!record) throw new Error('No se encontró la compra.');
    await business.update('purchases', id, { ...record.data, status });
    return { id, status };
  },
};
function mapPurchase(record: ApiRecord): MerchandisePurchase {
  const data = record.data;
  return { id: record.id, supplierId: stringValue(data, 'supplierId') || undefined, supplier: stringValue(data, 'supplier'),
    date: stringValue(data, 'date').slice(0, 10), items: Array.isArray(data.items) ? data.items as MerchandisePurchase['items'] : [],
    total: numberValue(data, 'total'), status: stringValue(data, 'status') as MerchandisePurchase['status'] };
}
export const customerService = {
  list: async (): Promise<User[]> => (await business.list('customers')).map((record) => {
    const data = record.data; const words = stringValue(data, 'name').trim().split(/\s+/).filter(Boolean);
    return { id: record.id, name: stringValue(data, 'name'), email: stringValue(data, 'email'), role: 'customer',
      initials: words.slice(0, 2).map((word) => word[0]).join('').toUpperCase(), status: stringValue(data, 'status') === 'Inactivo' ? 'Inactivo' : 'Activo' };
  }),
};

export const supplierService = {
  list: async (): Promise<Supplier[]> => (await business.list('suppliers')).map((record) => ({
    id: record.id, name: stringValue(record.data, 'name'), contactPerson: stringValue(record.data, 'contactPerson'),
    phone: stringValue(record.data, 'phone'), email: stringValue(record.data, 'email'),
    status: stringValue(record.data, 'status') === 'Inactivo' ? 'Inactivo' : 'Activo',
    productIds: Array.isArray(record.data.productIds) ? record.data.productIds.map(String) : [],
    lastOrder: stringValue(record.data, 'lastOrder') || undefined,
  })),
  create: async (input: Omit<Supplier, 'id'>) => mapSupplier(await business.create('suppliers', input as unknown as JsonRecord)),
  update: async (id: string, input: Omit<Supplier, 'id'>) => mapSupplier(await business.update('suppliers', id, input as unknown as JsonRecord)),
  archive: async (id: string) => {
    const current = (await supplierService.list()).find((item) => item.id === id);
    if (!current) throw new Error('El proveedor ya no está disponible.');
    return supplierService.update(id, { ...current, status: 'Inactivo' });
  },
  delete: async (id: string) => { await business.delete('suppliers', id); return true; },
};
function mapSupplier(record: ApiRecord): Supplier {
  const data = record.data;
  return { id: record.id, name: stringValue(data, 'name'), contactPerson: stringValue(data, 'contactPerson'), phone: stringValue(data, 'phone'),
    email: stringValue(data, 'email'), status: stringValue(data, 'status') === 'Inactivo' ? 'Inactivo' : 'Activo',
    productIds: Array.isArray(data.productIds) ? data.productIds.map(String) : [], lastOrder: stringValue(data, 'lastOrder') || undefined };
}
export const inventoryService = {
  summary: () => apiClient.get<{ products: number; totalUnits: number; lowStock: number; outOfStock: number }>('/api/business/inventory/summary'),
  movements: () => apiClient.get<JsonRecord[]>('/api/business/inventory/movements'),
};
export const productInventoryService = {
  list: async (): Promise<Product[]> => (await business.list('products')).map(mapProduct),
  assignBrand: async (sku: string, brandId: string | null) => {
    const product = (await productInventoryService.list()).find((entry) => entry.sku === sku);
    if (!product) throw new Error('No se encontró el producto para asociar su marca.');
    return mapProduct(await business.update('products', product.id, { ...productData(product), brandId }));
  },
};
export const brandService = {
  list: async (): Promise<Brand[]> => (await business.list('brands')).map((record) => ({ id: record.id, name: stringValue(record.data, 'name'),
    description: stringValue(record.data, 'description'), contact: stringValue(record.data, 'contact'), website: stringValue(record.data, 'website'),
    status: stringValue(record.data, 'status') === 'Inactiva' ? 'Inactiva' : 'Activa' })),
  create: async (input: Omit<Brand, 'id'>) => mapBrand(await business.create('brands', input as unknown as JsonRecord)),
  update: async (id: string, input: Omit<Brand, 'id'>) => mapBrand(await business.update('brands', id, input as unknown as JsonRecord)),
  delete: async (id: string, reassignToBrandId?: string | null) => {
    const linkedProducts = (await productInventoryService.list()).filter((product) => product.brandId === id);
    if (linkedProducts.length && reassignToBrandId !== undefined) {
      await Promise.all(linkedProducts.map((product) => business.update('products', product.id, { ...productData(product), brandId: reassignToBrandId || null })));
    }
    await business.delete('brands', id);
    return { id, reassignedProducts: linkedProducts.length };
  },
  productCounts: async () => (await productInventoryService.list()).reduce<Record<string, number>>((counts, product) => {
    if (product.brandId) counts[product.brandId] = (counts[product.brandId] || 0) + 1; return counts;
  }, {}),
};
function mapBrand(record: ApiRecord): Brand {
  return { id: record.id, name: stringValue(record.data, 'name'), description: stringValue(record.data, 'description'), contact: stringValue(record.data, 'contact'),
    website: stringValue(record.data, 'website'), status: stringValue(record.data, 'status') === 'Inactiva' ? 'Inactiva' : 'Activa' };
}

export const salesService = {
  summary: async () => {
    const rows = await salesService.listInPerson(); const total = rows.reduce((sum, row) => sum + row.total, 0);
    return { total, orders: rows.length, averageTicket: rows.length ? total / rows.length : 0 };
  },
  listInPerson: async (): Promise<InPersonSale[]> => (await business.list('sales')).map((record) => {
    const data = record.data;
    return { id: record.id, date: stringValue(data, 'date'), seller: stringValue(data, 'seller'), paymentMethod: stringValue(data, 'paymentMethod') as PaymentMethod,
      paymentStatus: stringValue(data, 'paymentStatus') as InPersonSale['paymentStatus'], items: Array.isArray(data.items) ? data.items as InPersonSale['items'] : [], total: numberValue(data, 'total') };
  }),
  createInPerson: async (input: { seller: string; paymentMethod: PaymentMethod; items: { productId: string; quantity: number }[] }): Promise<InPersonSale> => {
    const record = await apiClient.post<ApiRecord>('/api/business/sales/record', input);
    const data = record.data;
    return { id: record.id, date: stringValue(data, 'date'), seller: stringValue(data, 'seller'), paymentMethod: stringValue(data, 'paymentMethod') as PaymentMethod,
      paymentStatus: stringValue(data, 'paymentStatus') as InPersonSale['paymentStatus'], items: data.items as InPersonSale['items'], total: numberValue(data, 'total') };
  },
};

let currentPaymentSettings: PaymentMethodSettings = { card: true, transfer: true };
export const paymentSettingsStorageKey = 'nexo.payment-methods.v1';
export const paymentSettingsService = {
  getCurrent: (): PaymentMethodSettings => ({ ...currentPaymentSettings }),
  load: async (): Promise<PaymentMethodSettings> => {
    const value = await apiClient.get<PaymentMethodSettings>('/api/business/payment-settings'); currentPaymentSettings = value; return { ...value };
  },
  setEnabled: async (method: PaymentMethod, enabled: boolean): Promise<PaymentMethodSettings> => {
    currentPaymentSettings = await apiClient.put<PaymentMethodSettings>(`/api/business/payment-settings/${method}`, { enabled });
    return { ...currentPaymentSettings };
  },
};
export const paymentService = {
  simulate: async (method: PaymentMethod) => {
    const settings = await apiClient.get<PaymentMethodSettings>('/api/catalog/payment-methods');
    if (!settings[method]) throw new Error('Este método de pago está desactivado.');
    return { status: method === 'card' ? 'approved' as const : 'pending_verification' as const, reference: `DEMO-${crypto.randomUUID()}` };
  },
};
export const checkoutService = {
  create: (input: { customerName: string; customerEmail: string; customerPhone?: string; address: string; paymentMethod: PaymentMethod; items: { productId: string; quantity: number }[] }) =>
    apiClient.post<ApiRecord>('/api/catalog/orders', input).then((record) => ({
      id: record.id, reference: stringValue(record.data, 'orderNumber') || record.id,
      total: numberValue(record.data, 'total'), status: stringValue(record.data, 'status'),
      paymentMethod: stringValue(record.data, 'paymentMethod') as PaymentMethod,
      paymentStatus: stringValue(record.data, 'paymentStatus'),
    })),
};
export const transferService = {
  list: async () => (await business.list('orders')).filter((record) => stringValue(record.data, 'paymentMethod', 'payment') === 'transfer' || stringValue(record.data, 'payment') === 'Transferencia').map(mapOrder),
  approve: async (id: string) => {
    const record = (await business.list('orders')).find((item) => item.id === id);
    if (!record) throw new Error('No se encontró el pedido.');
    const updated = await business.update('orders', id, { ...record.data, paymentStatus: 'Aprobada', status: 'En preparación' });
    return { id, status: stringValue(updated.data, 'paymentStatus') };
  },
};
export const userService = {
  list: async (): Promise<User[]> => (await apiClient.get<ApiUser[]>('/api/users')).map(mapApiUser),
  invite: async (input: { name: string; email: string; role: User['role'] }) => apiClient.post<{ id: string; email: string; status: string; token: string }>('/api/users/invitations', input),
  updateProfile: async (name: string): Promise<User> => mapApiUser(await apiClient.patch<ApiUser>('/api/auth/me/profile', { name })),
};
export const dashboardService = {
  summary: async (period: '7d' | '30d' | 'year' = '30d') => {
    const result = await apiClient.get<{ sales: number; orders: number; newCustomers: number; averageTicket: number;
      products: { products: number; totalUnits: number; lowStock: number; outOfStock: number };
      series: { date: string; sales: number; orders: number }[];
      recentActivity: { id: string; title: string; description: string; time: string; type: string }[] }>(`/api/business/dashboard/summary?period=${period}`);
    return { ...result, sales: Number(result.sales), averageTicket: Number(result.averageTicket),
      products: { ...result.products, products: Number(result.products.products), totalUnits: Number(result.products.totalUnits), lowStock: Number(result.products.lowStock), outOfStock: Number(result.products.outOfStock) },
      series: result.series.map((point) => ({ ...point, sales: Number(point.sales), orders: Number(point.orders) })) };
  },
};
export interface BusinessProfileSettings {
  businessName: string;
  contactEmail: string;
  phone: string;
  address: string;
  notifications: { orders: boolean; stock: boolean };
}
export const businessSettingsService = {
  load: () => apiClient.get<BusinessProfileSettings>('/api/business/settings/profile'),
  save: (settings: BusinessProfileSettings) => apiClient.put<BusinessProfileSettings>('/api/business/settings/profile', settings),
};
export const accountingService = {
  list: async (): Promise<AccountingMovement[]> => (await business.list('accounting')).map((record) => ({ id: record.id, date: stringValue(record.data, 'date'),
    concept: stringValue(record.data, 'concept'), category: stringValue(record.data, 'category'), type: stringValue(record.data, 'type') as AccountingMovement['type'],
    amount: numberValue(record.data, 'amount'), status: stringValue(record.data, 'status') as AccountingMovement['status'] })),
  create: async (movement: Omit<AccountingMovement, 'id'>): Promise<AccountingMovement> => {
    const record = await business.create('accounting', movement as unknown as JsonRecord);
    return { ...movement, id: record.id };
  },
  updateStatus: async (id: string, status: AccountingMovement['status']) => {
    const record = (await business.list('accounting')).find((item) => item.id === id);
    if (!record) throw new Error('No se encontró el movimiento.');
    await business.update('accounting', id, { ...record.data, status }); return { id, status };
  },
};

const resourceFor = (section: string) => section === 'inventory' || section === 'inventory/alerts' ? 'products' : ['transfers', 'payments', 'invoices'].includes(section) ? 'orders' : section;
function toDomainData(section: string, row: AdminTableRecord): JsonRecord {
  if (section === 'products' || section === 'inventory' || section === 'inventory/alerts') return {
    name: row.Producto, brandId: row.Marca || null, category: row.Categoría || '', sku: row.SKU || '', price: row.Valor ?? 0,
    stock: row.Existencias ?? 0, status: row.Estado === 'En stock' ? 'Activo' : row.Estado || 'Activo', image: row.Imagen || '',
    ...(row.Descripción === undefined ? {} : { description: row.Descripción }),
  };
  if (section === 'categories') return { name: row.Nombre, status: row.Estado || 'Activo' };
  if (section === 'customers') return { name: row.Nombre, email: row.Correo, orders: row.Pedidos ?? 0, totalPurchased: row['Total comprado'] ?? 0, status: row.Estado || 'Activo' };
  if (section === 'orders' || section === 'payments' || section === 'transfers' || section === 'invoices') {
    const common: JsonRecord = {
    orderNumber: row.Pedido || row.Factura, customer: row.Cliente, date: row.Fecha || new Date().toISOString(), total: row.Total ?? row.Valor ?? 0,
    payment: row.Pago || 'Transferencia', paymentMethod: row.Pago === 'Tarjeta' ? 'card' : 'transfer',
  };
    if (section === 'orders') common.status = row.Estado || 'Pendiente de pago';
    if (section === 'invoices') common.status = row.Estado === 'Cancelada' ? 'Cancelado' : 'En preparación';
    if (section === 'payments' || section === 'transfers') common.paymentStatus = row['Estado de pago'] || 'Pendiente de verificación';
    return common;
  }
  if (section === 'users') return {};
  if (section === 'roles-permissions') return { name: row.Nombre, users: row.Usuarios ?? 0, permissions: row.Permisos || '', status: row.Estado || 'Activo' };
  if (section === 'reports') return { name: row.Reporte, period: row.Periodo };
  if (section === 'settings' || section === 'profile') return { name: row.Configuración, description: row.Descripción, status: row.Estado };
  return Object.fromEntries(Object.entries(row).map(([key, item]) => [key, item]));
}
function toAdminRow(section: string, data: JsonRecord): AdminTableRecord {
  if (section === 'products' || section === 'inventory' || section === 'inventory/alerts') return {
    Producto: stringValue(data, 'name', 'Producto'), Marca: stringValue(data, 'brandId', 'Marca'), Categoría: stringValue(data, 'category', 'Categoría'),
    SKU: stringValue(data, 'sku', 'SKU'), Valor: numberValue(data, 'price', 'Valor'), Existencias: numberValue(data, 'stock', 'Existencias'),
    Imagen: stringValue(data, 'image', 'Imagen'), Estado: section === 'inventory' && stringValue(data, 'status', 'Estado') === 'Activo' ? 'En stock' : stringValue(data, 'status', 'Estado'),
    Ubicación: stringValue(data, 'Ubicación') || 'Bodega central',
  };
  if (section === 'categories') return { Nombre: stringValue(data, 'name'), Productos: numberValue(data, 'products'), 'Ventas del mes': numberValue(data, 'monthlySales'), Estado: stringValue(data, 'status') };
  if (section === 'customers') return { Nombre: stringValue(data, 'name'), Correo: stringValue(data, 'email'), Pedidos: numberValue(data, 'orders'), 'Total comprado': numberValue(data, 'totalPurchased'), Estado: stringValue(data, 'status') };
  if (section === 'reports') return { Reporte: stringValue(data, 'name'), Periodo: stringValue(data, 'period'), 'Generado por': stringValue(data, 'generatedBy'), Fecha: stringValue(data, 'date').slice(0, 10), Estado: stringValue(data, 'status') };
  if (section === 'orders' || section === 'sales') return { Pedido: stringValue(data, 'orderNumber') || String(data.id || ''), Cliente: stringValue(data, 'customer'), Fecha: stringValue(data, 'date').slice(0, 10), Total: numberValue(data, 'total'), Estado: stringValue(data, 'status') };
  if (section === 'transfers' || section === 'payments') return { Pedido: stringValue(data, 'orderNumber') || String(data.id || ''), Cliente: stringValue(data, 'customer'), Fecha: stringValue(data, 'date').slice(0, 10), Valor: numberValue(data, 'total'), 'Estado de pago': stringValue(data, 'paymentStatus') };
  if (section === 'invoices') return { Factura: stringValue(data, 'orderNumber') || String(data.id || ''), Cliente: stringValue(data, 'customer'), Fecha: stringValue(data, 'date').slice(0, 10), Total: numberValue(data, 'total'), Estado: stringValue(data, 'status') === 'Cancelado' ? 'Cancelada' : 'Emitida' };
  if (section === 'settings' || section === 'profile') return { Configuración: stringValue(data, 'name'), Descripción: stringValue(data, 'description'), Estado: stringValue(data, 'status') };
  return Object.fromEntries(Object.entries(data).map(([key, item]) => [key, typeof item === 'number' || typeof item === 'string' ? item : JSON.stringify(item)]));
}

export const adminTableService = {
  list: async (section: string): Promise<{ id: string; data: AdminTableRecord }[]> => {
    if (section === 'users') return (await apiClient.get<ApiUser[]>('/api/users')).map((user) => ({ id: user.id,
      data: { Nombre: user.name, Correo: user.email, Rol: roleLabels[user.role as User['role']] || user.role,
        'Último acceso': user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString('es-GT') : 'Nunca', Estado: user.status === 'ACTIVE' ? 'Activo' : user.status === 'PENDING' ? 'Pendiente' : 'Inactivo' } }));
    if (section === 'roles-permissions') return (await roleService.list()).map((role) => ({ id: role.id,
      data: { Nombre: role.name, Usuarios: role.users, Permisos: Object.values(role.permissions).flat().length, 'Última actualización': '—', Estado: 'Activo' } }));
    if (section === 'inventory/history') return (await inventoryService.movements()).map((movement) => ({ id: String(movement.id), data: {
      Producto: String(movement.productName), SKU: String(movement.sku), Existencias: Number(movement.quantity), Ubicación: String(movement.reason), Estado: String(movement.type),
    } }));
    if (section === 'inventory/alerts') return (await productInventoryService.list()).filter((product) => product.status !== 'Inactivo' && product.stock < 10).map((product) => ({ id: product.id,
      data: { Producto: product.name, SKU: product.sku, Existencias: product.stock, Ubicación: 'Bodega central', Estado: product.status } }));
    if (['transfers', 'payments', 'invoices'].includes(section)) {
      const orders = await business.list('orders');
      const filtered = section === 'transfers' ? orders.filter((record) => stringValue(record.data, 'paymentMethod', 'payment') === 'transfer' || stringValue(record.data, 'payment') === 'Transferencia') : orders;
      return filtered.map((record) => ({ id: record.id, data: toAdminRow(section, dataWithId(record)) }));
    }
    return (await business.list(resourceFor(section))).map((record) => ({ id: record.id, data: toAdminRow(section, dataWithId(record)) }));
  },
  create: async (section: string, row: AdminTableRecord): Promise<{ id: string; data: AdminTableRecord; inviteUrl?: string }> => {
    if (section === 'users') {
      const role = (Object.keys(roleLabels) as User['role'][]).find((candidate) => roleLabels[candidate] === row.Rol);
      if (!role || role === 'customer' || role === 'superadmin') throw new Error('Selecciona un rol de equipo permitido.');
      const invitation = await userService.invite({ name: String(row.Nombre || ''), email: String(row.Correo || ''), role });
      const acceptUrl = new URL('/accept-invitation', window.location.origin); acceptUrl.searchParams.set('token', invitation.token);
      return { id: invitation.id, inviteUrl: acceptUrl.toString(), data: { Nombre: String(row.Nombre), Correo: invitation.email,
        Rol: roleLabels[role], 'Último acceso': 'Nunca', Estado: 'Pendiente' } };
    }
    if (section === 'roles-permissions') throw new Error('Los roles disponibles se administran desde la matriz de permisos.');
    const record = await business.create(resourceFor(section), toDomainData(section, row));
    return { id: record.id, data: toAdminRow(section, dataWithId(record)) };
  },
  update: async (section: string, id: string, row: AdminTableRecord): Promise<{ id: string; data: AdminTableRecord }> => {
    if (section === 'users') {
      const role = (Object.keys(roleLabels) as User['role'][]).find((candidate) => roleLabels[candidate] === row.Rol);
      const status = row.Estado === 'Activo' ? 'ACTIVE' : row.Estado === 'Pendiente' ? 'PENDING' : row.Estado ? 'DISABLED' : undefined;
      await apiClient.patch<void>(`/api/users/${id}`, { role, status });
      const result = (await adminTableService.list('users')).find((entry) => entry.id === id);
      if (!result) throw new Error('El usuario ya no está disponible.'); return result;
    }
    const resource = resourceFor(section);
    const original = (await business.list(resource)).find((entry) => entry.id === id);
    if (!original) throw new Error('El registro ya no está disponible.');
    let update: JsonRecord;
    if (section === 'orders') update = { ...original.data, status: row.Estado };
    else if (section === 'sales') update = { ...original.data, status: row.Estado };
    else if (section === 'payments' || section === 'transfers') {
      const paymentStatus = row['Estado de pago'];
      update = { ...original.data, paymentStatus, ...(paymentStatus === 'Aprobada' ? { status: 'En preparación' } : {}) };
    } else if (section === 'invoices') update = { ...original.data, ...(row.Estado === 'Cancelada' ? { status: 'Cancelado' } : {}) };
    else update = { ...original.data, ...toDomainData(section, row) };
    const record = await business.update(resource, id, update);
    return { id: record.id, data: toAdminRow(section, dataWithId(record)) };
  },
  delete: async (section: string, id: string) => {
    if (section === 'users') throw new Error('Las cuentas de usuario se desactivan para conservar la auditoría.');
    await business.delete(resourceFor(section), id);
  },
};
