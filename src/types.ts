export type Role = 'superadmin' | 'admin' | 'sales' | 'warehouse' | 'employee';

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

export interface Activity { title: string; description: string; time: string; icon: string; tone: string }

export const roleLabels: Record<Role, string> = {
  superadmin: 'Súper Administrador', admin: 'Administrador', sales: 'Vendedor', warehouse: 'Personal de bodega', employee: 'Empleado'
};
