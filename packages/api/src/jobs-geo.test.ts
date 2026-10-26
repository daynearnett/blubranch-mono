import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { buildApp } from './app.js';
import { getPrisma } from './lib/prisma.js';
import type { FastifyInstance } from 'fastify';

// Covers the location-blind GET /jobs bug: with PostGIS disabled (Railway's
// stock Postgres — lib/postgis.ts), distance filtering/sorting used to go
// completely blind (distanceMiles always null, radius ignored). Requires a
// running Postgres with the BluBranch schema.

describe('GET /jobs — Haversine distance fallback when PostGIS is disabled', () => {
  let app: FastifyInstance;
  const prisma = getPrisma();
  const stamp = Date.now();
  const prevPostgis = process.env.POSTGIS_ENABLED;
  let employerId: string;
  let companyId: string;
  let tradeId: number;
  let nearJobId: string;
  let farJobId: string;

  // Columbus, OH <-> Cleveland, OH — ~140 miles apart.
  const CALLER = { lat: 39.9612, lng: -82.9988 }; // Columbus
  const NEAR = { lat: 39.9612, lng: -82.9988 }; // same as caller — Columbus
  const FAR = { lat: 41.4993, lng: -81.6944 }; // Cleveland

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.POSTGIS_ENABLED = 'false'; // force the Railway-like path
    app = await buildApp();

    const employer = await prisma.user.create({
      data: {
        firstName: 'Geo',
        lastName: 'Employer',
        email: `geo-employer-${stamp}@test.local`,
        role: 'employer',
        authProvider: 'email',
        passwordHash: 'not-a-real-hash',
      },
    });
    employerId = employer.id;

    const company = await prisma.company.create({
      data: {
        employerId,
        name: `GeoCo ${stamp}`,
        sizeRange: 'size_1_10',
        contactEmail: `geoco-${stamp}@test.local`,
      },
    });
    companyId = company.id;

    const trade = await prisma.trade.findFirst();
    tradeId = trade!.id;

    const base = {
      employerId,
      companyId,
      tradeId,
      experienceLevel: 'any',
      payMin: 30,
      payMax: 40,
      jobType: 'full_time' as const,
      workSetting: 'commercial' as const,
      description: 'geo test',
      status: 'open' as const,
      planTier: 'basic' as const,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    };

    const near = await prisma.job.create({
      data: { ...base, title: `Near Job ${stamp}`, city: 'Columbus', state: 'OH', zipCode: '43215' },
    });
    nearJobId = near.id;
    const far = await prisma.job.create({
      data: { ...base, title: `Far Job ${stamp}`, city: 'Cleveland', state: 'OH', zipCode: '44101' },
    });
    farJobId = far.id;

    // Set deterministic lat/lng directly — skip the geocoder (which falls
    // back to a randomized Chicago-anchored point without a Google API key).
    await prisma.$executeRawUnsafe(
      `UPDATE "jobs" SET "lat" = $1, "lng" = $2 WHERE "id" = $3::uuid`,
      NEAR.lat,
      NEAR.lng,
      nearJobId,
    );
    await prisma.$executeRawUnsafe(
      `UPDATE "jobs" SET "lat" = $1, "lng" = $2 WHERE "id" = $3::uuid`,
      FAR.lat,
      FAR.lng,
      farJobId,
    );
  });

  afterAll(async () => {
    await prisma.job.deleteMany({ where: { id: { in: [nearJobId, farJobId] } } }).catch(() => {});
    await prisma.company.delete({ where: { id: companyId } }).catch(() => {});
    if (employerId) await prisma.user.delete({ where: { id: employerId } }).catch(() => {});
    if (prevPostgis === undefined) delete process.env.POSTGIS_ENABLED;
    else process.env.POSTGIS_ENABLED = prevPostgis;
    await app.close();
  });

  it('a 25-mile radius around Columbus excludes the Cleveland job and returns a real distance for the Columbus one', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/jobs?lat=${CALLER.lat}&lng=${CALLER.lng}&radius=25&search=${encodeURIComponent(String(stamp))}`,
    });
    expect(res.statusCode).toBe(200);
    const ids = res.json().results.map((r: { id: string }) => r.id);
    expect(ids).toContain(nearJobId);
    expect(ids).not.toContain(farJobId);

    const nearResult = res.json().results.find((r: { id: string }) => r.id === nearJobId);
    expect(nearResult.distanceMiles).not.toBeNull();
    expect(nearResult.distanceMiles).toBeLessThan(1);
  });

  it('a 200-mile radius includes both, sorted nearest first, with non-null distances', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/jobs?lat=${CALLER.lat}&lng=${CALLER.lng}&radius=200&search=${encodeURIComponent(String(stamp))}`,
    });
    expect(res.statusCode).toBe(200);
    const results = res.json().results as Array<{ id: string; distanceMiles: number | null }>;
    const near = results.find((r) => r.id === nearJobId);
    const far = results.find((r) => r.id === farJobId);
    expect(near).toBeDefined();
    expect(far).toBeDefined();
    expect(near!.distanceMiles).not.toBeNull();
    expect(far!.distanceMiles).not.toBeNull();
    // Cleveland is genuinely ~140mi from Columbus, not some arbitrary gap.
    expect(far!.distanceMiles!).toBeGreaterThan(100);
    expect(far!.distanceMiles!).toBeLessThan(180);
    expect(near!.distanceMiles!).toBeLessThan(far!.distanceMiles!);
  });
});
