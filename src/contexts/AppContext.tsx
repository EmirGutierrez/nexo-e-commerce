import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { products } from '../data/mockData';
import { paymentSettingsService, paymentSettingsStorageKey } from '../services';
import type { CartItem, PaymentMethod, PaymentMethodSettings, Product, Role, User } from '../types';

interface AppContextValue {
  cart: CartItem[];
  cartCount: number;
  cartTotal: number;
  addToCart: (product: CartItem | (typeof products)[number]) => void;
  updateQuantity: (id: string, quantity: number) => void;
  removeFromCart: (id: string) => void;
  user: User | null;
  userType: 'admin' | 'customer' | null;
  login: (email: string, password: string, kind: 'admin' | 'customer') => User | null;
  logout: () => void;
  role: Role | null;
  paymentMethods: PaymentMethodSettings;
  updatePaymentMethod: (method: PaymentMethod, enabled: boolean) => Promise<PaymentMethodSettings>;
  adminAlert: AdminAlert | null;
  notifyAdmin: (alert: Omit<AdminAlert, 'id'>) => void;
  dismissAdminAlert: () => void;
  reportLowStock: (products: Pick<Product, 'id' | 'name' | 'stock'>[]) => void;
}

export interface AdminAlert {
  id: number;
  dedupeKey: string;
  type: 'warning' | 'success' | 'info';
  title: string;
  entity: string;
  message: string;
  nextAction: string;
  actionTo?: string;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [userType, setUserType] = useState<'admin' | 'customer' | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodSettings>(paymentSettingsService.getCurrent);
  const [adminAlerts, setAdminAlerts] = useState<AdminAlert[]>([]);
  const seenAdminAlerts = useRef(new Set<string>());
  const notifyAdmin = useCallback((alert: Omit<AdminAlert, 'id'>) => {
    if (seenAdminAlerts.current.has(alert.dedupeKey)) return;
    seenAdminAlerts.current.add(alert.dedupeKey);
    setAdminAlerts((current) => [...current, { ...alert, id: Date.now() + current.length }]);
  }, []);
  const dismissAdminAlert = useCallback(() => setAdminAlerts((current) => current.slice(1)), []);
  const reportLowStock = useCallback((rows: Pick<Product, 'id' | 'name' | 'stock'>[]) => {
    const low = rows.filter((product) => product.stock < 10).sort((a, b) => a.id.localeCompare(b.id));
    if (!low.length) return;
    const names = low.slice(0, 4).map((product) => `${product.name} (${product.stock})`).join(', ');
    notifyAdmin({ dedupeKey: `low-stock:${low.map((product) => `${product.id}:${product.stock}`).join('|')}`, type: 'warning', title: `${low.length} producto${low.length === 1 ? '' : 's'} requieren revisión de stock`, entity: names + (low.length > 4 ? ` y ${low.length - 4} más` : ''), message: 'Hay productos con menos de 10 unidades o agotados en el inventario.', nextAction: 'Revisar existencias y planificar reposición.', actionTo: '/admin/inventory/alerts' });
  }, [notifyAdmin]);

  useEffect(() => {
    const syncPaymentSettings = (event: StorageEvent) => {
      if (event.key === paymentSettingsStorageKey) setPaymentMethods(paymentSettingsService.getCurrent());
    };
    window.addEventListener('storage', syncPaymentSettings);
    return () => window.removeEventListener('storage', syncPaymentSettings);
  }, []);

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
    userType,
    login: (email, password, kind) => {
      if (kind === 'admin' && email === 'superadmin@nexo.gt' && password === 'Admin123!') {
        const admin = { ...({ id: 'u0', name: 'María Fernanda López', email, role: 'superadmin', initials: 'MF', status: 'Activo' } as User) };
        setUser(admin); setUserType('admin'); setRole(admin.role); return admin;
      }
      if (kind === 'customer' && email && password.length >= 4 && !(email === 'superadmin@nexo.gt' && password === 'Admin123!')) {
        const customer = { id: 'c1', name: 'Valeria Castillo', email, role: 'employee', initials: 'VC', status: 'Activo' } as User;
        setUser(customer); setUserType('customer'); setRole(customer.role); return customer;
      }
      return null;
    },
    logout: () => { setUser(null); setUserType(null); setRole(null); },
    role,
    paymentMethods,
    updatePaymentMethod: async (method, enabled) => {
      const next = await paymentSettingsService.setEnabled(method, enabled);
      setPaymentMethods(next);
      return next;
    },
    adminAlert: adminAlerts[0] || null,
    notifyAdmin,
    dismissAdminAlert,
    reportLowStock,
  }), [cart, user, userType, role, paymentMethods, adminAlerts, notifyAdmin, dismissAdminAlert, reportLowStock]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp debe utilizarse dentro de AppProvider');
  return context;
}
