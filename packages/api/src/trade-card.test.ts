import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { buildApp } from './app.js';
import { signAccessToken } from './auth/jwt.js';
import { getPrisma } from './lib/prisma.js';
import {
  processLicenseExpiration,
  processLicenseExpiryReminders,
} from './jobs/license-expiration.js';
import type { FastifyInstance } from 'fastify';

// Requires a running Postgres with the BluBranch schema. Covers the Trade Card
// aggregate, the public share-card page, and the license-expiry reminder
// windows (30-day / 7-day, deduped via remindedAt).

const DAY_MS = 24 * 60 * 60 * 1000;

describe('Trade Card + license-expiry reminders', () => {
  let app: FastifyInstance;
  const prisma = getPrisma();
  const stamp = Date.now();
  const slug = `card-worker-${stamp}`;
  let worker: { id: string; token: string };
  let licenseId: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    app = await buildApp();

    const u = await prisma.user.create({
      data: {
        firstName: 'Cardy',
        lastName: 'Worker',
        email: `card-worker-${stamp}@test.local`,
        role: 'worker',
        authProvider: 'email',
        passwordHash: 'not-a-real-hash',
        slug,
        workerProfile: {
          create: {
            experienceLevel: 'years_6_10',
            city: 'Columbus',
            state: 'OH',
            zipCode: '43004',
            travelRadiusMiles: 25,
            jobAvailability: 'open',
            unionName: 'IBEW Local 683',
          },
        },
      },
    });
    worker = { id: u.id, token: signAccessToken(u.id, 'worker') };

    // One verified license expiring in 20 days (30-day window), one pending.
    const lic = await prisma.license.create({
      data: {
        userId: u.id,
        type: 'Journeyman Electrician',
        number: 'EL-12345',
        issuingState: 'OH',
        status: 'verified',
        expiresAt: new Date(Date.now() + 20 * DAY_MS),
      },
    });
    licenseId = lic.id;
    await prisma.license.create({
      data: {
        userId: u.id,
        type: 'Master Electrician',
        number: 'ME-999',
        issuingState: 'OH',
        status: 'pending',
        expiresAt: new Date(Date.now() + 400 * DAY_MS),
      },
    });
  });

  afterAll(async () => {
    if (worker) await prisma.user.delete({ where: { id: worker.id } }).catch(() => {});
    await app.close();
  });

  it('GET /users/me/trade-card — aggregates identity, licenses, union, vouch count', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/users/me/trade-card',
      headers: { authorization: `Bearer ${worker.token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.slug).toBe(slug);
    expect(body.unionName).toBe('IBEW Local 683');
    expect(body.experienceLevel).toBe('years_6_10');
    expect(body.licenses).toHaveLength(2); // owner sees all statuses
    expect(body.vouches).toBe(0);
  });

  it('GET /users/me/trade-card — requires auth (401)', async () => {
    const res = await app.inject({ method: 'GET', url: '/users/me/trade-card' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /share/card/:slug — public page renders OG tags + verified licenses only', async () => {
    const res = await app.inject({ method: 'GET', url: `/share/card/${slug}` });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.body).toContain('og:title');
    expect(res.body).toContain('Trade Card');
    expect(res.body).toContain('Cardy Worker');
    expect(res.body).toContain('Journeyman Electrician'); // verified → shown
    expect(res.body).not.toContain('Master Electrician'); // pending → hidden
    expect(res.body).not.toContain('EL-12345'); // license numbers never public
    expect(res.body).toContain('IBEW Local 683');
  });

  it('GET /share/card/:slug — unknown slug is 404', async () => {
    const res = await app.inject({ method: 'GET', url: `/share/card/nope-${stamp}` });
    expect(res.statusCode).toBe(404);
  });

  it('reminder fires in the 30-day window and sets remindedAt', async () => {
    await processLicenseExpiryReminders(new Date());
    const notifs = await prisma.notification.findMany({
      where: { userId: worker.id, type: 'license_expiry' },
    });
    expect(notifs).toHaveLength(1);
    expect(notifs[0]!.title).toContain('Journeyman Electrician');
    expect(notifs[0]!.title).toContain('expires in');
    const lic = await prisma.license.findUnique({ where: { id: licenseId } });
    expect(lic!.remindedAt).not.toBeNull();
  });

  it('re-running in the same window does NOT send a duplicate', async () => {
    await processLicenseExpiryReminders(new Date());
    const notifs = await prisma.notification.count({
      where: { userId: worker.id, type: 'license_expiry' },
    });
    expect(notifs).toBe(1);
  });

  it('the 7-day window sends a second reminder', async () => {
    // Simulate time passing: now is 5 days before expiry.
    const lic = await prisma.license.findUnique({ where: { id: licenseId } });
    const later = new Date(lic!.expiresAt!.getTime() - 5 * DAY_MS);
    await processLicenseExpiryReminders(later);
    const notifs = await prisma.notification.count({
      where: { userId: worker.id, type: 'license_expiry' },
    });
    expect(notifs).toBe(2);
  });

  it('licenses far from expiry get no reminder; expiry pass flips overdue licenses', async () => {
    // Far-future verified license → no reminder.
    const far = await prisma.license.create({
      data: {
        userId: worker.id,
        type: 'OSHA 30',
        number: 'OSHA-1',
        issuingState: 'OH',
        status: 'verified',
        expiresAt: new Date(Date.now() + 200 * DAY_MS),
      },
    });
    // Overdue verified license → expired by the nightly pass.
    const overdue = await prisma.license.create({
      data: {
        userId: worker.id,
        type: 'Old Card',
        number: 'OLD-1',
        issuingState: 'OH',
        status: 'verified',
        expiresAt: new Date(Date.now() - DAY_MS),
      },
    });

    await processLicenseExpiration();

    const farAfter = await prisma.license.findUnique({ where: { id: far.id } });
    expect(farAfter!.status).toBe('verified');
    expect(farAfter!.remindedAt).toBeNull();
    const overdueAfter = await prisma.license.findUnique({ where: { id: overdue.id } });
    expect(overdueAfter!.status).toBe('expired');
  });
});
