// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AdminWorkspace, ProfilePage } from '../modules/app/components/NexoPages';
import { roleService } from '../services/roleService';

const route = vi.hoisted(() => ({ pathname: '/admin/support', push: vi.fn(), replace: vi.fn() }));
const app = vi.hoisted(() => ({
  user: { id: 'user-1', name: 'Emir Gutierrez', email: 'emir@example.test', role: 'superadmin', initials: 'EG', status: 'Activo', permissions: ['*'] },
  userType: 'admin',
  role: 'superadmin',
  authLoading: false,
  adminAlert: { title: 'Stock bajo', message: 'Un producto necesita reposición.', actionTo: '/admin/inventory' },
  dismissAdminAlert: vi.fn(),
  logout: vi.fn(async () => undefined),
  updateProfile: vi.fn(async () => undefined),
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
  app.user = { id: 'user-1', name: 'Emir Gutierrez', email: 'emir@example.test', role: 'superadmin', initials: 'EG', status: 'Activo', permissions: ['*'] };
  app.dismissAdminAlert.mockClear();
  app.updateProfile.mockClear();
  vi.spyOn(roleService, 'can').mockReturnValue(true);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('navegación privada y perfil', () => {
  it('abre el menú de perfil y notificaciones, y enlaza al soporte', async () => {
    render(<AdminWorkspace><div>Contenido del panel</div></AdminWorkspace>);
    expect(await screen.findByText('Contenido del panel')).toBeTruthy();
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

  it('muestra el error de perfil cuando falla el guardado', async () => {
    app.updateProfile.mockRejectedValueOnce(new Error('El perfil no está disponible'));
    render(<ProfilePage />);
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Nuevo Nombre' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar perfil' }));

    expect((await screen.findByRole('alert')).textContent).toContain('El perfil no está disponible');
  });
});
