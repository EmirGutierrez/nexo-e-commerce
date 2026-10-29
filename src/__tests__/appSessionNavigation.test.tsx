// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { AppProvider, useApp } from '../contexts/AppContext';
import { authService, paymentSettingsService } from '../services';

const staff = { id: 'staff-1', name: 'Emir Gutierrez', email: 'emir@example.test', role: 'superadmin' as const,
  initials: 'EG', status: 'Activo' as const, permissions: ['*'] };

function RouteView({ path }: { path: string }) {
  const { user, authIssue } = useApp();
  return <main><span>{path}</span><span>{user?.name || 'Sin sesión'}</span>{authIssue && <span>{authIssue}</span>}</main>;
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
});
