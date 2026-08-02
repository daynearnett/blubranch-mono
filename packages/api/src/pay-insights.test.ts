import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { buildApp } from './app.js';
import { signAccessToken } from './auth/jwt.js';
import { getPrisma } from './lib/prisma.js';
import type { FastifyInstance } from 'fastify';

// Requires a running Postgres with the BluBranch schema. Covers wage
// transparency Phase 0 (E3): hourly-only aggregates by trade + state with the
// n>=5 gate, and payPeriod persisting on job create.

describe('Pay insights — posted-pay aggregates', () => {
  let app: FastifyInstance;
  const prisma = getPrisma();
  const stamp = Date.now();
  const state = `ZZ${String(stamp).slice(-3)}`; // synthetic state to isolate the aggregate
  let worker: { id: string; token: string };
  let employerId: string;
  let tradeId: number;
  let companyId: string;
  const jobIds: string[] = [];

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    app = await buildApp();

    const trade = await prisma.trade.findFirst();
    tradeId = trade!.id;

    const w = await prisma.user.create({
      data: {
        firstName: 'Wage',
        lastName: 'Watcher',
        email: `wage-worker-${stamp}@test.local`,
        role: 'worker',
        authProvider: 'email',
        passwordHash: 'not-a-real-hash',
        trades: { create: { tradeId } },
        workerProfile: {
          create: {
            experienceLevel: 'years_3_5',
            city: 'Testville',
            state,
            zipCode: '00000',
            travelRadiusMiles: 25,
            jobAvailability: 'open',
          },
        },
      },
    });
    worker = { id: w.id, token: signAccessToken(w.id, 'worker') };

    const e = await prisma.user.create({
      data: {
        firstName: 'Wage',
        lastName: 'Employer',
        email: `wage-employer-${stamp}@test.local`,
        role: 'employer',
        authProvider: 'email',
        passwordHash: 'not-a-real-hash',
      },
    });
    employerId = e.id;
    const company = await prisma.company.create({
      data: {
        employerId,
        name: `WageCo ${stamp}`,
        sizeRange: 'size_1_10',
        contactEmail: `wageco-${stamp}@test.local`,
      },
    });
    companyId = company.id;

    // 5 hourly postings ($30–40 min, $40–50 max) + 1 salary posting that must
    // NOT poison the aggregate + 1 draft that must be excluded.
    for (let i = 0; i < 5; i++) {
      const j = await prisma.job.create({
        data: {
          employerId,
          companyId,
          title: `Hourly job ${i}`,
          tradeId,
          experienceLevel: 'any',
          payMin: 30 + i * 2.5,
          payMax: 40 + i * 2.5,
          payPeriod: 'hourly',
          jobType: 'full_time',
          workSetting: 'commercial',
          city: 'Testville',
          state,
          zipCode: '00000',
          description: 'test',
          status: 'open',
          planTier: 'basic',
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });
      jobIds.push(j.id);
    }
    const salary = await prisma.job.create({
      data: {
        employerId,
        companyId,
        title: 'Salary job',
        tradeId,
        experienceLevel: 'any',
        payMin: 80000,
        payMax: 95000,
        payPeriod: 'salary',
        jobType: 'full_time',
        workSetting: 'commercial',
        city: 'Testville',
        state,
        zipCode: '00000',
        description: 'test',
        status: 'open',
        planTier: 'basic',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
    jobIds.push(salary.id);
  });

  afterAll(async () => {
    await prisma.job.deleteMany({ where: { id: { in: jobIds } } }).catch(() => {});
    await prisma.company.delete({ where: { id: companyId } }).catch(() => {});
    if (worker) await prisma.user.delete({ where: { id: worker.id } }).catch(() => {});
    if (employerId) await prisma.user.delete({ where: { id: employerId } }).catch(() => {});
    await app.close();
  });

  it('aggregates hourly postings only, defaulting to the caller trade + state', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/jobs/pay-insights',
      headers: { authorization: `Bearer ${worker.token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.state).toBe(state);
    expect(body.n).toBe(5); // the salary posting is excluded
    expect(body.hourly.medianMin).toBe(35); // 30,32.5,35,37.5,40
    expect(body.hourly.medianMax).toBe(45);
    expect(body.hourly.avgMin).toBeCloseTo(35, 5);
  });

  it('gates below n=5 (insufficient, no figures leaked)', async () => {
    // Demote one hourly posting to draft → only 4 countable.
    await prisma.job.update({ where: { id: jobIds[0]! }, data: { status: 'draft' } });
    const res = await app.inject({
      method: 'GET',
      url: '/jobs/pay-insights',
      headers: { authorization: `Bearer ${worker.token}` },
    });
    expect(res.json().insufficient).toBe(true);
    expect(res.json().hourly).toBeUndefined();
    await prisma.job.update({ where: { id: jobIds[0]! }, data: { status: 'open' } });
  });

  it('POST /jobs persists payPeriod (and defaults to hourly when omitted)', async () => {
    const employerToken = signAccessToken(employerId, 'employer');
    const base = {
      companyId,
      title: 'Route-created job',
      tradeId,
      experienceLevel: 'any',
      payMin: 33,
      payMax: 44,
      jobType: 'full_time',
      city: 'Testville',
      state,
      zipCode: '00000',
      description: 'route test',
      planTier: 'basic',
    };

    const defaulted = await app.inject({
      method: 'POST',
      url: '/jobs',
      headers: { authorization: `Bearer ${employerToken}` },
      payload: base,
    });
    expect(defaulted.statusCode).toBe(201);
    jobIds.push(defaulted.json().id);
    const row1 = await prisma.job.findUnique({ where: { id: defaulted.json().id } });
    expect(row1!.payPeriod).toBe('hourly');

    const salaried = await app.inject({
      method: 'POST',
      url: '/jobs',
      headers: { authorization: `Bearer ${employerToken}` },
      payload: { ...base, title: 'Salaried route job', payPeriod: 'salary' },
    });
    expect(salaried.statusCode).toBe(201);
    jobIds.push(salaried.json().id);
    const row2 = await prisma.job.findUnique({ where: { id: salaried.json().id } });
    expect(row2!.payPeriod).toBe('salary');
  });

  it('explicit tradeId + state params override the defaults', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/jobs/pay-insights?tradeId=${tradeId}&state=NOWHERE`,
      headers: { authorization: `Bearer ${worker.token}` },
    });
    expect(res.json().n).toBe(0);
    expect(res.json().insufficient).toBe(true);
  });
});
