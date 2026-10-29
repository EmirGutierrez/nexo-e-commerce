import { beforeEach, describe, expect, it, vi } from 'vitest';

const { apiGet, apiPost, clearCsrfToken } = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  clearCsrfToken: vi.fn(),
}));

vi.mock('../shared/services/http-client', () => ({
  ApiError: class ApiError extends Error {
    constructor(message: string, readonly status: number, readonly code?: string) {
      super(message);
    }
  },
  apiClient: { get: apiGet, post: apiPost },
  clearCsrfToken,
}));

import { authService, mfaService } from '../services';
import { ApiError } from '../shared/services/http-client';

const user = {
  id: 'user-1', name: 'NEXO Admin', email: 'admin@nexo.gt', role: 'admin', status: 'ACTIVE', permissions: [],
};

describe('MFA login and account API', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sends the MFA code as part of the login request', async () => {
    apiPost.mockResolvedValue(user);
    apiGet.mockResolvedValue({ required: false, enabled: false, enrollmentPending: false, recoveryCodesRemaining: 0 });

    const session = await authService.login(user.email, 'a-strong-password', '123456');

    expect(apiPost).toHaveBeenCalledWith('/api/auth/login', {
      email: user.email, password: 'a-strong-password', mfaCode: '123456',
    });
    expect(apiGet).toHaveBeenCalledWith('/api/auth/mfa');
    expect(session?.mfaSetupRequired).toBe(false);
  });

  it('marks a staff account for mandatory MFA enrollment after password login', async () => {
    apiPost.mockResolvedValue(user);
    apiGet.mockResolvedValue({ required: true, enabled: false, enrollmentPending: false, recoveryCodesRemaining: 0 });

    const session = await authService.login(user.email, 'a-strong-password');

    expect(session?.mfaSetupRequired).toBe(true);
  });

  it.each(['MFA_REQUIRED', 'MFA_INVALID', 'MFA_ENROLLMENT_REQUIRED', 'MFA_REAUTHENTICATION_REQUIRED'])('preserves the %s challenge response for the login screen', async (code) => {
    const challenge = new ApiError('Ingresa el código.', 401, code);
    apiPost.mockRejectedValue(challenge);

    await expect(authService.login(user.email, 'a-strong-password')).rejects.toBe(challenge);
  });

  it('keeps ordinary invalid-password responses compatible with the existing login flow', async () => {
    apiPost.mockRejectedValue(new ApiError('Credenciales inválidas.', 401, 'INVALID_CREDENTIALS'));

    await expect(authService.login(user.email, 'wrong-password')).resolves.toBeNull();
  });

  it('restores an authenticated staff session with the MFA enrollment requirement', async () => {
    const accountWithoutPermissions = { ...user, permissions: undefined };
    apiGet.mockResolvedValueOnce(accountWithoutPermissions)
      .mockResolvedValueOnce({ required: true, enabled: false, enrollmentPending: false, recoveryCodesRemaining: 0 });

    const session = await authService.currentUser();

    expect(apiGet).toHaveBeenNthCalledWith(1, '/api/auth/me');
    expect(apiGet).toHaveBeenNthCalledWith(2, '/api/auth/mfa');
    expect(session?.permissions).toEqual([]);
    expect(session?.mfaSetupRequired).toBe(true);
  });

  it('returns no session for an expired session but propagates non-authentication API failures', async () => {
    apiGet.mockRejectedValueOnce(new ApiError('Sesión vencida.', 401, 'UNAUTHORIZED'));
    await expect(authService.currentUser()).resolves.toBeNull();

    const unavailable = new ApiError('Servicio no disponible.', 503, 'SERVICE_UNAVAILABLE');
    apiGet.mockRejectedValueOnce(unavailable);
    await expect(authService.currentUser()).rejects.toBe(unavailable);
  });

  it('requests and completes password recovery through the public endpoints', async () => {
    apiPost.mockResolvedValue(undefined);

    await authService.requestPasswordReset(user.email);
    expect(apiPost).toHaveBeenNthCalledWith(1, '/api/auth/password-reset/request', { email: user.email });

    await authService.completePasswordReset('single-use-token', 'a-new-secure-password');
    expect(apiPost).toHaveBeenNthCalledWith(2, '/api/auth/password-reset/complete', {
      token: 'single-use-token', newPassword: 'a-new-secure-password',
    });
    expect(clearCsrfToken).toHaveBeenCalledOnce();
  });

  it('uses the authenticated MFA endpoints for enrollment and status', async () => {
    apiGet.mockResolvedValue({ required: false, enabled: false, enrollmentPending: false, recoveryCodesRemaining: 0 });
    apiPost.mockResolvedValue({ secret: 'SECRET', otpauthUri: 'otpauth://totp/NEXO' });

    await mfaService.status();
    await mfaService.beginEnrollment('a-strong-password');

    expect(apiGet).toHaveBeenCalledWith('/api/auth/mfa');
    expect(apiPost).toHaveBeenCalledWith('/api/auth/mfa/enroll/start', { currentPassword: 'a-strong-password' });
    expect(clearCsrfToken).not.toHaveBeenCalled();
  });
});
