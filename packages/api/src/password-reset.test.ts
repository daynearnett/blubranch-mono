import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { buildApp } from './app.js';
import { getPrisma } from './lib/prisma.js';
import { hashPassword } from './auth/password.js';
import type { FastifyInstance } from 'fastify';

// Requires a running Postgres with the BluBranch schema (same as the other
// flow tests). Covers the forgot/reset password flow: code request (with the
// non-existent-email response indistinguishable from a real one), reset with
// a bad code, the happy path, and refresh-token invalidation via tokenVersion.

describe('Password reset flow', () => {
  let app: FastifyInstance;
  const prisma = getPrisma();
  const stamp = Date.now();
  const email = `reset-flow-${stamp}@test.local`;
  let userId: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    // No RESEND_API_KEY in tests → dev mode: forgot-password returns devCode.
    delete process.env.RESEND_API_KEY;
    app = await buildApp();

    const user = await prisma.user.create({
      data: {
        firstName: 'Rita',
        lastName: 'Reset',
        email,
        role: 'worker',
        authProvider: 'email',
        passwordHash: await hashPassword('old-password-123'),
      },
    });
    userId = user.id;
  });

  afterAll(async () => {
    if (userId) await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    await app.close();
  });

  it('responds identically for a non-existent email (no enumeration)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/forgot-password',
      payload: { email: `nobody-${stamp}@test.local` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ sent: true });
  });

  it('rejects a reset with a wrong or missing code', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/reset-password',
      payload: { email, code: '000000', newPassword: 'brand-new-pass-1' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().message).toMatch(/invalid or expired/i);
  });

  it('resets the password end-to-end and invalidates old refresh tokens', async () => {
    // Log in with the old password first to capture a pre-reset refresh token.
    const oldLogin = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email, password: 'old-password-123' },
    });
    expect(oldLogin.statusCode).toBe(200);
    const oldRefreshToken = oldLogin.json().refreshToken as string;

    // Request a code (dev mode returns it in the response).
    const forgot = await app.inject({
      method: 'POST',
      url: '/auth/forgot-password',
      payload: { email },
    });
    expect(forgot.statusCode).toBe(200);
    const { devCode } = forgot.json() as { sent: boolean; devCode?: string };
    expect(devCode).toMatch(/^\d{6}$/);

    // A reset code must not double as a signup email-verification code.
    const crossUse = await app.inject({
      method: 'POST',
      url: '/auth/verify-email-code',
      payload: { email, code: devCode },
    });
    expect(crossUse.statusCode).toBe(400);

    // Reset with the code.
    const reset = await app.inject({
      method: 'POST',
      url: '/auth/reset-password',
      payload: { email, code: devCode, newPassword: 'brand-new-pass-1' },
    });
    expect(reset.statusCode).toBe(200);
    expect(reset.json()).toEqual({ reset: true });

    // Code is single-use.
    const replay = await app.inject({
      method: 'POST',
      url: '/auth/reset-password',
      payload: { email, code: devCode, newPassword: 'another-pass-999' },
    });
    expect(replay.statusCode).toBe(400);

    // Old password no longer works; new one does.
    const oldPw = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email, password: 'old-password-123' },
    });
    expect(oldPw.statusCode).toBe(401);

    const newPw = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email, password: 'brand-new-pass-1' },
    });
    expect(newPw.statusCode).toBe(200);

    // The pre-reset refresh token is dead (tokenVersion bumped)…
    const staleRefresh = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refreshToken: oldRefreshToken },
    });
    expect(staleRefresh.statusCode).toBe(401);

    // …while the post-reset refresh token works.
    const freshRefresh = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refreshToken: newPw.json().refreshToken },
    });
    expect(freshRefresh.statusCode).toBe(200);

    // Completing a reset proves inbox ownership.
    const user = await prisma.user.findUnique({ where: { id: userId } });
    expect(user?.emailVerified).toBe(true);
    expect(user?.tokenVersion).toBe(1);
  });
});
