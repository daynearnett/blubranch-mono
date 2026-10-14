import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { buildApp } from './app.js';
import { signAccessToken } from './auth/jwt.js';
import { getPrisma } from './lib/prisma.js';
import type { FastifyInstance } from 'fastify';

// Requires a running Postgres with the BluBranch schema.
//
// The Quick Apply readiness gate: a worker can't apply until their profile
// carries the fields the employer's applicant card renders. Each requirement
// is asserted to block on its own, then the gate is walked to green and the
// apply succeeds — the "works forever after" promise.

describe('Quick Apply readiness gate', () => {
  let app: FastifyInstance;
  const prisma = getPrisma();
  const stamp = Date.now();
  let worker: { id: string; token: string };
  let employerId: string;
  let jobId: string;
  let tradeId: number;

  const readiness = async () =>
    app
      .inject({
        method: 'GET',
        url: '/users/me/apply-readiness',
        headers: { authorization: `Bearer ${worker.token}` },
      })
      .then((r) => r.json());

  const apply = async () =>
    app.inject({
      method: 'POST',
      url: `/jobs/${jobId}/apply`,
      headers: { authorization: `Bearer ${worker.token}` },
      payload: {},
    });

  /** Put the worker in a fully-ready state, then knock out one requirement. */
  const onlyMissing = async (key: string) => {
    await prisma.user.update({
      where: { id: worker.id },
      data: {
        phoneVerified: key !== 'phone',
        profilePhotoUrl: key === 'photo' ? null : 'https://example.test/a.jpg',
        workerProfile: {
          update: {
            headline: key === 'headline' ? null : 'Journeyman electrician',
            city: key === 'location' ? '' : 'Columbus',
            state: key === 'location' ? '' : 'OH',
            currentCompany: key === 'experience' ? null : 'Morrow Electric',
            currentTitle: key === 'experience' ? null : 'Electrician',
            jobAvailability: key === 'experience' ? 'open' : 'actively_looking',
          },
        },
      },
    });
    if (key === 'trade') {
      await prisma.userTrade.deleteMany({ where: { userId: worker.id } });
    } else {
      await prisma.userTrade.upsert({
        where: { userId_tradeId: { userId: worker.id, tradeId } },
        create: { userId: worker.id, tradeId },
        update: {},
      });
    }
  };

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    app = await buildApp();

    const trade = await prisma.trade.findFirstOrThrow();
    tradeId = trade.id;

    const emp = await prisma.user.create({
      data: {
        firstName: 'Ready',
        lastName: 'Employer',
        email: `ready-emp-${stamp}@test.local`,
        role: 'employer',
        authProvider: 'email',
        passwordHash: 'not-a-real-hash',
      },
    });
    employerId = emp.id;

    const wrk = await prisma.user.create({
      data: {
        firstName: 'Blank',
        lastName: 'Worker',
        email: `ready-wrk-${stamp}@test.local`,
        role: 'worker',
        authProvider: 'email',
        passwordHash: 'not-a-real-hash',
        workerProfile: {
          create: {
            experienceLevel: 'years_0_2',
            city: '',
            state: '',
            zipCode: '',
            travelRadiusMiles: 25,
            jobAvailability: 'open',
          },
        },
      },
    });
    worker = { id: wrk.id, token: signAccessToken(wrk.id, 'worker') };

    const company = await prisma.company.create({
      data: {
        employerId: emp.id,
        name: 'Readiness Test Co',
        sizeRange: 'size_1_10',
        contactEmail: `ready-co-${stamp}@test.local`,
      },
    });
    const job = await prisma.job.create({
      data: {
        employerId: emp.id,
        companyId: company.id,
        title: 'Service Electrician',
        tradeId,
        experienceLevel: 'years_0_2',
        payMin: 26,
        payMax: 34,
        jobType: 'full_time',
        workSetting: 'residential',
        city: 'Columbus',
        state: 'OH',
        zipCode: '43215',
        description: 'Readiness gate fixture',
        status: 'open',
        planTier: 'basic',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
    jobId = job.id;
  });

  afterAll(async () => {
    if (worker) await prisma.user.delete({ where: { id: worker.id } }).catch(() => {});
    if (employerId) await prisma.user.delete({ where: { id: employerId } }).catch(() => {});
    await app.close();
  });

  it('a brand-new worker is missing every requirement', async () => {
    const body = await readiness();
    expect(body.ready).toBe(false);
    expect(body.missing.map((m: { key: string }) => m.key).sort()).toEqual([
      'experience',
      'headline',
      'location',
      'phone',
      'photo',
      'trade',
    ]);
    // Each row carries the copy + route the gate sheet renders.
    for (const m of body.missing) {
      expect(m.label).toBeTruthy();
      expect(m.hint).toBeTruthy();
      expect(m.route).toMatch(/^\/\(app\)\//);
    }
  });

  it('apply is refused with ProfileIncomplete and the missing list', async () => {
    const res = await apply();
    expect(res.statusCode).toBe(403);
    const body = res.json();
    expect(body.error).toBe('ProfileIncomplete');
    expect(body.missing.length).toBe(6);
    // Older clients only render `message` — it has to stand on its own.
    expect(body.message).toMatch(/finish your profile/i);
  });

  it.each(['photo', 'headline', 'trade', 'location', 'experience'])(
    'a missing %s alone blocks apply',
    async (key) => {
      await onlyMissing(key);
      const body = await readiness();
      expect(body.ready).toBe(false);
      expect(body.missing.map((m: { key: string }) => m.key)).toEqual([key]);

      const res = await apply();
      expect(res.statusCode).toBe(403);
      expect(res.json().error).toBe('ProfileIncomplete');
    },
  );

  it('a missing phone alone keeps the legacy code for older builds', async () => {
    await onlyMissing('phone');
    const res = await apply();
    expect(res.statusCode).toBe(403);
    // Builds already on TestFlight match on this code to route to verify-phone.
    expect(res.json().error).toBe('PhoneVerificationRequired');
    expect(res.json().missing.map((m: { key: string }) => m.key)).toEqual(['phone']);
  });

  it('a complete profile is ready, and apply succeeds', async () => {
    await onlyMissing('none');
    const body = await readiness();
    expect(body.ready).toBe(true);
    expect(body.missing).toEqual([]);
    expect(body.satisfied.length).toBe(6);

    const res = await apply();
    expect(res.statusCode).toBe(201);
    expect(res.json().status).toBe('applied');
  });

  it('readiness stays green on later jobs — the gate does not reappear', async () => {
    const second = await prisma.job.create({
      data: {
        employerId,
        companyId: (await prisma.company.findFirstOrThrow({ where: { employerId } })).id,
        title: 'Apprentice Electrician',
        tradeId,
        experienceLevel: 'years_0_2',
        payMin: 20,
        payMax: 26,
        jobType: 'full_time',
        workSetting: 'residential',
        city: 'Columbus',
        state: 'OH',
        zipCode: '43215',
        description: 'Second job, same worker',
        status: 'open',
        planTier: 'basic',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
    const res = await app.inject({
      method: 'POST',
      url: `/jobs/${second.id}/apply`,
      headers: { authorization: `Bearer ${worker.token}` },
      payload: {},
    });
    expect(res.statusCode).toBe(201);
  });

  it('"actively looking" satisfies the experience requirement with no job history', async () => {
    await prisma.workerProfile.update({
      where: { userId: worker.id },
      data: {
        currentCompany: null,
        currentTitle: null,
        jobAvailability: 'actively_looking',
      },
    });
    const body = await readiness();
    expect(body.ready).toBe(true);
  });

  it('admins are never gated', async () => {
    const admin = await prisma.user.create({
      data: {
        firstName: 'Ada',
        lastName: 'Admin',
        email: `ready-admin-${stamp}@test.local`,
        role: 'admin',
        authProvider: 'email',
        passwordHash: 'not-a-real-hash',
      },
    });
    const res = await app.inject({
      method: 'GET',
      url: '/users/me/apply-readiness',
      headers: { authorization: `Bearer ${signAccessToken(admin.id, 'admin')}` },
    });
    expect(res.json().ready).toBe(true);
    await prisma.user.delete({ where: { id: admin.id } }).catch(() => {});
  });

  it('GET /users/me/apply-readiness requires auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/users/me/apply-readiness' });
    expect(res.statusCode).toBe(401);
  });
});
