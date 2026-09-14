import { createContext, useContext, useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { products, roleDefinitions, users } from '../data/mockData';
import type { CartItem, PermissionKey, Product, RoleDefinition, User } from '../types';

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
  role: string;
  roles: RoleDefinition[];
  teamUsers: User[];
  setRoles: Dispatch<SetStateAction<RoleDefinition[]>>;
  setTeamUsers: Dispatch<SetStateAction<User[]>>;
  hasPermission: (permission: PermissionKey) => boolean;
  viewedProducts: Product[];
  recordProductView: (product: Product) => void;
  clearViewedProducts: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

function loadStored<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) as T : fallback;
  } catch {
    return fallback;
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [user, setUser] = useState<User | null>(() => loadStored<User | null>('nexo-current-user', null));
  const [role, setRole] = useState('superadmin');
  const [roles, setRoles] = useState<RoleDefinition[]>(() => loadStored('nexo-role-definitions', roleDefinitions));
  const [teamUsers, setTeamUsers] = useState<User[]>(() => loadStored('nexo-team-users', users));
  const [viewedProducts, setViewedProducts] = useState<Product[]>([]);

  useEffect(() => { localStorage.setItem('nexo-role-definitions', JSON.stringify(roles)); }, [roles]);
  useEffect(() => { localStorage.setItem('nexo-team-users', JSON.stringify(teamUsers)); }, [teamUsers]);
  useEffect(() => { if (user) localStorage.setItem('nexo-current-user', JSON.stringify(user)); else localStorage.removeItem('nexo-current-user'); }, [user]);

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
      if (kind === 'admin' && password === 'Admin123!') {
        const teamMember = teamUsers.find((member) => member.email === email && member.status === 'Activo');
        if (teamMember) { setUser(teamMember); setRole(teamMember.role); return true; }
      }
      if (kind === 'customer' && email && password.length >= 4) {
        const customer = { id: 'c1', name: 'Valeria Castillo', email, role: 'employee', initials: 'VC', status: 'Activo' } as User;
        setUser(customer); return true;
      }
      return false;
    },
    logout: () => setUser(null),
    role,
    roles,
    teamUsers,
    setRoles,
    setTeamUsers,
    hasPermission: (permission) => user?.role === 'superadmin' || Boolean(roles.find((item) => item.id === user?.role)?.permissionKeys.includes(permission)),
    viewedProducts,
    recordProductView: (product) => setViewedProducts((current) => [product, ...current.filter((item) => item.id !== product.id)].slice(0, 8)),
    clearViewedProducts: () => setViewedProducts([]),
  }), [cart, user, role, roles, teamUsers, viewedProducts]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp debe utilizarse dentro de AppProvider');
  return context;
}
