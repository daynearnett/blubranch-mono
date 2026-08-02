import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { buildApp } from './app.js';
import { signAccessToken } from './auth/jwt.js';
import { getPrisma } from './lib/prisma.js';
import { processCertificationExpiryReminders } from './jobs/license-expiration.js';
import type { FastifyInstance } from 'fastify';

// Requires a running Postgres with the BluBranch schema. Covers the ticket
// wallet: certification expiry (create with expiresAt, trade-card exposure),
// the cert expiry-reminder windows, and the admin verification queue.

const DAY_MS = 24 * 60 * 60 * 1000;

describe('Ticket wallet — certification expiry + admin queue', () => {
  let app: FastifyInstance;
  const prisma = getPrisma();
  const stamp = Date.now();
  let worker: { id: string; token: string };
  let adminUser: { id: string; token: string };
  let certId: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    app = await buildApp();

    const u = await prisma.user.create({
      data: {
        firstName: 'Ticket',
        lastName: 'Holder',
        email: `ticket-holder-${stamp}@test.local`,
        role: 'worker',
        authProvider: 'email',
        passwordHash: 'not-a-real-hash',
        slug: `ticket-holder-${stamp}`,
      },
    });
    worker = { id: u.id, token: signAccessToken(u.id, 'worker') };

    const a = await prisma.user.create({
      data: {
        firstName: 'Admin',
        lastName: 'Ticket',
        email: `ticket-admin-${stamp}@test.local`,
        role: 'admin',
        authProvider: 'email',
        passwordHash: 'not-a-real-hash',
      },
    });
    adminUser = { id: a.id, token: signAccessToken(a.id, 'admin') };
  });

  afterAll(async () => {
    if (worker) await prisma.user.delete({ where: { id: worker.id } }).catch(() => {});
    if (adminUser) await prisma.user.delete({ where: { id: adminUser.id } }).catch(() => {});
    await app.close();
  });

  it('creates a certification with an expiry date', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/users/me/certifications',
      headers: { authorization: `Bearer ${worker.token}` },
      payload: {
        name: 'OSHA 30',
        certificationNumber: 'OSHA-30-12345',
        expiresAt: new Date(Date.now() + 20 * DAY_MS).toISOString(),
      },
    });
    expect(res.statusCode).toBe(201);
    const cert = res.json();
    expect(cert.expiresAt).not.toBeNull();
    certId = cert.id;
  });

  it('admin queue lists the unverified cert and verifies it', async () => {
    const list = await app.inject({
      method: 'GET',
      url: '/admin/certifications?status=pending',
      headers: { authorization: `Bearer ${adminUser.token}` },
    });
    expect(list.statusCode).toBe(200);
    expect(list.json().items.some((c: { id: string }) => c.id === certId)).toBe(true);

    const verify = await app.inject({
      method: 'PUT',
      url: `/admin/certifications/${certId}`,
      headers: { authorization: `Bearer ${adminUser.token}` },
      payload: { status: 'verified' },
    });
    expect(verify.statusCode).toBe(200);
    expect(verify.json().isVerified).toBe(true);
    expect(verify.json().verifiedAt).not.toBeNull();
  });

  it('admin certification routes reject non-admins', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/certifications',
      headers: { authorization: `Bearer ${worker.token}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('trade card includes the cert with its expiry', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/users/me/trade-card',
      headers: { authorization: `Bearer ${worker.token}` },
    });
    expect(res.statusCode).toBe(200);
    const cert = res.json().certifications.find((c: { id: string }) => c.id === certId);
    expect(cert).toBeDefined();
    expect(cert.expiresAt).not.toBeNull();
    expect(cert.isVerified).toBe(true);
  });

  it('reminder fires inside the 30-day window and dedupes on re-run', async () => {
    await processCertificationExpiryReminders(new Date());
    let notifs = await prisma.notification.findMany({
      where: { userId: worker.id, type: 'license_expiry' },
    });
    expect(notifs).toHaveLength(1);
    expect(notifs[0]!.title).toContain('OSHA 30');
    expect(notifs[0]!.title).toContain('expires in');

    const cert = await prisma.certification.findUnique({ where: { id: certId } });
    expect(cert!.remindedAt).not.toBeNull();

    await processCertificationExpiryReminders(new Date());
    notifs = await prisma.notification.findMany({
      where: { userId: worker.id, type: 'license_expiry' },
    });
    expect(notifs).toHaveLength(1);
  });

  it('unverified certs never get reminders', async () => {
    await prisma.certification.create({
      data: {
        userId: worker.id,
        name: 'Forklift',
        expiresAt: new Date(Date.now() + 5 * DAY_MS),
      },
    });
    await processCertificationExpiryReminders(new Date());
    const notifs = await prisma.notification.count({
      where: { userId: worker.id, type: 'license_expiry' },
    });
    expect(notifs).toBe(1); // still only the OSHA 30 reminder
  });
});
