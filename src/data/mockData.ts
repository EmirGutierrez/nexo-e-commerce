import type { Activity, Order, Product, RoleDefinition, User } from '../types';

export const products: Product[] = [
  { id: 'p1', name: 'Auriculares Wave Pro', category: 'Tecnología', price: 649, compareAt: 799, stock: 24, status: 'Activo', sku: 'TEC-WAV-001', featured: true, image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=85', description: 'Sonido envolvente, cancelación activa de ruido y hasta 36 horas de batería para acompañarte en todo momento.' },
  { id: 'p2', name: 'Lámpara Aura Mini', category: 'Hogar', price: 389, stock: 18, status: 'Activo', sku: 'HOG-AUR-002', featured: true, image: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=900&q=85', description: 'Iluminación cálida regulable con un diseño minimalista que transforma cualquier rincón.' },
  { id: 'p3', name: 'Mochila Terra Daily', category: 'Accesorios', price: 475, compareAt: 550, stock: 9, status: 'Bajo stock', sku: 'ACC-TER-003', featured: true, image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=900&q=85', description: 'Mochila urbana resistente al agua, con compartimento acolchado para laptop de hasta 16 pulgadas.' },
  { id: 'p4', name: 'Cafetera Moka One', category: 'Hogar', price: 820, stock: 6, status: 'Bajo stock', sku: 'HOG-MOK-004', image: 'https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?auto=format&fit=crop&w=900&q=85', description: 'Café intenso y aromático preparado en casa con un acabado de acero inoxidable.' },
  { id: 'p5', name: 'Teclado Orbit 75', category: 'Tecnología', price: 895, stock: 31, status: 'Activo', sku: 'TEC-ORB-005', image: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=900&q=85', description: 'Teclado mecánico compacto con switches silenciosos, retroiluminación y conexión inalámbrica.' },
  { id: 'p6', name: 'Botella Noma 750ml', category: 'Bienestar', price: 215, stock: 0, status: 'Agotado', sku: 'BIE-NOM-006', image: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=900&q=85', description: 'Botella reutilizable de acero inoxidable que conserva la temperatura por horas.' },
  { id: 'p7', name: 'Vela Senda Citrus', category: 'Hogar', price: 185, stock: 14, status: 'Activo', sku: 'HOG-SEN-007', image: 'https://images.unsplash.com/photo-1603006905003-be475563bc59?auto=format&fit=crop&w=900&q=85', description: 'Aroma fresco de bergamota y cedro con cera vegetal y 40 horas de duración.' },
  { id: 'p8', name: 'Smartwatch Pulse', category: 'Tecnología', price: 1240, compareAt: 1490, stock: 12, status: 'Activo', sku: 'TEC-PUL-008', image: 'https://images.unsplash.com/photo-1546868871-7041f2a55e12?auto=format&fit=crop&w=900&q=85', description: 'Monitorea tu actividad, sueño y notificaciones en una pantalla brillante y ligera.' },
];

export const categories = ['Todos', 'Tecnología', 'Hogar', 'Accesorios', 'Bienestar'];

export const users: User[] = [
  { id: 'u1', name: 'María Fernanda López', email: 'maria@nexo.gt', role: 'superadmin', initials: 'ML', status: 'Activo' },
  { id: 'u2', name: 'Carlos Méndez', email: 'carlos@nexo.gt', role: 'admin', initials: 'CM', status: 'Activo' },
  { id: 'u3', name: 'Ana Sofía Ruiz', email: 'ana@nexo.gt', role: 'sales', initials: 'AR', status: 'Activo' },
  { id: 'u4', name: 'Diego Morales', email: 'diego@nexo.gt', role: 'warehouse', initials: 'DM', status: 'Activo' },
  { id: 'u5', name: 'Laura García', email: 'laura@nexo.gt', role: 'employee', initials: 'LG', status: 'Pendiente' },
];

export const roleDefinitions: RoleDefinition[] = [
  {
    id: 'superadmin',
    name: 'Súper usuario',
    description: 'Dueño de la cuenta y responsable de toda la operación.',
    scope: 'Acceso completo',
    users: 1,
    updatedAt: 'Hoy, 09:42',
    permissionKeys: ['dashboard.view', 'catalog.manage', 'orders.manage', 'sales.manage', 'inventory.manage', 'customers.manage', 'users.manage', 'reports.view', 'settings.manage'],
    protected: true,
    tone: 'navy',
  },
  {
    id: 'admin',
    name: 'Administrador',
    description: 'Gestiona la operación diaria sin modificar el dueño de la cuenta.',
    scope: 'Operación completa',
    users: 1,
    updatedAt: '12 sep 2025',
    permissionKeys: ['dashboard.view', 'catalog.manage', 'orders.manage', 'sales.manage', 'inventory.manage', 'customers.manage', 'reports.view'],
    tone: 'blue',
  },
  {
    id: 'sales',
    name: 'Vendedor',
    description: 'Atiende pedidos, ventas y clientes desde el panel.',
    scope: 'Ventas y clientes',
    users: 2,
    updatedAt: '08 sep 2025',
    permissionKeys: ['dashboard.view', 'orders.manage', 'sales.manage', 'customers.manage'],
    tone: 'purple',
  },
  {
    id: 'warehouse',
    name: 'Personal de bodega',
    description: 'Controla existencias y movimientos de inventario.',
    scope: 'Inventario',
    users: 2,
    updatedAt: '08 sep 2025',
    permissionKeys: ['dashboard.view', 'inventory.manage'],
    tone: 'orange',
  },
  {
    id: 'employee',
    name: 'Empleado',
    description: 'Acceso limitado para apoyar tareas operativas.',
    scope: 'Acceso limitado',
    users: 2,
    updatedAt: '05 sep 2025',
    permissionKeys: ['dashboard.view', 'orders.manage'],
    tone: 'lime',
  },
];

export const orders: Order[] = [
  { id: '#NX-1048', customer: 'Valeria Castillo', date: 'Hoy, 10:42', items: 3, total: 1_284, status: 'Completado', payment: 'Tarjeta' },
  { id: '#NX-1047', customer: 'Alejandro Pérez', date: 'Hoy, 09:18', items: 1, total: 895, status: 'En preparación', payment: 'Transferencia' },
  { id: '#NX-1046', customer: 'Sofía Rodríguez', date: 'Ayer, 16:30', items: 2, total: 1_035, status: 'Pendiente de pago', payment: 'Transferencia' },
  { id: '#NX-1045', customer: 'Mateo Estrada', date: 'Ayer, 14:02', items: 4, total: 2_160, status: 'Completado', payment: 'Tarjeta' },
  { id: '#NX-1044', customer: 'Camila Díaz', date: '12 sep, 11:20', items: 1, total: 215, status: 'Cancelado', payment: 'Tarjeta' },
];

export const activities: Activity[] = [
  { title: 'Nueva transferencia recibida', description: 'Pedido #NX-1047 · Q 895.00', time: 'Hace 18 min', icon: 'arrow', tone: 'blue' },
  { title: 'Stock actualizado', description: 'Auriculares Wave Pro · +12 unidades', time: 'Hace 42 min', icon: 'box', tone: 'green' },
  { title: 'Nuevo cliente registrado', description: 'Valeria Castillo', time: 'Hace 1 h', icon: 'user', tone: 'purple' },
  { title: 'Pedido completado', description: 'Pedido #NX-1045 · Mateo Estrada', time: 'Hace 2 h', icon: 'check', tone: 'orange' },
];

export const formatQ = (value: number) => `Q ${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
