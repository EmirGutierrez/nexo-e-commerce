// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';

const auth = vi.hoisted(() => ({ changePassword: vi.fn() }));
vi.mock('../services', () => ({ authService: auth }));

import ChangePasswordCard from '../modules/auth/components/ChangePasswordCard';

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  auth.changePassword.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('ChangePasswordCard', () => {
  it('shows and hides each password independently', () => {
    render(<ChangePasswordCard />);
    const currentPassword = screen.getByLabelText('Contraseña actual') as HTMLInputElement;
    const newPassword = screen.getByLabelText('Nueva contraseña') as HTMLInputElement;
    const confirmation = screen.getByLabelText('Confirmar nueva contraseña') as HTMLInputElement;

    expect(currentPassword.type).toBe('password');
    expect(newPassword.type).toBe('password');
    expect(confirmation.type).toBe('password');

    fireEvent.click(screen.getByRole('button', { name: 'Mostrar contraseña actual' }));
    expect(currentPassword.type).toBe('text');
    expect(newPassword.type).toBe('password');
    expect(confirmation.type).toBe('password');

    fireEvent.click(screen.getByRole('button', { name: 'Mostrar nueva contraseña' }));
    expect(currentPassword.type).toBe('text');
    expect(newPassword.type).toBe('text');

    fireEvent.click(screen.getByRole('button', { name: 'Ocultar contraseña actual' }));
    expect(currentPassword.type).toBe('password');
    expect(newPassword.type).toBe('text');
  });

  it('blocks mismatched confirmation before sending the password', async () => {
    render(<ChangePasswordCard />);
    fireEvent.change(screen.getByLabelText('Contraseña actual'), { target: { value: 'current-password' } });
    fireEvent.change(screen.getByLabelText(/^Nueva contraseña/), { target: { value: 'a-long-new-password' } });
    fireEvent.change(screen.getByLabelText('Confirmar nueva contraseña'), { target: { value: 'another-password' } });

    await act(async () => {
      fireEvent.submit(screen.getByRole('button', { name: 'Actualizar contraseña' }).closest('form')!);
    });

    expect(screen.getByRole('alert').textContent).toContain('no coinciden');
    expect(auth.changePassword).not.toHaveBeenCalled();
  });

  it('submits the current password, new password, and a trimmed MFA code', async () => {
    render(<ChangePasswordCard />);
    fireEvent.change(screen.getByLabelText('Contraseña actual'), { target: { value: 'current-password' } });
    fireEvent.change(screen.getByLabelText(/^Nueva contraseña/), { target: { value: 'a-long-new-password' } });
    fireEvent.change(screen.getByLabelText('Confirmar nueva contraseña'), { target: { value: 'a-long-new-password' } });
    fireEvent.change(screen.getByLabelText('Código MFA o de recuperación, si está activada'), { target: { value: ' 123456 ' } });

    await act(async () => {
      fireEvent.submit(screen.getByRole('button', { name: 'Actualizar contraseña' }).closest('form')!);
      await Promise.resolve();
    });

    expect(auth.changePassword).toHaveBeenCalledWith('current-password', 'a-long-new-password', '123456');
    expect(screen.getByRole('status').textContent).toContain('Contraseña actualizada');
  });

  it('displays API errors without losing the entered values', async () => {
    auth.changePassword.mockRejectedValueOnce(new Error('La contraseña actual no es correcta.'));
    render(<ChangePasswordCard />);
    fireEvent.change(screen.getByLabelText('Contraseña actual'), { target: { value: 'wrong-password' } });
    fireEvent.change(screen.getByLabelText(/^Nueva contraseña/), { target: { value: 'a-long-new-password' } });
    fireEvent.change(screen.getByLabelText('Confirmar nueva contraseña'), { target: { value: 'a-long-new-password' } });

    await act(async () => {
      fireEvent.submit(screen.getByRole('button', { name: 'Actualizar contraseña' }).closest('form')!);
      await Promise.resolve();
    });

    expect(screen.getByRole('alert').textContent).toContain('no es correcta');
    expect(screen.getByLabelText('Contraseña actual')).toHaveProperty('value', 'wrong-password');
  });
});
