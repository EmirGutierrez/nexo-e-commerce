// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AdminSection, AdminWorkspace, ProfilePage, RegisterPage } from '../modules/app/components/NexoPages';
import { roleService } from '../services/roleService';
import { dashboardService, productInventoryService } from '../services';

const route = vi.hoisted(() => ({ pathname: '/admin/support', push: vi.fn(), replace: vi.fn() }));
const app = vi.hoisted(() => ({
  user: { id: 'user-1', name: 'Emir Gutierrez', email: 'emir@example.test', role: 'superadmin', initials: 'EG', status: 'Activo', permissions: ['*'] },
  userType: 'admin',
  role: 'superadmin',
  authLoading: false,
  authIssue: null as string | null,
  retrySession: vi.fn(),
  adminAlert: { title: 'Stock bajo', message: 'Un producto necesita reposición.', actionTo: '/admin/inventory' },
  dismissAdminAlert: vi.fn(),
  logout: vi.fn(async () => undefined),
  updateProfile: vi.fn(async () => undefined),
  registerCustomer: vi.fn(async () => undefined),
  reportLowStock: vi.fn(),
}));

vi.mock('../contexts/AppContext', () => ({ useApp: () => app }));
vi.mock('next/navigation', () => ({
  usePathname: () => route.pathname,
  useRouter: () => ({ push: route.push, replace: route.replace }),
  useParams: () => ({}),
}));
vi.mock('../modules/auth/components/ChangePasswordCard', () => ({ default: () => null }));
vi.mock('../modules/auth/components/MfaSettingsCard', () => ({ default: () => null }));

beforeEach(() => {
  route.pathname = '/admin/support';
  route.push.mockClear();
  route.replace.mockClear();
  app.userType = 'admin';
  app.role = 'superadmin';
  app.authIssue = null;
  app.retrySession.mockClear();
  app.user = { id: 'user-1', name: 'Emir Gutierrez', email: 'emir@example.test', role: 'superadmin', initials: 'EG', status: 'Activo', permissions: ['*'] };
  app.dismissAdminAlert.mockClear();
  app.updateProfile.mockClear();
  app.registerCustomer.mockClear();
  app.reportLowStock.mockClear();
  vi.spyOn(roleService, 'can').mockReturnValue(true);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('navegación privada y perfil', () => {
  it('abre el menú de perfil y notificaciones, y enlaza al soporte', async () => {
    render(<AdminWorkspace><div>Contenido del panel</div></AdminWorkspace>);
    expect(await screen.findByText('Contenido del panel')).toBeTruthy();
    const workspaceSelector = screen.getByText('NEXO Commerce').closest('.workspace-selector');
    expect(workspaceSelector?.querySelector('svg')).toBeNull();
    expect(workspaceSelector?.querySelector('button')).toBeNull();
    expect(screen.getByRole('link', { name: /Ir al centro/ }).getAttribute('href')).toBe('/admin/support');

    fireEvent.click(screen.getByRole('button', { name: /Emir Gutierrez/ }));
    expect(screen.getByRole('menu').textContent).toContain('Mi perfil');
    fireEvent.click(screen.getByRole('button', { name: 'Notificaciones' }));
    expect(screen.getByText('Stock bajo')).toBeTruthy();
    expect(screen.getByText('Un producto necesita reposición.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Descartar' }));
    expect(app.dismissAdminAlert).toHaveBeenCalledOnce();
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByText('Notificaciones')).toBeNull());
  });

  it('muestra Ofertas y anuncios al vendedor cuando su sesión tiene promotions:view', async () => {
    app.role = 'sales';
    app.user = { ...app.user, role: 'sales', permissions: ['dashboard:view', 'promotions:view'] };

    render(<AdminWorkspace><div>Panel del vendedor</div></AdminWorkspace>);

    expect(await screen.findByRole('link', { name: 'Ofertas y anuncios' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Catálogo' })).toBeNull();
  });

  it('redirige al módulo de ofertas si es el único módulo visible para el vendedor', async () => {
    app.role = 'sales';
    app.user = { ...app.user, role: 'sales', permissions: ['promotions:view'] };
    route.pathname = '/admin/sales';

    render(<AdminWorkspace><div>Contenido restringido</div></AdminWorkspace>);

    await waitFor(() => expect(route.replace).toHaveBeenCalledWith('/admin/offers'));
  });

  it('no muestra ofertas con permiso create sin view y bloquea la ruta directa', async () => {
    app.role = 'sales';
    app.user = { ...app.user, role: 'sales', permissions: ['dashboard:view', 'promotions:create'] };
    route.pathname = '/admin/offers';

    render(<AdminWorkspace><div>Contenido restringido</div></AdminWorkspace>);

    expect(await screen.findByRole('status')).toBeTruthy();
    await waitFor(() => expect(route.replace).toHaveBeenCalledWith('/admin/dashboard'));
    expect(screen.queryByText('Contenido restringido')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Ofertas y anuncios' })).toBeNull();
  });

  it('rechaza el soporte privado para clientes y permite guardar el nombre del perfil', async () => {
    app.userType = 'customer';
    app.role = 'customer';
    app.user = { ...app.user, role: 'customer' };
    render(<AdminWorkspace><div>Contenido restringido</div></AdminWorkspace>);
    expect((await screen.findByRole('status')).textContent).toContain('Comprobando acceso');
    await waitFor(() => expect(route.replace).toHaveBeenCalledWith('/store'));
    expect(screen.queryByText('Contenido restringido')).toBeNull();

    cleanup();
    app.userType = 'admin';
    app.role = 'superadmin';
    app.user = { ...app.user, role: 'superadmin' };
    render(<ProfilePage />);
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Emir Gutiérrez' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar perfil' }));
    await waitFor(() => expect(app.updateProfile).toHaveBeenCalledWith('Emir Gutiérrez'));
    expect((await screen.findByRole('status')).textContent).toContain('Tu nombre se guardó correctamente');
  });

  it('rechaza etiquetas HTML en el nombre del registro antes de llamar al servicio', async () => {
    app.user = null as unknown as typeof app.user;
    app.userType = null as unknown as string;
    render(<RegisterPage />);
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: '<img src=x onerror=alert(1)>' } });
    fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: 'ana@example.test' } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'LongEnoughPassword123!' } });
    fireEvent.change(screen.getByLabelText('Confirmar contraseña'), { target: { value: 'LongEnoughPassword123!' } });
    fireEvent.click(screen.getByRole('button', { name: /Crear cuenta/ }));

    expect((await screen.findByRole('alert')).textContent).toContain('solo puede contener letras');
    expect(app.registerCustomer).not.toHaveBeenCalled();
  });

  it('redirige una ruta privada no permitida al primer módulo autorizado', async () => {
    app.userType = 'admin';
    app.role = 'employee';
    app.user = { ...app.user, role: 'employee', permissions: ['settings:view'] };
    route.pathname = '/admin/products';

    render(<AdminWorkspace><div>Contenido que no debe mostrarse</div></AdminWorkspace>);

    expect(await screen.findByRole('status')).toBeTruthy();
    await waitFor(() => expect(route.replace).toHaveBeenCalledWith('/admin/settings'));
    expect(screen.queryByText('Contenido que no debe mostrarse')).toBeNull();
  });

  it('envía a iniciar sesión cuando no hay una sesión activa', async () => {
    app.user = null as unknown as typeof app.user;
    app.userType = null as unknown as string;

    render(<AdminWorkspace><div>Panel privado</div></AdminWorkspace>);

    await waitFor(() => expect(route.replace).toHaveBeenCalledWith('/access?redirect=%2Fadmin%2Fsupport'));
    expect(screen.queryByText('Panel privado')).toBeNull();
  });

  it('no redirige al login cuando la comprobación falla y permite reintentar', async () => {
    app.user = null as unknown as typeof app.user;
    app.userType = null as unknown as string;
    app.authIssue = 'No se pudo verificar la sesión.';

    render(<AdminWorkspace><div>Panel privado</div></AdminWorkspace>);

    expect((await screen.findByRole('alert')).textContent).toContain('No se pudo verificar la sesión.');
    expect(route.replace).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(app.retrySession).toHaveBeenCalledOnce();
  });

  it('actualiza el saludo mientras el Dashboard permanece abierto', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-28T17:59:30.000Z'));
    vi.spyOn(dashboardService, 'summary').mockResolvedValue({
      sales: 0, orders: 0, newCustomers: 0, averageTicket: 0,
      products: { products: 0, totalUnits: 0, lowStock: 0, outOfStock: 0 },
      series: [], recentActivity: [],
    });
    vi.spyOn(productInventoryService, 'list').mockResolvedValue([]);

    render(<AdminSection section="dashboard" />);

    expect(screen.getByRole('heading', { name: /Buenos días, Emir/ })).toBeTruthy();
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(screen.getByRole('heading', { name: /Buenas tardes, Emir/ })).toBeTruthy();
  });

  it('muestra el error de perfil cuando falla el guardado', async () => {
    app.updateProfile.mockRejectedValueOnce(new Error('El perfil no está disponible'));
    render(<ProfilePage />);
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Nuevo Nombre' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar perfil' }));

    expect((await screen.findByRole('alert')).textContent).toContain('El perfil no está disponible');
  });
});
