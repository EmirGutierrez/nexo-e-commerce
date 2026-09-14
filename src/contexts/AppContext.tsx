import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { products } from '../data/mockData';
import type { CartItem, Role, User } from '../types';

interface AppContextValue {
  cart: CartItem[];
  cartCount: number;
  cartTotal: number;
  addToCart: (product: CartItem | (typeof products)[number]) => void;
  updateQuantity: (id: string, quantity: number) => void;
  removeFromCart: (id: string) => void;
  user: User | null;
  login: (email: string, password: string, kind: 'admin' | 'customer') => boolean;
  logout: () => void;
  role: Role;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role>('superadmin');

  const value = useMemo<AppContextValue>(() => ({
    cart,
    cartCount: cart.reduce((sum, item) => sum + item.quantity, 0),
    cartTotal: cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
    addToCart: (product) => setCart((current) => {
      const found = current.find((item) => item.id === product.id);
      if (found) return current.map((item) => item.id === product.id ? { ...item, quantity: Math.min(item.quantity + 1, product.stock) } : item);
      return [...current, { ...product, quantity: 1 }];
    }),
    updateQuantity: (id, quantity) => setCart((current) => current.map((item) => item.id === id ? { ...item, quantity: Math.max(1, Math.min(quantity, item.stock)) } : item)),
    removeFromCart: (id) => setCart((current) => current.filter((item) => item.id !== id)),
    user,
    login: (email, password, kind) => {
      if (kind === 'admin' && email === 'superadmin@nexo.gt' && password === 'Admin123!') {
        const admin = { ...({ id: 'u0', name: 'María Fernanda López', email, role: 'superadmin', initials: 'MF', status: 'Activo' } as User) };
        setUser(admin); setRole('superadmin'); return true;
      }
      if (kind === 'customer' && email && password.length >= 4) {
        const customer = { id: 'c1', name: 'Valeria Castillo', email, role: 'employee', initials: 'VC', status: 'Activo' } as User;
        setUser(customer); return true;
      }
      return false;
    },
    logout: () => setUser(null),
    role,
  }), [cart, user, role]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp debe utilizarse dentro de AppProvider');
  return context;
}
