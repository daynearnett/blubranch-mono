import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { buildApp } from './app.js';
import { signAccessToken } from './auth/jwt.js';
import { getPrisma } from './lib/prisma.js';
import type { FastifyInstance } from 'fastify';

// Requires a running Postgres with the BluBranch schema (same as messages.test).
//
// Covers two GET /jobs regressions found by the tester-agent sim and a
// GET /jobs/:id crash:
//   - sort=pay_highest must actually rank by pay, not silently let a
//     lower-paying featured job jump the queue with no explanation.
//   - with no lat/lng (and no PostGIS locally), the default feed should at
//     least bubble a logged-in worker's own city/state to the top instead of
//     being fully location-blind.
//   - a non-UUID :id must 404, not crash with a raw Prisma error.

describe('GET /jobs — sort and location-default regressions', () => {
  let app: FastifyInstance;
  const prisma = getPrisma();
  const stamp = Date.now();
  let employer: { id: string; token: string };
  let worker: { id: string; token: string };
  let companyId: string;
  let tradeId: number;
  const prevStripeKey = process.env.STRIPE_SECRET_KEY;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    delete process.env.STRIPE_SECRET_KEY; // dev path: jobs publish `open` immediately
    app = await buildApp();

    const emp = await prisma.user.create({
      data: {
        firstName: 'Jo',
        lastName: 'Hirer',
        email: `jo-jobsearch-${stamp}@test.local`,
        role: 'employer',
        authProvider: 'email',
        passwordHash: 'not-a-real-hash',
      },
    });
    employer = { id: emp.id, token: signAccessToken(emp.id, 'employer') };

    const wkr = await prisma.user.create({
      data: {
        firstName: 'Nina',
        lastName: 'Worker',
        email: `nina-jobsearch-${stamp}@test.local`,
        role: 'worker',
        authProvider: 'email',
        passwordHash: 'not-a-real-hash',
      },
    });
    worker = { id: wkr.id, token: signAccessToken(wkr.id, 'worker') };
    await prisma.workerProfile.create({
      data: {
        userId: wkr.id,
        experienceLevel: 'years_3_5',
        city: 'Cleveland',
        state: 'OH',
        zipCode: '44101',
        travelRadiusMiles: 25,
        jobAvailability: 'open',
      },
    });

    const company = await prisma.company.create({
      data: {
        employerId: emp.id,
        name: 'Hirer Industries',
        sizeRange: 'size_11_50',
        contactEmail: `co-jobsearch-${stamp}@test.local`,
      },
    });
    companyId = company.id;

    const trade = await prisma.trade.findFirst();
    tradeId = trade!.id;
  });

  afterAll(async () => {
    if (employer) await prisma.user.delete({ where: { id: employer.id } }).catch(() => {});
    if (worker) await prisma.user.delete({ where: { id: worker.id } }).catch(() => {});
    if (prevStripeKey === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = prevStripeKey;
    await app.close();
  });

  function postJob(overrides: Record<string, unknown>) {
    return app.inject({
      method: 'POST',
      url: '/jobs',
      headers: { authorization: `Bearer ${employer.token}` },
      payload: {
        companyId,
        title: 'Test Role',
        tradeId,
        experienceLevel: 'years_3_5',
        payMin: 20,
        payMax: 30,
        jobType: 'full_time',
        workSetting: 'commercial',
        city: 'Columbus',
        state: 'OH',
        zipCode: '43215',
        description: 'A role posted in a jobs-search regression test',
        openingsCount: 2,
        planTier: 'basic',
        ...overrides,
      },
    });
  }

  it('sort=pay_highest ranks by pay even when a lower-paying job is featured', async () => {
    // Basic jobs can't be featured (see jobs.ts: boostFeaturedPlacement is
    // ignored on 'basic'), so post the low payer on 'pro' to get it featured.
    const lowFeatured = await postJob({
      title: `Low Featured ${stamp}`,
      payMin: 20,
      payMax: 25,
      planTier: 'pro',
      boostFeaturedPlacement: true,
    });
    expect(lowFeatured.statusCode).toBe(201);
    expect(lowFeatured.json().isFeatured).toBe(true);

    const highPlain = await postJob({ title: `High Plain ${stamp}`, payMin: 40, payMax: 50 });
    expect(highPlain.statusCode).toBe(201);

    const res = await app.inject({ method: 'GET', url: '/jobs?sort=pay_highest&limit=50' });
    expect(res.statusCode).toBe(200);
    const results = res.json().results as Array<{ title: string; payMax: number }>;
    const ours = results.filter((r) => r.title === `Low Featured ${stamp}` || r.title === `High Plain ${stamp}`);
    expect(ours).toHaveLength(2);
    expect(ours[0]!.title).toBe(`High Plain ${stamp}`);
    expect(ours[1]!.title).toBe(`Low Featured ${stamp}`);
  });

  it('default sort (no lat/lng) bubbles a logged-in worker\'s own city/state to the top', async () => {
    const cleveland = await postJob({
      title: `Cleveland Job ${stamp}`,
      city: 'Cleveland',
      state: 'OH',
      zipCode: '44101',
    });
    expect(cleveland.statusCode).toBe(201);
    const farAway = await postJob({ title: `Far Away Job ${stamp}`, city: 'Dallas', state: 'TX', zipCode: '75201' });
    expect(farAway.statusCode).toBe(201);

    const res = await app.inject({
      method: 'GET',
      url: '/jobs?limit=50',
      headers: { authorization: `Bearer ${worker.token}` },
    });
    expect(res.statusCode).toBe(200);
    const results = res.json().results as Array<{ title: string; city: string; state: string }>;
    const clevelandIdx = results.findIndex((r) => r.title === `Cleveland Job ${stamp}`);
    const farAwayIdx = results.findIndex((r) => r.title === `Far Away Job ${stamp}`);
    expect(clevelandIdx).toBeGreaterThanOrEqual(0);
    expect(farAwayIdx).toBeGreaterThanOrEqual(0);
    expect(clevelandIdx).toBeLessThan(farAwayIdx);
  });

  it('logged-out / no profile still returns results (no crash, just no boost)', async () => {
    const res = await app.inject({ method: 'GET', url: '/jobs?limit=5' });
    expect(res.statusCode).toBe(200);
  });
});

describe('GET /jobs/:id — non-UUID param', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 404, not a raw Prisma error, for a non-UUID id', async () => {
    const res = await app.inject({ method: 'GET', url: '/jobs/not-a-real-id' });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: 'NotFound' });
  });

  it('still returns 404 for a well-formed but nonexistent UUID', async () => {
    const res = await app.inject({ method: 'GET', url: '/jobs/00000000-0000-0000-0000-000000000000' });
    expect(res.statusCode).toBe(404);
  });
});
