export type Role = 'superadmin' | 'admin' | 'sales' | 'warehouse' | 'employee';
export type PaymentMethod = 'card' | 'transfer';
export type PaymentMethodSettings = Record<PaymentMethod, boolean>;

export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  compareAt?: number;
  stock: number;
  status: 'Activo' | 'Bajo stock' | 'Agotado';
  image: string;
  description: string;
  featured?: boolean;
  sku: string;
}

export interface CartItem extends Product { quantity: number }

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  initials: string;
  status: 'Activo' | 'Pendiente' | 'Inactivo';
}

export interface Order {
  id: string;
  customer: string;
  date: string;
  items: number;
  total: number;
  status: 'Completado' | 'En preparación' | 'Pendiente de pago' | 'Cancelado';
  payment: 'Tarjeta' | 'Transferencia';
}

export interface InPersonSaleItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface InPersonSale {
  id: string;
  date: string;
  seller: string;
  paymentMethod: PaymentMethod;
  paymentStatus: 'Simulada' | 'Pendiente de verificación';
  items: InPersonSaleItem[];
  total: number;
}

export interface MerchandisePurchaseItem {
  productId: string;
  productName: string;
  quantity: number;
  unitCost: number;
}

export interface MerchandisePurchase {
  id: string;
  supplier: string;
  date: string;
  items: MerchandisePurchaseItem[];
  total: number;
  status: 'Registrada' | 'Pendiente' | 'Anulada';
}

export interface Supplier {
  id: string;
  name: string;
  status: 'Activo' | 'Inactivo';
  productIds: string[];
}

export interface Activity { title: string; description: string; time: string; icon: string; tone: string }

export interface AccountingMovement {
  id: string;
  date: string;
  concept: string;
  category: string;
  type: 'Ingreso' | 'Egreso';
  amount: number;
  status: 'Registrado' | 'Pendiente' | 'Anulado';
}

export const roleLabels: Record<Role, string> = {
  superadmin: 'Súper Administrador', admin: 'Administrador', sales: 'Vendedor', warehouse: 'Personal de bodega', employee: 'Empleado'
};
