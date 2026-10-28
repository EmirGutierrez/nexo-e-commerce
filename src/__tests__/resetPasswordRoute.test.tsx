import { describe, expect, it } from 'vitest';
import ResetPasswordRoute from '../app/(auth)/reset-password/page';

describe('reset password route', () => {
  it('passes a non-empty query token to the recovery page', async () => {
    const page = await ResetPasswordRoute({ searchParams: Promise.resolve({ token: 'single-use-token' }) });

    expect(page.props.token).toBe('single-use-token');
  });

  it('does not treat empty or repeated query tokens as a reset token', async () => {
    const empty = await ResetPasswordRoute({ searchParams: Promise.resolve({ token: '  ' }) });
    const repeated = await ResetPasswordRoute({ searchParams: Promise.resolve({ token: ['first', 'second'] }) });

    expect(empty.props.token).toBeNull();
    expect(repeated.props.token).toBeNull();
  });
});
