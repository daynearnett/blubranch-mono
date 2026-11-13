import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { buildApp } from './app.js';
import { signAccessToken } from './auth/jwt.js';
import { getPrisma } from './lib/prisma.js';
import { setGeographyPoint } from './services/geocode.js';
import type { FastifyInstance } from 'fastify';

// Regression coverage for the "location-blind GET /jobs" bug: on Railway's
// stock Postgres (POSTGIS_ENABLED=false) the "geo" column never exists (see
// the postgis_geography migration's PostGIS-availability guard), so a
// ?lat&lng&radius search silently returned every job with zero filtering
// effect. The fix adds a plain-SQL Haversine fallback over jobs.lat/jobs.lng
// (populated unconditionally by setGeographyPoint) for use when PostGIS is
// off. This file exercises both the PostGIS path and the fallback path
// against the same fixtures so a regression on either one fails loudly.
//
// Columbus, OH vs. Seattle, WA — ~1,850 miles apart, well outside any
// reasonable test radius.
const COLUMBUS = { lat: 39.9612, lng: -82.9988 };
const SEATTLE = { lat: 47.6062, lng: -122.3321 };

describe('GET /jobs radius search (PostGIS + Haversine fallback)', () => {
  let app: FastifyInstance;
  const prisma = getPrisma();
  const stamp = Date.now();
  let employer: { id: string; token: string };
  let companyId: string;
  let tradeId: number;
  let nearJobId: string;
  let farJobId: string;
  const prevPostgisEnabled = process.env.POSTGIS_ENABLED;
  const prevStripeKey = process.env.STRIPE_SECRET_KEY;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    delete process.env.STRIPE_SECRET_KEY; // dev path → jobs publish `open` immediately
    app = await buildApp();

    const emp = await prisma.user.create({
      data: {
        firstName: 'Rhea',
        lastName: 'Radius',
        email: `rhea-radius-${stamp}@test.local`,
        role: 'employer',
        authProvider: 'email',
        passwordHash: 'not-a-real-hash',
      },
    });
    employer = { id: emp.id, token: signAccessToken(emp.id, 'employer') };

    const company = await prisma.company.create({
      data: {
        employerId: emp.id,
        name: 'Radius Testing Co',
        sizeRange: 'size_11_50',
        contactEmail: `co-radius-${stamp}@test.local`,
      },
    });
    companyId = company.id;

    const trade = await prisma.trade.findFirst();
    tradeId = trade!.id;

    async function postJob(city: string, state: string) {
      const res = await app.inject({
        method: 'POST',
        url: '/jobs',
        headers: { authorization: `Bearer ${employer.token}` },
        payload: {
          companyId,
          title: `Radius Test Role — ${city}`,
          tradeId,
          experienceLevel: 'years_3_5',
          payMin: 30,
          payMax: 45,
          jobType: 'full_time',
          workSetting: 'commercial',
          city,
          state,
          zipCode: '00000',
          description: 'A role posted for radius-search regression coverage',
          openingsCount: 1,
          planTier: 'basic',
        },
      });
      expect(res.statusCode).toBe(201);
      return res.json().id as string;
    }

    nearJobId = await postJob('Columbus', 'OH');
    farJobId = await postJob('Seattle', 'WA');

    // Pin exact coordinates (the real geocode service uses a hashed dev
    // offset, which would make distances non-deterministic for this test).
    // Calling this with POSTGIS_ENABLED at its current (unset → true)
    // default attempts to also write the "geo" column, exercising real
    // ST_DWithin/ST_Distance in the "PostGIS enabled" describe below — but
    // only on a database where that column genuinely exists (the real
    // PostGIS extension alone isn't enough; see docs/TESTING.md and
    // lib/postgis.ts's markGeoColumnMissing). Where it doesn't — e.g. this
    // repo's `prisma db push`-based test setup, which can't model the
    // PostGIS-only column — the write self-detects that and falls back,
    // so the "PostGIS enabled" describe below transparently runs over the
    // Haversine path too. Either way these assertions hold, since both
    // paths are expected to filter/sort/measure distance correctly.
    await setGeographyPoint(prisma, 'jobs', nearJobId, COLUMBUS);
    await setGeographyPoint(prisma, 'jobs', farJobId, SEATTLE);
  });

  afterAll(async () => {
    if (nearJobId) await prisma.job.delete({ where: { id: nearJobId } }).catch(() => {});
    if (farJobId) await prisma.job.delete({ where: { id: farJobId } }).catch(() => {});
    if (employer) await prisma.user.delete({ where: { id: employer.id } }).catch(() => {});
    if (prevPostgisEnabled === undefined) delete process.env.POSTGIS_ENABLED;
    else process.env.POSTGIS_ENABLED = prevPostgisEnabled;
    if (prevStripeKey === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = prevStripeKey;
    await app.close();
  });

  function searchFromColumbus(radius: number) {
    return app.inject({
      method: 'GET',
      url: `/jobs?lat=${COLUMBUS.lat}&lng=${COLUMBUS.lng}&radius=${radius}&limit=50`,
    });
  }

  describe('with PostGIS enabled (ST_DWithin/ST_Distance)', () => {
    beforeAll(() => {
      delete process.env.POSTGIS_ENABLED; // unset → default on
    });

    it('a 50-mile radius search only returns the near job, with a real distance', async () => {
      const res = await searchFromColumbus(50);
      expect(res.statusCode).toBe(200);
      const body = res.json();
      const ids = body.results.map((r: { id: string }) => r.id);
      expect(ids).toContain(nearJobId);
      expect(ids).not.toContain(farJobId);
      const near = body.results.find((r: { id: string }) => r.id === nearJobId);
      expect(near.distanceMiles).toBeLessThan(5);
    });

    it('a 500-mile radius search still excludes the ~1,850-mile-away Seattle job', async () => {
      const res = await searchFromColumbus(500); // schema max
      expect(res.statusCode).toBe(200);
      const body = res.json();
      const ids = body.results.map((r: { id: string }) => r.id);
      expect(ids).toContain(nearJobId);
      expect(ids).not.toContain(farJobId);
    });
  });

  describe('with PostGIS disabled (Haversine fallback over jobs.lat/jobs.lng)', () => {
    beforeAll(() => {
      process.env.POSTGIS_ENABLED = 'false';
    });

    it('a 50-mile radius search filters out the 1,850-mile-away job — the regression this fixes', async () => {
      const res = await searchFromColumbus(50);
      expect(res.statusCode).toBe(200);
      const body = res.json();
      const ids = body.results.map((r: { id: string }) => r.id);
      expect(ids).toContain(nearJobId);
      expect(ids).not.toContain(farJobId);
      const near = body.results.find((r: { id: string }) => r.id === nearJobId);
      expect(near.distanceMiles).toBeLessThan(5);
    });

    it('a 500-mile radius search still excludes the ~1,850-mile-away Seattle job', async () => {
      const res = await searchFromColumbus(500);
      expect(res.statusCode).toBe(200);
      const body = res.json();
      const ids = body.results.map((r: { id: string }) => r.id);
      expect(ids).toContain(nearJobId);
      expect(ids).not.toContain(farJobId);
    });

    it('without lat/lng, search is unaffected (no distance filtering applied)', async () => {
      const res = await app.inject({ method: 'GET', url: '/jobs?limit=50' });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      const ids = body.results.map((r: { id: string }) => r.id);
      expect(ids).toContain(nearJobId);
      expect(ids).toContain(farJobId);
      expect(body.results.every((r: { distanceMiles: number | null }) => r.distanceMiles === null)).toBe(
        true,
      );
    });
  });
});
