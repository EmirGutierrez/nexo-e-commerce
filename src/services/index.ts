import { activities, categories, orders, products, users } from '../data/mockData';
import type { Order, Product, User } from '../types';
export { productService } from './productService';

const delay = <T,>(data: T) => new Promise<T>((resolve) => setTimeout(() => resolve(data), 120));

/** Servicios mock con firmas asíncronas equivalentes a una futura API REST. */
export const authService = {
  login: (email: string, _password: string) => delay<User | null>(users.find((user) => user.email === email) || null),
  logout: () => delay(true),
  currentUser: () => delay<User | null>(null),
};

export const categoryService = { list: () => delay(categories.filter((category) => category !== 'Todos')) };
export const cartService = { calculate: (items: { productId: string; quantity: number }[]) => delay(items.reduce((total, item) => total + (products.find((p) => p.id === item.productId)?.price || 0) * item.quantity, 0)) };
export const orderService = { list: () => delay(orders), getById: (id: string) => delay(orders.find((order) => order.id === id) || null), create: (order: Partial<Order>) => delay({ ...order, id: '#NX-DEMO' } as Order) };
export const customerService = { list: () => delay(users.filter((user) => user.id.startsWith('c') || user.role === 'employee')) };
export const supplierService = { list: () => delay([{ id: 's1', name: 'TecnoImport GT', status: 'Activo' }, { id: 's2', name: 'Casa Moka', status: 'Activo' }]) };
export const inventoryService = { summary: () => delay({ total: 2486, lowStock: 24, outOfStock: 8 }), movements: () => delay(activities) };
export const salesService = { summary: () => delay({ total: 48290, orders: 128, averageTicket: 377.27 }) };
export const paymentService = { simulate: (method: 'card' | 'transfer') => delay({ status: method === 'card' ? 'approved' : 'pending_verification', reference: 'MOCK-001' }) };
export const transferService = { list: () => delay(orders.filter((order) => order.payment === 'Transferencia')), approve: (id: string) => delay({ id, status: 'approved' }) };
export const userService = { list: () => delay(users), invite: (email: string) => delay({ email, status: 'pending' }) };
export const roleService = { list: () => delay(['Súper Administrador', 'Administrador', 'Vendedor', 'Personal de bodega', 'Empleado']) };
export const dashboardService = { summary: () => delay({ sales: 48290, orders: 128, newCustomers: 64, averageTicket: 377.27 }) };
