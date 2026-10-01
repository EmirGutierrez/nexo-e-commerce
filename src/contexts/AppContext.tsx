import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { products } from '../data/mockData';
import { authService, paymentSettingsService, userService } from '../services';
import { roleService } from '../services/roleService';
import type { CartItem, PaymentMethod, PaymentMethodSettings, Product, Role, User } from '../types';

interface AppContextValue {
  cart: CartItem[];
  cartCount: number;
  cartTotal: number;
  addToCart: (product: CartItem | (typeof products)[number]) => void;
  updateQuantity: (id: string, quantity: number) => void;
  removeFromCart: (id: string) => void;
  clearCart: () => void;
  user: User | null;
  userType: 'admin' | 'customer' | null;
  authLoading: boolean;
  login: (email: string, password: string) => Promise<{ user: User; kind: 'admin' | 'customer' } | null>;
  registerCustomer: (name: string, email: string, password: string) => Promise<User>;
  updateProfile: (name: string) => Promise<User>;
  logout: () => Promise<void>;
  role: Role | null;
  assignRole: (userId: string, role: Role) => void;
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
  const [authLoading, setAuthLoading] = useState(true);
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
    let active = true;
    let timeout: ReturnType<typeof setTimeout>;
    const sessionCheck = Promise.race([
      authService.currentUser(),
      new Promise<null>((resolve) => { timeout = setTimeout(() => resolve(null), 8000); }),
    ]);
    sessionCheck
      .then((currentUser) => {
        if (!active || !currentUser) return;
        setUser(currentUser);
        roleService.setAuthenticatedPermissions(currentUser.role, currentUser.permissions);
        setUserType(currentUser.role === 'customer' ? 'customer' : 'admin');
        setRole(currentUser.role);
      })
      .catch(() => {
        // El frontend público sigue disponible si la API está apagada.
      })
      .finally(() => {
        clearTimeout(timeout);
        if (active) setAuthLoading(false);
      });
    return () => { active = false; clearTimeout(timeout); };
  }, []);

  useEffect(() => { paymentSettingsService.load().then(setPaymentMethods).catch(() => undefined); }, []);

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
    clearCart: () => setCart([]),
    user,
    userType,
    authLoading,
    login: async (email, password) => {
      const account = await authService.login(email, password);
      if (!account) return null;
      const kind = account.role === 'customer' ? 'customer' : 'admin';
      roleService.setAuthenticatedPermissions(account.role, account.permissions);
      setUser(account); setUserType(kind); setRole(account.role);
      return { user: account, kind };
    },
    registerCustomer: async (name, email, password) => {
      const customer = await authService.registerCustomer(name, email, password);
      roleService.setAuthenticatedPermissions(customer.role, customer.permissions);
      setUser(customer); setUserType('customer'); setRole(customer.role);
      return customer;
    },
    updateProfile: async (name) => {
      const updated = await userService.updateProfile(name);
      roleService.setAuthenticatedPermissions(updated.role, updated.permissions);
      setUser(updated);
      return updated;
    },
    logout: async () => {
      if (userType) await authService.logout();
      roleService.setAuthenticatedPermissions(null);
      setUser(null); setUserType(null); setRole(null);
    },
    role,
    assignRole: (userId, nextRole) => {
      if (userId === user?.id) {
        setRole(nextRole);
        roleService.setAuthenticatedPermissions(nextRole);
        void authService.currentUser().then((currentUser) => {
          if (currentUser) { setUser(currentUser); setRole(currentUser.role); roleService.setAuthenticatedPermissions(currentUser.role, currentUser.permissions); }
        }).catch(() => undefined);
      }
    },
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
  }), [cart, user, userType, authLoading, role, paymentMethods, adminAlerts, notifyAdmin, dismissAdminAlert, reportLowStock]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp debe utilizarse dentro de AppProvider');
  return context;
}
