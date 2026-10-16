// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const mfa = vi.hoisted(() => ({
  status: vi.fn(),
  beginEnrollment: vi.fn(),
  completeEnrollment: vi.fn(),
  rotateRecoveryCodes: vi.fn(),
  disable: vi.fn(),
}));

vi.mock('../services', () => ({ mfaService: mfa }));

import MfaSettingsCard from '../modules/auth/components/MfaSettingsCard';

const disabled = { enabled: false, enrollmentPending: false, recoveryCodesRemaining: 0 };
const enabled = { enabled: true, enrollmentPending: false, recoveryCodesRemaining: 10 };

beforeEach(() => {
  vi.clearAllMocks();
  mfa.status.mockResolvedValue(disabled);
  mfa.beginEnrollment.mockResolvedValue({ secret: 'JBSWY3DPEHPK3PXP', otpauthUri: 'otpauth://totp/NEXO' });
  mfa.completeEnrollment.mockResolvedValue({ recoveryCodes: ['AAAAA-BBBBB-CCCCC-DDDDD'] });
  mfa.rotateRecoveryCodes.mockResolvedValue({ recoveryCodes: ['11111-22222-33333-44444'] });
  mfa.disable.mockResolvedValue(undefined);
});

afterEach(() => cleanup());

describe('MfaSettingsCard', () => {
  it('enrolls an account, displays recovery codes once, and lets the user dismiss them', async () => {
    mfa.status.mockResolvedValueOnce(disabled).mockResolvedValueOnce(enabled);
    render(<MfaSettingsCard />);

    fireEvent.change(await screen.findByLabelText('Contraseña actual'), { target: { value: 'correct-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Configurar verificación en dos pasos' }));
    expect(await screen.findByText('Clave para tu aplicación')).toBeTruthy();
    expect(mfa.beginEnrollment).toHaveBeenCalledWith('correct-password');

    const code = screen.getByLabelText('Código de seis dígitos');
    fireEvent.change(code, { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Activar verificación' }));

    expect(await screen.findByText('AAAAA-BBBBB-CCCCC-DDDDD')).toBeTruthy();
    expect(mfa.completeEnrollment).toHaveBeenCalledWith('123456');
    expect(await screen.findByText(/Activa/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Ya los guardé' }));
    await waitFor(() => expect(screen.queryByText('AAAAA-BBBBB-CCCCC-DDDDD')).toBeNull());
  });

  it('rotates recovery codes and disables MFA with separate current-password confirmations', async () => {
    mfa.status.mockResolvedValueOnce(enabled).mockResolvedValueOnce(enabled).mockResolvedValueOnce(disabled);
    render(<MfaSettingsCard />);

    const passwords = await screen.findAllByLabelText('Contraseña actual');
    const codes = screen.getAllByLabelText('Código de autenticación o recuperación');
    fireEvent.change(passwords[0], { target: { value: 'rotate-password' } });
    fireEvent.change(codes[0], { target: { value: 'AAAAA-BBBBB-CCCCC-DDDDD' } });
    fireEvent.click(screen.getByRole('button', { name: 'Regenerar códigos' }));
    expect(await screen.findByText('11111-22222-33333-44444')).toBeTruthy();
    expect(mfa.rotateRecoveryCodes).toHaveBeenCalledWith('rotate-password', 'AAAAA-BBBBB-CCCCC-DDDDD');

    fireEvent.change(passwords[1], { target: { value: 'disable-password' } });
    fireEvent.change(codes[1], { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Desactivar verificación' }));
    await waitFor(() => expect(mfa.disable).toHaveBeenCalledWith('disable-password', '123456'));
    expect(await screen.findByText('No está activa')).toBeTruthy();
  });

  it('shows errors for status, enrollment, confirmation, and management failures', async () => {
    mfa.status.mockRejectedValueOnce(new Error('No se pudo consultar MFA.'));
    const first = render(<MfaSettingsCard />);
    expect(await screen.findByText('No se pudo consultar MFA.')).toBeTruthy();
    first.unmount();

    mfa.status.mockResolvedValue(disabled);
    mfa.beginEnrollment.mockRejectedValueOnce(new Error('MFA no configurado.'));
    render(<MfaSettingsCard />);
    fireEvent.change(await screen.findByLabelText('Contraseña actual'), { target: { value: 'password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Configurar verificación en dos pasos' }));
    expect(await screen.findByText('MFA no configurado.')).toBeTruthy();

    cleanup();
    mfa.beginEnrollment.mockResolvedValue({ secret: 'JBSWY3DPEHPK3PXP', otpauthUri: 'otpauth://totp/NEXO' });
    mfa.completeEnrollment.mockRejectedValueOnce(new Error('Código incorrecto.'));
    render(<MfaSettingsCard />);
    fireEvent.change(await screen.findByLabelText('Contraseña actual'), { target: { value: 'password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Configurar verificación en dos pasos' }));
    fireEvent.change(await screen.findByLabelText('Código de seis dígitos'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Activar verificación' }));
    expect(await screen.findByText('Código incorrecto.')).toBeTruthy();

    cleanup();
    mfa.status.mockResolvedValue(enabled);
    mfa.rotateRecoveryCodes.mockRejectedValueOnce(new Error('No se pudieron regenerar.'));
    mfa.disable.mockRejectedValueOnce(new Error('No se pudo desactivar.'));
    render(<MfaSettingsCard />);
    const passwords = await screen.findAllByLabelText('Contraseña actual');
    const codes = screen.getAllByLabelText('Código de autenticación o recuperación');
    fireEvent.change(passwords[0], { target: { value: 'password' } });
    fireEvent.change(codes[0], { target: { value: 'AAAAA-BBBBB-CCCCC-DDDDD' } });
    fireEvent.click(screen.getByRole('button', { name: 'Regenerar códigos' }));
    expect(await screen.findByText('No se pudieron regenerar.')).toBeTruthy();

    fireEvent.change(passwords[1], { target: { value: 'password' } });
    fireEvent.change(codes[1], { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Desactivar verificación' }));
    expect(await screen.findByText('No se pudo desactivar.')).toBeTruthy();
  });

  it('supports a hidden card and reports status when the service returns no state', async () => {
    mfa.status.mockResolvedValueOnce(null);
    const { container } = render(<MfaSettingsCard hidden />);
    expect(container.querySelector('section')?.hidden).toBe(true);
    expect(await screen.findByText(/No se pudo consultar la configuración/)).toBeTruthy();
  });
});
