// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AppProvider, useApp } from '../contexts/AppContext';
import { authService, paymentSettingsService } from '../services';
import { MFA_ENROLLMENT_REQUIRED_EVENT, MFA_REAUTHENTICATION_REQUIRED_EVENT } from '../shared/services/http-client';

const staff = { id: 'staff-1', name: 'Emir Gutierrez', email: 'emir@example.test', role: 'superadmin' as const,
  initials: 'EG', status: 'Activo' as const, permissions: ['*'] };

function RouteView({ path }: { path: string }) {
  const { user, authIssue } = useApp();
  return <main><span>{path}</span><span>{user?.name || 'Sin sesión'}</span>{authIssue && <span>{authIssue}</span>}</main>;
}

function MfaSessionControls() {
  const { user, userType, login, refreshCurrentUser, logout } = useApp();
  const session = !user ? 'none' : `${user.role}:${user.mfaSetupRequired ? 'required' : 'ready'}:${userType}`;
  return <main>
    <span data-testid="mfa-session">{session}</span>
    <button type="button" onClick={() => void refreshCurrentUser()}>Actualizar sesión</button>
    <button type="button" onClick={() => void login('staff@example.test', 'password')}>Iniciar sesión</button>
    <button type="button" onClick={() => void logout()}>Cerrar sesión</button>
  </main>;
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('restauración de sesión durante navegación pública y privada', () => {
  it('conserva usuario y permisos al navegar Dashboard → /store → Dashboard bajo el proveedor raíz', async () => {
    const currentUser = vi.spyOn(authService, 'currentUser').mockResolvedValue(staff);
    vi.spyOn(paymentSettingsService, 'load').mockResolvedValue({ card: true, transfer: true });
    const view = render(<AppProvider><RouteView path="/admin/dashboard" /></AppProvider>);

    expect(await screen.findByText('Emir Gutierrez')).toBeTruthy();
    view.rerender(<AppProvider><RouteView path="/store" /></AppProvider>);
    expect(screen.getByText('/store')).toBeTruthy();
    expect(screen.getByText('Emir Gutierrez')).toBeTruthy();

    view.rerender(<AppProvider><RouteView path="/admin/dashboard" /></AppProvider>);
    expect(screen.getByText('Emir Gutierrez')).toBeTruthy();
    expect(currentUser).toHaveBeenCalledOnce();
  });

  it('no interpreta un timeout temporal como cierre de sesión y acepta la respuesta tardía de Spring', async () => {
    vi.useFakeTimers();
    let resolveSession!: (user: typeof staff) => void;
    vi.spyOn(authService, 'currentUser').mockReturnValue(new Promise((resolve) => { resolveSession = resolve; }));
    vi.spyOn(paymentSettingsService, 'load').mockResolvedValue({ card: true, transfer: true });
    render(<AppProvider><RouteView path="/admin/dashboard" /></AppProvider>);

    await act(async () => { await vi.advanceTimersByTimeAsync(8000); });
    expect(screen.getByText(/La sesión aún no se pudo verificar/)).toBeTruthy();
    await act(async () => { resolveSession(staff); });
    expect(screen.getByText('Emir Gutierrez')).toBeTruthy();
    expect(screen.queryByText(/La sesión aún no se pudo verificar/)).toBeNull();
  });

  it('marca la sesión cuando el backend exige enrolar MFA', async () => {
    vi.spyOn(authService, 'currentUser').mockResolvedValue(staff);
    vi.spyOn(paymentSettingsService, 'load').mockResolvedValue({ card: true, transfer: true });
    render(<AppProvider><MfaSessionControls /></AppProvider>);

    expect((await screen.findByTestId('mfa-session')).textContent).toBe('superadmin:ready:admin');
    act(() => window.dispatchEvent(new Event(MFA_ENROLLMENT_REQUIRED_EVENT)));

    expect(screen.getByTestId('mfa-session').textContent).toBe('superadmin:required:admin');
  });

  it('limpia la sesión y cierra sesión en Spring una sola vez al requerir MFA de nuevo', async () => {
    vi.spyOn(authService, 'currentUser').mockResolvedValue(staff);
    const logout = vi.spyOn(authService, 'logout').mockResolvedValue();
    vi.spyOn(paymentSettingsService, 'load').mockResolvedValue({ card: true, transfer: true });
    render(<AppProvider><MfaSessionControls /></AppProvider>);
    expect((await screen.findByTestId('mfa-session')).textContent).toBe('superadmin:ready:admin');

    await act(async () => {
      window.dispatchEvent(new Event(MFA_REAUTHENTICATION_REQUIRED_EVENT));
      window.dispatchEvent(new Event(MFA_REAUTHENTICATION_REQUIRED_EVENT));
      await Promise.resolve();
    });

    await waitFor(() => expect(screen.getByTestId('mfa-session').textContent).toBe('none'));
    expect(logout).toHaveBeenCalledOnce();
  });

  it('actualiza el contexto tanto al encontrar como al no encontrar una sesión', async () => {
    vi.spyOn(authService, 'currentUser')
      .mockResolvedValueOnce(staff)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ ...staff, mfaSetupRequired: true });
    vi.spyOn(paymentSettingsService, 'load').mockResolvedValue({ card: true, transfer: true });
    render(<AppProvider><MfaSessionControls /></AppProvider>);
    expect((await screen.findByTestId('mfa-session')).textContent).toBe('superadmin:ready:admin');

    fireEvent.click(screen.getByRole('button', { name: 'Actualizar sesión' }));
    await waitFor(() => expect(screen.getByTestId('mfa-session').textContent).toBe('none'));
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar sesión' }));
    await waitFor(() => expect(screen.getByTestId('mfa-session').textContent).toBe('superadmin:required:admin'));
  });

  it('actualiza el estado del proveedor al iniciar sesión y permite cerrar sesión explícitamente', async () => {
    vi.spyOn(authService, 'currentUser').mockResolvedValue(null);
    const login = vi.spyOn(authService, 'login').mockResolvedValue({ ...staff, mfaSetupRequired: true });
    const logout = vi.spyOn(authService, 'logout').mockResolvedValue();
    vi.spyOn(paymentSettingsService, 'load').mockResolvedValue({ card: true, transfer: true });
    render(<AppProvider><MfaSessionControls /></AppProvider>);
    expect((await screen.findByTestId('mfa-session')).textContent).toBe('none');

    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
    await waitFor(() => expect(screen.getByTestId('mfa-session').textContent).toBe('superadmin:required:admin'));
    expect(login).toHaveBeenCalledWith('staff@example.test', 'password', undefined);

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    await waitFor(() => expect(screen.getByTestId('mfa-session').textContent).toBe('none'));
    expect(logout).toHaveBeenCalledOnce();
  });
});
