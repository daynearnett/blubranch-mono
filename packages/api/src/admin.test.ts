import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { buildApp } from './app.js';
import { signAccessToken } from './auth/jwt.js';
import { hashPassword } from './auth/password.js';
import { getPrisma } from './lib/prisma.js';
import type { FastifyInstance } from 'fastify';

// Requires a running Postgres with the BluBranch schema (same as messages.test).

describe('Admin routes', () => {
  let app: FastifyInstance;
  let adminId: string;
  let workerId: string;
  let workerToken: string;
  const prisma = getPrisma();
  const stamp = Date.now();
  const adminEmail = `admin-${stamp}@test.local`;
  const adminPassword = 'AdminPass123!';

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    app = await buildApp();

    const admin = await prisma.user.create({
      data: {
        firstName: 'Ada',
        lastName: 'AdminTest',
        email: adminEmail,
        role: 'admin',
        authProvider: 'email',
        passwordHash: await hashPassword(adminPassword),
      },
    });
    adminId = admin.id;

    const worker = await prisma.user.create({
      data: {
        firstName: 'Wendy',
        lastName: 'WorkerTest',
        email: `worker-admin-${stamp}@test.local`,
        role: 'worker',
        authProvider: 'email',
        passwordHash: await hashPassword(adminPassword),
      },
    });
    workerId = worker.id;
    workerToken = signAccessToken(worker.id, 'worker');
  });

  afterAll(async () => {
    if (adminId) await prisma.user.delete({ where: { id: adminId } }).catch(() => {});
    if (workerId) await prisma.user.delete({ where: { id: workerId } }).catch(() => {});
    await app.close();
  });

  it('POST /admin/login — admin gets { token, user }', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/admin/login',
      payload: { email: adminEmail, password: adminPassword },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(typeof body.token).toBe('string');
    expect(body.user).toMatchObject({ id: adminId, email: adminEmail });
    expect(body.user.name).toBe('Ada AdminTest');
  });

  it('POST /admin/login — non-admin is rejected 403', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/admin/login',
      payload: { email: `worker-admin-${stamp}@test.local`, password: adminPassword },
    });
    expect(res.statusCode).toBe(403);
  });

  it('POST /admin/login — wrong password 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/admin/login',
      payload: { email: adminEmail, password: 'wrong' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('GET /admin/me — returns the admin profile', async () => {
    const token = signAccessToken(adminId, 'admin');
    const res = await app.inject({
      method: 'GET',
      url: '/admin/me',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ id: adminId, email: adminEmail, name: 'Ada AdminTest' });
  });

  it('GET /admin/dashboard — returns metric keys', async () => {
    const token = signAccessToken(adminId, 'admin');
    const res = await app.inject({
      method: 'GET',
      url: '/admin/dashboard',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    for (const k of [
      'total_workers',
      'total_employers',
      'total_jobs',
      'total_applications',
      'pending_verifications',
    ]) {
      expect(typeof body[k]).toBe('number');
    }
    expect(body.total_workers).toBeGreaterThanOrEqual(1); // our worker
  });

  it('GET /admin/workers — paginated shape', async () => {
    const token = signAccessToken(adminId, 'admin');
    const res = await app.inject({
      method: 'GET',
      url: '/admin/workers?limit=5',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body.items)).toBe(true);
    expect(body).toMatchObject({ page: 1, limit: 5 });
    expect(typeof body.total).toBe('number');
  });

  it('admin routes reject a non-admin token (403)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/dashboard',
      headers: { authorization: `Bearer ${workerToken}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('admin routes reject no token (401)', async () => {
    const res = await app.inject({ method: 'GET', url: '/admin/dashboard' });
    expect(res.statusCode).toBe(401);
  });
});
