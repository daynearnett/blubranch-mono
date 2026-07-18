import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { buildApp } from './app.js';
import { getPrisma } from './lib/prisma.js';
import type { FastifyInstance } from 'fastify';

// Requires a running Postgres with the BluBranch schema (same as messages.test).
// Covers the worker signup + onboarding flow end-to-end through the HTTP layer:
//   register → login → refresh → fill worker profile → pick trades/skills.

describe('Worker signup + onboarding', () => {
  let app: FastifyInstance;
  const prisma = getPrisma();
  const stamp = Date.now();
  const email = `worker-onb-${stamp}@test.local`;
  const password = 'sup3r-secret-pw';
  const createdUserIds: string[] = [];

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    app = await buildApp();
  });

  afterAll(async () => {
    for (const id of createdUserIds) {
      await prisma.user.delete({ where: { id } }).catch(() => {});
    }
    await app.close();
  });

  it('POST /auth/register — creates a worker with tokens + a worker profile', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        firstName: 'Wade',
        lastName: 'Welder',
        email,
        password,
        role: 'worker',
        termsAccepted: true,
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.accessToken).toBeTypeOf('string');
    expect(body.refreshToken).toBeTypeOf('string');
    expect(body.user.email).toBe(email);
    expect(body.user.role).toBe('worker');
    createdUserIds.push(body.user.id);

    // Registration should have auto-created the worker profile shell.
    const profile = await prisma.workerProfile.findUnique({ where: { userId: body.user.id } });
    expect(profile).not.toBeNull();
  });

  it('POST /auth/register — duplicate email is rejected 409', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        firstName: 'Wade',
        lastName: 'Welder',
        email,
        password,
        role: 'worker',
      },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe('Conflict');
  });

  it('POST /auth/register — invalid payload (short password) is rejected 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        firstName: 'Short',
        lastName: 'Pass',
        email: `short-${stamp}@test.local`,
        password: 'nope',
        role: 'worker',
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('ValidationError');
  });

  it('POST /auth/login — valid credentials return tokens', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email, password },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().accessToken).toBeTypeOf('string');
  });

  it('POST /auth/login — wrong password is rejected 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email, password: 'wrong-password' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('POST /auth/refresh — a valid refresh token mints a new pair', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email, password },
    });
    const { refreshToken } = login.json();
    const res = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refreshToken },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().accessToken).toBeTypeOf('string');
  });

  it('onboarding — fills the worker profile then selects trades', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email, password },
    });
    const token = login.json().accessToken;

    // Step: location + headline + current job (mirrors the onboarding wizard).
    const profileRes = await app.inject({
      method: 'PUT',
      url: '/users/me/worker-profile',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        headline: 'Journeyman Welder',
        experienceLevel: 'years_6_10',
        city: 'Chicago',
        state: 'IL',
        zipCode: '60601',
        travelRadiusMiles: 50,
        jobAvailability: 'open',
        currentCompany: 'Acme Fabrication',
        currentTitle: 'Welder',
        currentStartDate: '03/2020',
      },
    });
    expect(profileRes.statusCode).toBe(200);
    expect(profileRes.json().city).toBe('Chicago');
    expect(profileRes.json().headline).toBe('Journeyman Welder');

    // Step: pick a trade.
    const trade = await prisma.trade.findFirst();
    const tradeRes = await app.inject({
      method: 'POST',
      url: '/users/me/trades',
      headers: { authorization: `Bearer ${token}` },
      payload: { tradeIds: [trade!.id] },
    });
    expect(tradeRes.statusCode).toBeLessThan(300);

    const linked = await prisma.userTrade.findFirst({
      where: { userId: login.json().user.id, tradeId: trade!.id },
    });
    expect(linked).not.toBeNull();
  });

  it('GET /users/me requires auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/users/me' });
    expect(res.statusCode).toBe(401);
  });
});
