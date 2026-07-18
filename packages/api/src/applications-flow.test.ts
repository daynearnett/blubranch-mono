import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { buildApp } from './app.js';
import { signAccessToken } from './auth/jwt.js';
import { getPrisma } from './lib/prisma.js';
import type { FastifyInstance } from 'fastify';

// Requires a running Postgres with the BluBranch schema (same as messages.test).
// Covers the worker Quick Apply flow, including the phone-verification gate,
// duplicate-application guard, and the employer's applicant review + status
// update.

describe('Worker apply flow', () => {
  let app: FastifyInstance;
  const prisma = getPrisma();
  const stamp = Date.now();
  let employer: { id: string; token: string };
  let worker: { id: string; token: string };
  let jobId: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    app = await buildApp();

    const emp = await prisma.user.create({
      data: {
        firstName: 'Ed',
        lastName: 'Employer',
        email: `ed-apply-${stamp}@test.local`,
        role: 'employer',
        authProvider: 'email',
        passwordHash: 'not-a-real-hash',
      },
    });
    employer = { id: emp.id, token: signAccessToken(emp.id, 'employer') };

    const wrk = await prisma.user.create({
      data: {
        firstName: 'Will',
        lastName: 'Worker',
        email: `will-apply-${stamp}@test.local`,
        role: 'worker',
        authProvider: 'email',
        passwordHash: 'not-a-real-hash',
        phone: '+13125550100',
        phoneVerified: false,
        workerProfile: {
          create: {
            experienceLevel: 'years_3_5',
            city: 'Chicago',
            state: 'IL',
            zipCode: '60601',
            travelRadiusMiles: 25,
            jobAvailability: 'open',
          },
        },
      },
    });
    worker = { id: wrk.id, token: signAccessToken(wrk.id, 'worker') };

    const trade = await prisma.trade.findFirst();
    const company = await prisma.company.create({
      data: {
        employerId: emp.id,
        name: 'Apply Test Co',
        sizeRange: 'size_1_10',
        contactEmail: `co-apply-${stamp}@test.local`,
      },
    });
    const job = await prisma.job.create({
      data: {
        employerId: emp.id,
        companyId: company.id,
        title: 'Commercial Electrician',
        tradeId: trade!.id,
        experienceLevel: 'years_3_5',
        payMin: 32,
        payMax: 48,
        jobType: 'full_time',
        workSetting: 'commercial',
        city: 'Chicago',
        state: 'IL',
        zipCode: '60601',
        description: 'Open role for testing the apply flow',
        status: 'open',
        planTier: 'basic',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
    jobId = job.id;
  });

  afterAll(async () => {
    if (employer) await prisma.user.delete({ where: { id: employer.id } }).catch(() => {});
    if (worker) await prisma.user.delete({ where: { id: worker.id } }).catch(() => {});
    await app.close();
  });

  it('POST /jobs/:id/apply — blocked 403 until the phone is verified', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/jobs/${jobId}/apply`,
      headers: { authorization: `Bearer ${worker.token}` },
      payload: { message: 'Keen to help.' },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe('PhoneVerificationRequired');
  });

  it('POST /jobs/:id/apply — an employer cannot apply (role-gated 403)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/jobs/${jobId}/apply`,
      headers: { authorization: `Bearer ${employer.token}` },
      payload: {},
    });
    expect(res.statusCode).toBe(403);
  });

  it('POST /jobs/:id/apply — succeeds once the phone is verified', async () => {
    await prisma.user.update({
      where: { id: worker.id },
      data: { phoneVerified: true },
    });
    const res = await app.inject({
      method: 'POST',
      url: `/jobs/${jobId}/apply`,
      headers: { authorization: `Bearer ${worker.token}` },
      payload: { message: 'Keen to help.' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().status).toBe('applied');
  });

  it('POST /jobs/:id/apply — a duplicate application is rejected 409', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/jobs/${jobId}/apply`,
      headers: { authorization: `Bearer ${worker.token}` },
      payload: {},
    });
    expect(res.statusCode).toBe(409);
  });

  it('GET /users/me/applications — worker sees their application', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/users/me/applications',
      headers: { authorization: `Bearer ${worker.token}` },
    });
    expect(res.statusCode).toBe(200);
    const apps = res.json();
    expect(apps.length).toBe(1);
    expect(apps[0].job.id).toBe(jobId);
  });

  it('GET /jobs/:id/applications — employer reviews the applicant list', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/jobs/${jobId}/applications`,
      headers: { authorization: `Bearer ${employer.token}` },
    });
    expect(res.statusCode).toBe(200);
    const apps = res.json();
    expect(apps.length).toBe(1);
    expect(apps[0].worker.id).toBe(worker.id);
  });

  it('PUT /jobs/:id/applications/:applicationId — employer updates status to hired', async () => {
    const application = await prisma.jobApplication.findFirst({
      where: { jobId, workerId: worker.id },
    });
    const res = await app.inject({
      method: 'PUT',
      url: `/jobs/${jobId}/applications/${application!.id}`,
      headers: { authorization: `Bearer ${employer.token}` },
      payload: { status: 'hired' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('hired');
  });

  it('GET /jobs/:id/stats — requires auth (401)', async () => {
    const res = await app.inject({ method: 'GET', url: `/jobs/${jobId}/stats` });
    expect(res.statusCode).toBe(401);
  });

  it('GET /jobs/:id/stats — non-owner is rejected (403)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/jobs/${jobId}/stats`,
      headers: { authorization: `Bearer ${worker.token}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('GET /jobs/:id/stats — unknown job is 404 for its owner-check', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/jobs/00000000-0000-0000-0000-000000000000/stats',
      headers: { authorization: `Bearer ${employer.token}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it('GET /jobs/:id/stats — owner gets a cumulative daily series including the applicant', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/jobs/${jobId}/stats`,
      headers: { authorization: `Bearer ${employer.token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body.series)).toBe(true);
    expect(body.series.length).toBeGreaterThan(0);
    const last = body.series[body.series.length - 1];
    expect(last).toHaveProperty('date');
    expect(last).toHaveProperty('views');
    // The worker applied earlier in this file → cumulative applicants ends ≥ 1.
    expect(last.applicants).toBeGreaterThanOrEqual(1);
    // Cumulative: each point is monotonically non-decreasing.
    for (let i = 1; i < body.series.length; i += 1) {
      expect(body.series[i].views).toBeGreaterThanOrEqual(body.series[i - 1].views);
      expect(body.series[i].applicants).toBeGreaterThanOrEqual(body.series[i - 1].applicants);
    }
  });

  it('POST /jobs/:id/apply — cannot apply to a closed job (400)', async () => {
    const trade = await prisma.trade.findFirst();
    const company = await prisma.company.findFirst({ where: { employerId: employer.id } });
    const closed = await prisma.job.create({
      data: {
        employerId: employer.id,
        companyId: company!.id,
        title: 'Closed Role',
        tradeId: trade!.id,
        experienceLevel: 'years_3_5',
        payMin: 30,
        payMax: 40,
        jobType: 'full_time',
        workSetting: 'commercial',
        city: 'Chicago',
        state: 'IL',
        zipCode: '60601',
        description: 'This job is closed',
        status: 'closed',
        planTier: 'basic',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
    const res = await app.inject({
      method: 'POST',
      url: `/jobs/${closed.id}/apply`,
      headers: { authorization: `Bearer ${worker.token}` },
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });
});
