// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AdminSection, ProfilePage } from '../modules/app/components/NexoPages';
import { businessSettingsService } from '../services';
import { roleService } from '../services/roleService';

const app = vi.hoisted(() => ({
  role: 'superadmin',
  user: { id: 'admin-1', name: 'Emir Gutierrez', email: 'emir@nexo.gt', role: 'superadmin' },
  paymentMethods: { card: true, transfer: true },
  updatePaymentMethod: vi.fn(),
  updateProfile: vi.fn(),
}));

vi.mock('../contexts/AppContext', () => ({ useApp: () => app }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn() }), usePathname: () => '/admin/settings' }));
vi.mock('../modules/auth/components/ChangePasswordCard', () => ({ default: () => null }));
vi.mock('../modules/auth/components/MfaSettingsCard', () => ({ default: () => null }));

const settings = {
  businessName: 'NEXO Commerce',
  contactEmail: 'ventas@nexo.gt',
  phone: '55551234',
  address: 'Zona 1',
  notifications: { orders: true, stock: true },
};

beforeEach(() => {
  app.paymentMethods = { card: true, transfer: true };
  app.updatePaymentMethod.mockReset();
  app.updateProfile.mockReset();
  app.updateProfile.mockResolvedValue(undefined);
  vi.spyOn(roleService, 'can').mockReturnValue(true);
  vi.spyOn(businessSettingsService, 'load').mockResolvedValue(settings);
  vi.spyOn(businessSettingsService, 'save').mockImplementation(async (value) => value);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('validación del perfil y configuración del negocio', () => {
  it('rechaza nombres de perfil inválidos y guarda nombres internacionales válidos', async () => {
    render(<ProfilePage />);
    const name = await screen.findByLabelText('Nombre');
    fireEvent.change(name, { target: { value: '--' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar perfil' }));
    expect((await screen.findByRole('alert')).textContent).toContain('solo puede contener letras');
    expect(app.updateProfile).not.toHaveBeenCalled();

    fireEvent.change(name, { target: { value: 'María O’Neill-García' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar perfil' }));
    await waitFor(() => expect(app.updateProfile).toHaveBeenCalledWith('María O’Neill-García'));
  });

  it('valida nombre, correo y teléfono del negocio antes de guardar', async () => {
    render(<AdminSection section="settings" />);
    const businessName = await screen.findByLabelText('Nombre comercial');
    const email = screen.getByLabelText('Correo de contacto');
    const phone = screen.getByLabelText('Teléfono');
    const save = () => fireEvent.click(screen.getByRole('button', { name: 'Guardar configuración' }));

    fireEvent.change(businessName, { target: { value: '!!!' } });
    save();
    expect((await screen.findByRole('alert')).textContent).toContain('nombre comercial');
    expect(businessSettingsService.save).not.toHaveBeenCalled();

    fireEvent.change(businessName, { target: { value: 'NEXO Guatemala' } });
    fireEvent.change(email, { target: { value: 'ventas@7777' } });
    save();
    expect((await screen.findByRole('alert')).textContent).toContain('correo de contacto válido');

    fireEvent.change(email, { target: { value: 'ventas@nexo.gt' } });
    fireEvent.change(phone, { target: { value: '+1' } });
    save();
    expect((await screen.findByRole('alert')).textContent).toContain('teléfono debe contener');

    fireEvent.change(phone, { target: { value: '' } });
    save();
    await waitFor(() => expect(businessSettingsService.save).toHaveBeenCalledWith(expect.objectContaining({
      businessName: 'NEXO Guatemala', contactEmail: 'ventas@nexo.gt', phone: '',
    })));
    expect((await screen.findByRole('status')).textContent).toContain('actualizadas');
  });

  it('muestra el error si falla el guardado del método de pago', async () => {
    app.updatePaymentMethod.mockRejectedValueOnce(new Error('Debe quedar un método'));
    render(<AdminSection section="settings" />);
    fireEvent.click(await screen.findByRole('switch', { name: 'Desactivar Tarjeta simulada' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Debe quedar al menos un método de pago activo');
  });
});
