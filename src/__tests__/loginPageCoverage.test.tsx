// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Access, AdminLogin, CustomerLogin } from '../modules/app/components/NexoPages';
import { ApiError } from '../shared/services/http-client';

const app = vi.hoisted(() => ({
  login: vi.fn(),
  user: null as null | { id: string; role: string; permissions?: string[] },
  userType: null as null | 'admin' | 'customer',
  role: null as null | string,
  authLoading: false,
}));
const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));

vi.mock('../contexts/AppContext', () => ({ useApp: () => app }));
vi.mock('next/navigation', () => ({
  useRouter: () => router,
  usePathname: () => '/access',
  useParams: () => ({}),
}));
vi.mock('../modules/auth/components/ChangePasswordCard', () => ({ default: () => null }));
vi.mock('../modules/auth/components/MfaSettingsCard', () => ({ default: () => null }));

beforeEach(() => {
  app.login.mockReset();
  app.user = null;
  app.userType = null;
  app.role = null;
  app.authLoading = false;
  router.push.mockReset();
  router.replace.mockReset();
  window.history.replaceState({}, '', '/access');
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function fillLogin(email = 'ana@example.test') {
  fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'ContraseñaSegura123!' } });
}

function submitLogin() {
  const form = screen.getByRole('button', { name: /Ingresar/ }).closest('form');
  if (!form) throw new Error('No se encontró el formulario de acceso.');
  fireEvent.submit(form);
}

describe('acceso público y administrativo', () => {
  it('muestra el estado de comprobación mientras restaura la sesión', () => {
    app.authLoading = true;
    render(<Access />);
    expect(screen.getByRole('status').textContent).toContain('Comprobando acceso');
  });

  it('redirige la cuenta ya activa al destino autorizado', async () => {
    app.user = { id: 'staff-1', role: 'sales' };
    app.userType = 'admin';
    app.role = 'sales';
    window.history.replaceState({}, '', '/access?redirect=%2Fadmin%2Fsales');
    render(<Access />);
    expect(screen.getByRole('status').textContent).toContain('Comprobando acceso');
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/admin/sales'));
  });

  it('conserva un reto MFA, permite ingresar el código y accede con éxito', async () => {
    app.login.mockRejectedValueOnce(new ApiError('Ingresa el código de autenticación.', 401, 'MFA_REQUIRED'))
      .mockResolvedValueOnce({ kind: 'admin', user: { role: 'sales', permissions: ['sales:view'] } });
    render(<AdminLogin />);
    fillLogin();
    submitLogin();

    expect((await screen.findByRole('alert')).textContent).toContain('Ingresa el código de autenticación');
    const code = screen.getByLabelText('Código de autenticación o recuperación');
    fireEvent.change(code, { target: { value: '123456' } });
    submitLogin();

    await waitFor(() => expect(app.login).toHaveBeenLastCalledWith('ana@example.test', 'ContraseñaSegura123!', '123456'));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/admin/sales'));
  });

  it('limpia el código MFA inválido y el mensaje al corregir el correo', async () => {
    app.login.mockRejectedValue(new ApiError('Código incorrecto.', 401, 'MFA_INVALID'));
    render(<Access />);
    fillLogin();
    submitLogin();
    expect((await screen.findByRole('alert')).textContent).toContain('Código incorrecto');
    const code = screen.getByLabelText('Código de autenticación o recuperación') as HTMLInputElement;
    expect(code.value).toBe('');
    fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: 'otra@example.test' } });
    expect(screen.queryByLabelText('Código de autenticación o recuperación')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('muestra el error de credenciales, errores de disponibilidad y mensajes de respaldo', async () => {
    app.login.mockResolvedValueOnce(null);
    render(<CustomerLogin />);
    fillLogin();
    submitLogin();
    expect((await screen.findByRole('alert')).textContent).toContain('Correo o contraseña incorrectos');

    app.login.mockRejectedValueOnce(new ApiError('Temporal', 503));
    submitLogin();
    expect((await screen.findByRole('alert')).textContent).toContain('no está disponible');

    app.login.mockRejectedValueOnce({ reason: 'sin respuesta' });
    submitLogin();
    expect((await screen.findByRole('alert')).textContent).toContain('No fue posible iniciar sesión');
  });
});
