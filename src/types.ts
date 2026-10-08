export type Role = 'superadmin' | 'admin' | 'sales' | 'warehouse' | 'employee' | 'customer';
export type PermissionAction = 'view' | 'create' | 'edit' | 'delete' | 'approve';
export type PermissionModule = 'dashboard' | 'products' | 'inventory' | 'orders' | 'sales' | 'customers' | 'suppliers' | 'accounting' | 'promotions' | 'settings' | 'users';
export type RolePermissions = Record<PermissionModule, PermissionAction[]>;
export type PaymentMethod = 'card' | 'transfer';
export type PaymentMethodSettings = Record<PaymentMethod, boolean>;

export interface Offer {
  id: string;
  productId: string;
  originalPrice: number;
  discountedPrice: number;
  startsAt: string;
  endsAt: string;
  status: 'Activa' | 'Pausada';
}

export interface Announcement {
  id: string;
  title: string;
  description: string;
  href: string;
  status: 'Activa' | 'Pausada';
}

export interface DiscountCode {
  id: string;
  code: string;
  discountPercent: number;
  minPurchase: number;
  maxUses: number;
  usedCount: number;
  startsAt: string;
  endsAt: string;
  status: 'Activo' | 'Pausado';
}

export interface TransferReceipt {
  id: string;
  orderId?: string;
  customer: string;
  phone?: string;
  address?: string;
  date: string;
  total: number;
  image: string;
  reference?: string;
  fileName?: string;
  submittedAt?: string;
  status: 'Pendiente' | 'Aprobada' | 'Rechazada';
}

export interface Brand {
  id: string;
  name: string;
  description?: string;
  contact?: string;
  website?: string;
  status: 'Activa' | 'Inactiva';
}

export interface Product {
  id: string;
  brandId?: string;
  name: string;
  category: string;
  price: number;
  compareAt?: number;
  cost?: number;
  location?: string;
  stock: number;
  status: 'Activo' | 'Bajo stock' | 'Agotado' | 'Inactivo';
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
  permissions?: string[];
  lastLoginAt?: string | null;
}

export interface Order {
  id: string;
  customer: string;
  date: string;
  items: number;
  itemDetails?: OrderItem[];
  total: number;
  status: 'Completado' | 'En preparación' | 'Pendiente de pago' | 'Cancelado';
  payment: 'Tarjeta' | 'Transferencia';
}

export interface OrderItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
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
  customerName?: string;
  nit?: string;
  paymentMethod: 'cash' | 'card' | 'transfer';
  paymentStatus: 'Completada' | 'Simulada' | 'Pendiente de verificación';
  amountReceived?: number;
  change?: number;
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
  supplierId?: string;
  supplier: string;
  date: string;
  items: MerchandisePurchaseItem[];
  total: number;
  status: 'Registrada' | 'Pendiente' | 'Anulada';
}

export interface Supplier {
  id: string;
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  status: 'Activo' | 'Inactivo';
  productIds: string[];
  lastOrder?: string;
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
  superadmin: 'Súper Administrador', admin: 'Administrador', sales: 'Vendedor', warehouse: 'Personal de bodega', employee: 'Empleado', customer: 'Cliente'
};
