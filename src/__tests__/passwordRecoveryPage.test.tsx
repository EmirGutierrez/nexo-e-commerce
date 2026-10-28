// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

const passwordRecoveryMocks = vi.hoisted(() => ({
  requestPasswordReset: vi.fn(),
  completePasswordReset: vi.fn(),
}));

vi.mock('../services', () => ({
  authService: passwordRecoveryMocks,
}));

import PasswordRecoveryPage from '../modules/auth/components/PasswordRecoveryPage';

describe('password recovery page', () => {
  beforeEach(() => {
    passwordRecoveryMocks.requestPasswordReset.mockReset().mockResolvedValue(undefined);
    passwordRecoveryMocks.completePasswordReset.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => cleanup());

  it('shows the same confirmation after requesting recovery for an email', async () => {
    render(<PasswordRecoveryPage token={null} />);
    fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: 'persona@example.test' } });
    fireEvent.click(screen.getByRole('button', { name: /enviar enlace/i }));

    expect((await screen.findByRole('status')).textContent).toContain('Si existe una cuenta con ese correo');
    expect(passwordRecoveryMocks.requestPasswordReset).toHaveBeenCalledWith('persona@example.test');
  });

  it('completes recovery and confirms when both passwords match', async () => {
    render(<PasswordRecoveryPage token="single-use-token" />);
    fireEvent.change(screen.getByLabelText('Nueva contraseña'), { target: { value: 'a-new-secure-password' } });
    fireEvent.change(screen.getByLabelText('Confirmar nueva contraseña'), { target: { value: 'a-new-secure-password' } });
    fireEvent.click(screen.getByRole('button', { name: /actualizar contraseña/i }));

    expect((await screen.findByRole('status')).textContent).toContain('Tu contraseña quedó actualizada');
    expect(passwordRecoveryMocks.completePasswordReset).toHaveBeenCalledWith('single-use-token', 'a-new-secure-password');
  });

  it('does not submit when the confirmation does not match', () => {
    render(<PasswordRecoveryPage token="single-use-token" />);
    fireEvent.change(screen.getByLabelText('Nueva contraseña'), { target: { value: 'a-new-secure-password' } });
    fireEvent.change(screen.getByLabelText('Confirmar nueva contraseña'), { target: { value: 'a-different-password' } });
    fireEvent.click(screen.getByRole('button', { name: /actualizar contraseña/i }));

    expect(screen.getByRole('alert').textContent).toContain('no coinciden');
    expect(passwordRecoveryMocks.completePasswordReset).not.toHaveBeenCalled();
  });
});
