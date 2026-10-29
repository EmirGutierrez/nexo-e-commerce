import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { products } from '../data/mockData';
import { authService, paymentSettingsService, userService } from '../services';
import { roleService } from '../services/roleService';
import type { CartItem, PaymentMethod, PaymentMethodSettings, Product, Role, User } from '../types';

interface AppContextValue {
  cart: CartItem[];
  cartLoaded: boolean;
  cartCount: number;
  cartTotal: number;
  addToCart: (product: CartItem | (typeof products)[number]) => void;
  updateQuantity: (id: string, quantity: number) => void;
  removeFromCart: (id: string) => void;
  clearCart: () => void;
  user: User | null;
  userType: 'admin' | 'customer' | null;
  authLoading: boolean;
  authIssue: string | null;
  retrySession: () => void;
  login: (email: string, password: string, mfaCode?: string) => Promise<{ user: User; kind: 'admin' | 'customer' } | null>;
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
  const [cartLoaded, setCartLoaded] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [userType, setUserType] = useState<'admin' | 'customer' | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authIssue, setAuthIssue] = useState<string | null>(null);
  const [sessionCheck, setSessionCheck] = useState(0);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodSettings>(paymentSettingsService.getCurrent);
  const [adminAlerts, setAdminAlerts] = useState<AdminAlert[]>([]);
  const seenAdminAlerts = useRef(new Set<string>());
  const currentLowStockKey = useRef<string | null>(null);
  const notifyAdmin = useCallback((alert: Omit<AdminAlert, 'id'>) => {
    if (seenAdminAlerts.current.has(alert.dedupeKey)) return;
    seenAdminAlerts.current.add(alert.dedupeKey);
    setAdminAlerts((current) => [...current, { ...alert, id: Date.now() + current.length }]);
  }, []);
  const dismissAdminAlert = useCallback(() => setAdminAlerts((current) => current.slice(1)), []);
  const reportLowStock = useCallback((rows: Pick<Product, 'id' | 'name' | 'stock'>[]) => {
    const low = rows.filter((product) => product.stock < 10).sort((a, b) => a.id.localeCompare(b.id));
    const previousKey = currentLowStockKey.current;
    if (!low.length) {
      if (previousKey) seenAdminAlerts.current.delete(previousKey);
      currentLowStockKey.current = null;
      return;
    }
    const dedupeKey = `low-stock:${low.map((product) => `${product.id}:${product.stock}`).join('|')}`;
    if (dedupeKey === previousKey) return;
    if (previousKey) seenAdminAlerts.current.delete(previousKey);
    currentLowStockKey.current = dedupeKey;
    const names = low.slice(0, 4).map((product) => `${product.name} (${product.stock})`).join(', ');
    notifyAdmin({ dedupeKey, type: 'warning', title: `${low.length} producto${low.length === 1 ? '' : 's'} requieren revisión de stock`, entity: names + (low.length > 4 ? ` y ${low.length - 4} más` : ''), message: 'Hay productos con menos de 10 unidades o agotados en el inventario.', nextAction: 'Revisar existencias y planificar reposición.', actionTo: '/admin/inventory/alerts' });
  }, [notifyAdmin]);

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem('nexo.cart.v1') || '[]');
      if (Array.isArray(saved)) setCart(saved.filter((item): item is CartItem =>
        item && typeof item.id === 'string' && Number.isInteger(item.quantity) && item.quantity > 0 && item.quantity <= 100));
    } catch { /* El carrito inicia vacío si los datos locales son inválidos. */ }
    setCartLoaded(true);
  }, []);
  useEffect(() => {
    if (!cartLoaded) return;
    try { window.localStorage.setItem('nexo.cart.v1', JSON.stringify(cart)); }
    catch { /* El checkout sigue disponible en la sesión actual. */ }
  }, [cart, cartLoaded]);

  useEffect(() => {
    let active = true;
    let timeout: ReturnType<typeof setTimeout>;
    setAuthLoading(true);
    setAuthIssue(null);
    timeout = setTimeout(() => {
      if (!active) return;
      setAuthIssue('La sesión aún no se pudo verificar. Revisa la conexión y vuelve a intentarlo.');
      setAuthLoading(false);
    }, 8000);
    authService.currentUser()
      .then((currentUser) => {
        if (!active) return;
        setAuthIssue(null);
        if (!currentUser) {
          setUser(null); setUserType(null); setRole(null);
          roleService.setAuthenticatedPermissions(null);
          return;
        }
        setUser(currentUser);
        roleService.setAuthenticatedPermissions(currentUser.role, currentUser.permissions);
        setUserType(currentUser.role === 'customer' ? 'customer' : 'admin');
        setRole(currentUser.role);
      })
      .catch(() => {
        if (active) setAuthIssue('No se pudo verificar la sesión. La cuenta no se cerró; intenta comprobarla de nuevo.');
      })
      .finally(() => {
        clearTimeout(timeout);
        if (active) setAuthLoading(false);
      });
    return () => { active = false; clearTimeout(timeout); };
  }, [sessionCheck]);

  useEffect(() => { paymentSettingsService.load().then(setPaymentMethods).catch(() => undefined); }, []);

  const value = useMemo<AppContextValue>(() => ({
    cart,
    cartLoaded,
    cartCount: cart.reduce((sum, item) => sum + item.quantity, 0),
    cartTotal: cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
    addToCart: (product) => setCart((current) => {
      const availableStock = Number.isSafeInteger(product.stock) && product.stock > 0 ? product.stock : 0;
      if (availableStock === 0) return current;
      const found = current.find((item) => item.id === product.id);
      if (found) return current.map((item) => item.id === product.id ? {
        ...item,
        stock: availableStock,
        quantity: Math.min(Number.isSafeInteger(item.quantity) && item.quantity > 0 ? item.quantity + 1 : 1, availableStock),
      } : item);
      return [...current, { ...product, stock: availableStock, quantity: 1 }];
    }),
    updateQuantity: (id, quantity) => setCart((current) => {
      if (!Number.isSafeInteger(quantity) || quantity < 1) return current;
      return current.map((item) => item.id === id && item.stock > 0
        ? { ...item, quantity: Math.min(quantity, item.stock) }
        : item);
    }),
    removeFromCart: (id) => setCart((current) => current.filter((item) => item.id !== id)),
    clearCart: () => setCart([]),
    user,
    userType,
    authLoading,
    authIssue,
    retrySession: () => { setAuthIssue(null); setAuthLoading(true); setSessionCheck((current) => current + 1); },
    login: async (email, password, mfaCode) => {
      const account = await authService.login(email, password, mfaCode);
      if (!account) return null;
      setAuthIssue(null);
      const kind = account.role === 'customer' ? 'customer' : 'admin';
      roleService.setAuthenticatedPermissions(account.role, account.permissions);
      setUser(account); setUserType(kind); setRole(account.role);
      return { user: account, kind };
    },
    registerCustomer: async (name, email, password) => {
      const customer = await authService.registerCustomer(name, email, password);
      setAuthIssue(null);
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
      setAuthIssue(null);
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
  }), [cart, cartLoaded, user, userType, authLoading, authIssue, role, paymentMethods, adminAlerts, notifyAdmin, dismissAdminAlert, reportLowStock, sessionCheck]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp debe utilizarse dentro de AppProvider');
  return context;
}
