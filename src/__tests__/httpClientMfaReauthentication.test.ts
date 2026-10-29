// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient, MFA_ENROLLMENT_REQUIRED_EVENT, MFA_REAUTHENTICATION_REQUIRED_EVENT } from '../shared/services/http-client';

describe('reauthenticación MFA en el cliente HTTP', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      code: 'MFA_REAUTHENTICATION_REQUIRED',
      message: 'Vuelve a iniciar sesión y confirma tu segundo factor para continuar.',
    }), { status: 401, headers: { 'content-type': 'application/json' } })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('avisa a la aplicación cuando el servidor rechaza una sesión sin segundo factor confirmado', async () => {
    const reauthenticate = vi.fn();
    window.addEventListener(MFA_REAUTHENTICATION_REQUIRED_EVENT, reauthenticate);

    await expect(apiClient.get('/api/business/products')).rejects.toMatchObject({
      status: 401,
      code: 'MFA_REAUTHENTICATION_REQUIRED',
    });

    expect(reauthenticate).toHaveBeenCalledOnce();
    window.removeEventListener(MFA_REAUTHENTICATION_REQUIRED_EVENT, reauthenticate);
  });

  it('avisa a la sesión activa que debe completar el enrolamiento obligatorio', async () => {
    const enroll = vi.fn();
    window.addEventListener(MFA_ENROLLMENT_REQUIRED_EVENT, enroll);
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({
      code: 'MFA_ENROLLMENT_REQUIRED',
      message: 'Activa la verificación en dos pasos.',
    }), { status: 403, headers: { 'content-type': 'application/json' } }));

    await expect(apiClient.get('/api/business/products')).rejects.toMatchObject({
      status: 403,
      code: 'MFA_ENROLLMENT_REQUIRED',
    });

    expect(enroll).toHaveBeenCalledOnce();
    window.removeEventListener(MFA_ENROLLMENT_REQUIRED_EVENT, enroll);
  });
});
