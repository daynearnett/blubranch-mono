import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { buildApp } from './app.js';
import { signAccessToken } from './auth/jwt.js';
import { getPrisma } from './lib/prisma.js';
import type { FastifyInstance } from 'fastify';

// Covers PUT /settings/notifications validation. Requires a running
// Postgres with the BluBranch schema (same as messages.test).

describe('PUT /settings/notifications', () => {
  let app: FastifyInstance;
  const prisma = getPrisma();
  const stamp = Date.now();
  let user: { id: string; token: string };

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    app = await buildApp();
    const u = await prisma.user.create({
      data: {
        firstName: 'Notif',
        lastName: 'Settings',
        email: `notif-settings-${stamp}@test.local`,
        role: 'worker',
        authProvider: 'email',
        passwordHash: 'not-a-real-hash',
      },
    });
    user = { id: u.id, token: signAccessToken(u.id, 'worker') };
  });

  afterAll(async () => {
    if (user) await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
    await app.close();
  });

  it('accepts known preference keys', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/settings/notifications',
      headers: { authorization: `Bearer ${user.token}` },
      payload: { notifyMessages: false, notifyVouches: true },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().settings.notifyMessages).toBe(false);
    expect(res.json().settings.notifyVouches).toBe(true);
  });

  it('rejects an unknown preference key instead of silently dropping it', async () => {
    // Was accepted (200) with the typo'd key quietly stripped — the client
    // had no way to know its setting never actually saved.
    const res = await app.inject({
      method: 'PUT',
      url: '/settings/notifications',
      headers: { authorization: `Bearer ${user.token}` },
      payload: { notifyMesages: false }, // typo, deliberately
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('ValidationError');
  });
});
