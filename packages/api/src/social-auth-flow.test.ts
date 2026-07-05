import { describe, expect, it, beforeAll, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { getPrisma } from './lib/prisma.js';

// Mock the token verifier so the route test exercises provisioning/linking logic
// (the crypto is covered by services/social-auth.test.ts) with deterministic
// identities keyed off the `idToken` string.
vi.mock('./services/social-auth.js', () => ({
  verifySocialIdToken: vi.fn(async (provider: 'apple' | 'google', idToken: string) => {
    if (idToken.startsWith('reject')) {
      const e = new Error('bad token');
      e.name = 'SocialAuthError';
      throw e;
    }
    // Token format: `<marker>|email|sub|first|last`. marker 'u' = email unverified.
    const [marker = 't', email = '', sub = '', first = '', last = ''] = idToken.split('|');
    return {
      provider,
      providerUserId: sub,
      email: email.toLowerCase(),
      emailVerified: marker !== 'u',
      firstName: first,
      lastName: last,
    };
  }),
}));

const { buildApp } = await import('./app.js');

describe('POST /auth/social', () => {
  let app: FastifyInstance;
  const prisma = getPrisma();
  const stamp = Date.now();

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    app = await buildApp();
  });

  it('provisions a new worker from a verified Google token', async () => {
    const email = `newgoog-${stamp}@test.local`;
    const res = await app.inject({
      method: 'POST',
      url: '/auth/social',
      payload: {
        provider: 'google',
        idToken: `t|${email}|goog-sub-${stamp}|Grace|Hopper`,
        role: 'worker',
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.accessToken).toBeTruthy();
    expect(body.user.email).toBe(email);
    expect(body.user.firstName).toBe('Grace');

    const user = await prisma.user.findUnique({
      where: { email },
      include: { workerProfile: true },
    });
    expect(user?.authProvider).toBe('google');
    expect(user?.authProviderId).toBe(`goog-sub-${stamp}`);
    expect(user?.emailVerified).toBe(true);
    expect(user?.workerProfile).toBeTruthy();
  });

  it('signs the same provider user back in without duplicating', async () => {
    const email = `repeat-${stamp}@test.local`;
    const idToken = `t|${email}|goog-sub-repeat-${stamp}|Ada|Lovelace`;
    const first = await app.inject({ method: 'POST', url: '/auth/social', payload: { provider: 'google', idToken } });
    const second = await app.inject({ method: 'POST', url: '/auth/social', payload: { provider: 'google', idToken } });
    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(first.json().user.id).toBe(second.json().user.id);
    const count = await prisma.user.count({ where: { email } });
    expect(count).toBe(1);
  });

  it('links a provider id onto an existing email-registered account', async () => {
    const email = `existing-${stamp}@test.local`;
    const existing = await prisma.user.create({
      data: {
        firstName: 'Existing',
        lastName: 'User',
        email,
        role: 'worker',
        authProvider: 'email',
        passwordHash: 'x',
      },
    });
    const res = await app.inject({
      method: 'POST',
      url: '/auth/social',
      payload: { provider: 'apple', idToken: `t|${email}|apple-sub-${stamp}||` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().user.id).toBe(existing.id);
    const updated = await prisma.user.findUnique({ where: { id: existing.id } });
    expect(updated?.authProviderId).toBe(`apple-sub-${stamp}`);
  });

  it('refuses to link an UNVERIFIED provider email to an existing account (409)', async () => {
    // Pre-verified-email takeover guard: an existing email-registered victim...
    const email = `victim-${stamp}@test.local`;
    const victim = await prisma.user.create({
      data: {
        firstName: 'Victim',
        lastName: 'User',
        email,
        role: 'worker',
        authProvider: 'email',
        passwordHash: 'x',
      },
    });
    // ...and an attacker presenting a valid token whose email claim is the
    // victim's but is NOT verified (marker 'u') + the attacker's own sub.
    const res = await app.inject({
      method: 'POST',
      url: '/auth/social',
      payload: { provider: 'google', idToken: `u|${email}|attacker-sub-${stamp}|Mal|Ory` },
    });
    expect(res.statusCode).toBe(409);
    // The victim account must be untouched — no provider id linked, no takeover.
    const after = await prisma.user.findUnique({ where: { id: victim.id } });
    expect(after?.authProviderId).toBeNull();
    expect(after?.authProvider).toBe('email');
  });

  it('still provisions a NEW user from an unverified email when no account exists', async () => {
    const email = `fresh-unv-${stamp}@test.local`;
    const res = await app.inject({
      method: 'POST',
      url: '/auth/social',
      payload: { provider: 'google', idToken: `u|${email}|goog-unv-${stamp}|Fresh|Start` },
    });
    expect(res.statusCode).toBe(200);
    const user = await prisma.user.findUnique({ where: { email } });
    expect(user?.emailVerified).toBe(false);
  });

  it('rejects an unverifiable token with 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/social',
      payload: { provider: 'apple', idToken: 'reject-this-token', role: 'worker' },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe('Unauthorized');
  });

  it('ignores a client-supplied email — identity comes from the token', async () => {
    const tokenEmail = `tokentruth-${stamp}@test.local`;
    const res = await app.inject({
      method: 'POST',
      url: '/auth/social',
      payload: {
        provider: 'google',
        idToken: `t|${tokenEmail}|goog-truth-${stamp}|Real|Name`,
        role: 'worker',
        // A malicious client trying to inject another identity — must be ignored.
        email: 'victim@example.com',
        providerUserId: 'victim-sub',
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().user.email).toBe(tokenEmail);
  });
});
