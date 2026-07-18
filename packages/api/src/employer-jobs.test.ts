import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { buildApp } from './app.js';
import { signAccessToken } from './auth/jwt.js';
import { getPrisma } from './lib/prisma.js';
import { planTtlDays } from './lib/plans.js';
import type { FastifyInstance } from 'fastify';

// Requires a running Postgres with the BluBranch schema (same as messages.test).
//
// Covers the employer job-posting flow across all three plan tiers on the
// DEV/self-host path (Stripe NOT configured → jobs publish as `open`
// immediately, preserving pre-Phase-5 behavior). Plan → product-name mapping:
//   • basic     = "Basic"   ($19 / post)   — no featured/urgent boosts
//   • pro       = "Blu"     ($199 / month) — boosts honored
//   • unlimited = "Blu Max" ($299 / month) — boosts honored
//
// Payment GATING (draft/402 when Stripe IS configured) is covered separately in
// payments.test.ts. This file locks in the create semantics + boost rules.

describe('Employer job posting (by plan tier)', () => {
  let app: FastifyInstance;
  const prisma = getPrisma();
  const stamp = Date.now();
  let employer: { id: string; token: string };
  let companyId: string;
  let tradeId: number;
  const prevStripeKey = process.env.STRIPE_SECRET_KEY;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    // Force the dev path (Stripe unconfigured) so posts publish immediately,
    // independent of whatever is in the developer's local .env.
    delete process.env.STRIPE_SECRET_KEY;
    app = await buildApp();

    const emp = await prisma.user.create({
      data: {
        firstName: 'Ivan',
        lastName: 'Hirer',
        email: `ivan-jobs-${stamp}@test.local`,
        role: 'employer',
        authProvider: 'email',
        passwordHash: 'not-a-real-hash',
      },
    });
    employer = { id: emp.id, token: signAccessToken(emp.id, 'employer') };

    const company = await prisma.company.create({
      data: {
        employerId: emp.id,
        name: 'Hirer Industries',
        sizeRange: 'size_11_50',
        contactEmail: `co-jobs-${stamp}@test.local`,
      },
    });
    companyId = company.id;

    const trade = await prisma.trade.findFirst();
    tradeId = trade!.id;
  });

  afterAll(async () => {
    if (employer) await prisma.user.delete({ where: { id: employer.id } }).catch(() => {});
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
        payMin: 30,
        payMax: 45,
        jobType: 'full_time',
        workSetting: 'commercial',
        city: 'Chicago',
        state: 'IL',
        zipCode: '60601',
        description: 'A role posted in a plan-tier test',
        openingsCount: 2,
        ...overrides,
      },
    });
  }

  it('Basic plan — publishes open with a 30-day TTL', async () => {
    const res = await postJob({ planTier: 'basic', title: 'Basic Post' });
    expect(res.statusCode).toBe(201);
    const job = res.json();
    expect(job.status).toBe('open');
    expect(job.planTier).toBe('basic');

    const created = new Date(job.createdAt).getTime();
    const expires = new Date(job.expiresAt).getTime();
    const days = Math.round((expires - created) / (24 * 60 * 60 * 1000));
    expect(days).toBe(planTtlDays('basic')); // 30
  });

  it('Basic plan — boosts are NOT applied (featured/urgent stripped)', async () => {
    const res = await postJob({
      planTier: 'basic',
      title: 'Basic No-Boost',
      boostFeaturedPlacement: true,
      isUrgent: true,
      boostPushNotification: true,
    });
    expect(res.statusCode).toBe(201);
    const job = res.json();
    expect(job.isFeatured).toBe(false);
    expect(job.isUrgent).toBe(false);
    expect(job.boostPushNotification).toBe(false);
  });

  it('Blu plan (pro) — publishes open with a 60-day TTL and honors boosts', async () => {
    const res = await postJob({
      planTier: 'pro',
      title: 'Blu Post',
      boostFeaturedPlacement: true,
      isUrgent: true,
    });
    expect(res.statusCode).toBe(201);
    const job = res.json();
    expect(job.status).toBe('open');
    expect(job.planTier).toBe('pro');
    expect(job.isFeatured).toBe(true);
    expect(job.isUrgent).toBe(true);

    const days = Math.round(
      (new Date(job.expiresAt).getTime() - new Date(job.createdAt).getTime()) /
        (24 * 60 * 60 * 1000),
    );
    expect(days).toBe(planTtlDays('pro')); // 60
  });

  it('Blu Max plan (unlimited) — publishes open with a 60-day TTL and honors boosts', async () => {
    const res = await postJob({
      planTier: 'unlimited',
      title: 'Blu Max Post',
      boostFeaturedPlacement: true,
    });
    expect(res.statusCode).toBe(201);
    const job = res.json();
    expect(job.status).toBe('open');
    expect(job.planTier).toBe('unlimited');
    expect(job.isFeatured).toBe(true);

    const days = Math.round(
      (new Date(job.expiresAt).getTime() - new Date(job.createdAt).getTime()) /
        (24 * 60 * 60 * 1000),
    );
    expect(days).toBe(planTtlDays('unlimited')); // 60
  });

  it('rejects payMax < payMin with 400', async () => {
    const res = await postJob({ planTier: 'basic', payMin: 50, payMax: 20 });
    expect(res.statusCode).toBe(400);
  });

  it('rejects posting to a company the employer does not own (403)', async () => {
    const other = await prisma.user.create({
      data: {
        firstName: 'Other',
        lastName: 'Owner',
        email: `other-jobs-${stamp}@test.local`,
        role: 'employer',
        authProvider: 'email',
        passwordHash: 'not-a-real-hash',
      },
    });
    const otherCompany = await prisma.company.create({
      data: {
        employerId: other.id,
        name: 'Not Yours LLC',
        sizeRange: 'size_1_10',
        contactEmail: `other-co-${stamp}@test.local`,
      },
    });
    try {
      const res = await postJob({ planTier: 'basic', companyId: otherCompany.id });
      expect(res.statusCode).toBe(403);
    } finally {
      await prisma.user.delete({ where: { id: other.id } }).catch(() => {});
    }
  });

  it('POST /jobs requires auth', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/jobs',
      payload: { companyId, title: 'x', tradeId, planTier: 'basic' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('rejects an unknown company with 400', async () => {
    const res = await postJob({
      planTier: 'basic',
      companyId: '00000000-0000-0000-0000-000000000000',
    });
    expect(res.statusCode).toBe(400);
  });
});
