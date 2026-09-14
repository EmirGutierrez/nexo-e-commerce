export type Role = 'superadmin' | 'admin' | 'sales' | 'warehouse' | 'employee';

export type PermissionKey =
  | 'dashboard.view'
  | 'catalog.manage'
  | 'orders.manage'
  | 'sales.manage'
  | 'inventory.manage'
  | 'customers.manage'
  | 'users.manage'
  | 'reports.view'
  | 'settings.manage';

export interface RoleDefinition {
  id: string;
  name: string;
  description: string;
  scope: string;
  users: number;
  updatedAt: string;
  permissionKeys: PermissionKey[];
  protected?: boolean;
  tone: 'navy' | 'blue' | 'lime' | 'orange' | 'purple';
}

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
  role: Role | string;
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

export type TransferReceiptStatus = 'Pendiente' | 'Aprobada' | 'Rechazada';

export interface TransferReceipt {
  id: string;
  orderId: string;
  customer: string;
  phone: string;
  address: string;
  date: string;
  amount: number;
  reference: string;
  fileName: string;
  imageDataUrl: string;
  status: TransferReceiptStatus;
  submittedAt: string;
}

export interface Activity { title: string; description: string; time: string; icon: string; tone: string }

export const roleLabels: Record<Role, string> = {
  superadmin: 'Súper Administrador', admin: 'Administrador', sales: 'Vendedor', warehouse: 'Personal de bodega', employee: 'Empleado'
};
