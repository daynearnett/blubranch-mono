import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import type Stripe from 'stripe';
import { buildApp } from './app.js';
import { signAccessToken } from './auth/jwt.js';
import { getPrisma } from './lib/prisma.js';
import {
  hasActiveSubscription,
  publishJobForPayment,
  syncSubscription,
} from './routes/payments.js';
import type { FastifyInstance } from 'fastify';

// Requires a running Postgres with the BluBranch schema (same as messages.test).
// These tests exercise the payment helpers + route guards WITHOUT live Stripe.

describe('Phase 5 payments', () => {
  let app: FastifyInstance;
  let employer: { id: string; token: string };
  let companyId: string;
  let draftJobId: string;
  const prisma = getPrisma();
  const stamp = Date.now();

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    app = await buildApp();

    const user = await prisma.user.create({
      data: {
        firstName: 'Emma',
        lastName: 'PayTest',
        email: `emma-pay-${stamp}@test.local`,
        role: 'employer',
        authProvider: 'email',
        passwordHash: 'not-a-real-hash',
      },
    });
    employer = { id: user.id, token: signAccessToken(user.id, 'employer') };

    const trade = await prisma.trade.findFirst();
    const company = await prisma.company.create({
      data: {
        employerId: user.id,
        name: 'PayTest Co',
        sizeRange: 'size_1_10',
        contactEmail: `co-${stamp}@test.local`,
      },
    });
    companyId = company.id;

    const job = await prisma.job.create({
      data: {
        employerId: user.id,
        companyId: company.id,
        title: 'Test Electrician',
        tradeId: trade!.id,
        experienceLevel: 'years_3_5',
        payMin: 30,
        payMax: 45,
        jobType: 'full_time',
        workSetting: 'commercial',
        city: 'Chicago',
        state: 'IL',
        zipCode: '60601',
        description: 'Draft job awaiting payment',
        status: 'draft',
        planTier: 'pro',
        expiresAt: new Date(),
      },
    });
    draftJobId = job.id;
  });

  afterAll(async () => {
    if (employer) await prisma.user.delete({ where: { id: employer.id } }).catch(() => {});
    await app.close();
  });

  it('publishJobForPayment flips draft → open and is idempotent', async () => {
    await prisma.payment.create({
      data: {
        userId: employer.id,
        jobId: draftJobId,
        stripePaymentIntentId: `pi_test_${stamp}`,
        amount: 12900,
        currency: 'usd',
        plan: 'pro',
        status: 'processing',
      },
    });

    await publishJobForPayment(prisma, { jobId: draftJobId, paymentIntentId: `pi_test_${stamp}` });
    let job = await prisma.job.findUnique({ where: { id: draftJobId } });
    expect(job!.status).toBe('open');
    expect(job!.stripePaymentId).toBe(`pi_test_${stamp}`);
    const payment = await prisma.payment.findUnique({
      where: { stripePaymentIntentId: `pi_test_${stamp}` },
    });
    expect(payment!.status).toBe('succeeded');

    // Second call must be a no-op (still open, no throw).
    await publishJobForPayment(prisma, { jobId: draftJobId, paymentIntentId: `pi_test_${stamp}` });
    job = await prisma.job.findUnique({ where: { id: draftJobId } });
    expect(job!.status).toBe('open');
  });

  it('syncSubscription upserts status and drives hasActiveSubscription', async () => {
    const fakeActive = {
      id: `sub_test_${stamp}`,
      status: 'active',
      customer: `cus_test_${stamp}`,
      cancel_at_period_end: false,
      metadata: { userId: employer.id },
      items: { data: [{ current_period_end: Math.floor(Date.now() / 1000) + 86400 }] },
    } as unknown as Stripe.Subscription;

    await syncSubscription(prisma, fakeActive);
    expect(await hasActiveSubscription(prisma, employer.id)).toBe(true);
    const row = await prisma.subscription.findUnique({ where: { userId: employer.id } });
    expect(row!.stripeSubscriptionId).toBe(`sub_test_${stamp}`);
    expect(row!.currentPeriodEnd).not.toBeNull();

    const fakeCanceled = { ...fakeActive, status: 'canceled' } as unknown as Stripe.Subscription;
    await syncSubscription(prisma, fakeCanceled);
    expect(await hasActiveSubscription(prisma, employer.id)).toBe(false);
  });

  it('GET /payments/subscription reflects the synced row', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/payments/subscription',
      headers: { authorization: `Bearer ${employer.token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().active).toBe(false);
    expect(res.json().status).toBe('canceled');
  });

  it('GET /payments/config returns a (possibly empty) publishable key', async () => {
    const res = await app.inject({ method: 'GET', url: '/payments/config' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveProperty('publishableKey');
  });

  it('payment routes 503 when Stripe is not configured', async () => {
    // No STRIPE_SECRET_KEY in the test env → guarded routes degrade cleanly.
    const intent = await app.inject({
      method: 'POST',
      url: `/payments/jobs/${draftJobId}/intent`,
      headers: { authorization: `Bearer ${employer.token}` },
    });
    expect(intent.statusCode).toBe(503);

    const hook = await app.inject({
      method: 'POST',
      url: '/webhooks/stripe',
      headers: { 'content-type': 'application/json' },
      payload: { hello: 'world' },
    });
    expect(hook.statusCode).toBe(503);
  });

  it('requires auth on subscription status', async () => {
    const res = await app.inject({ method: 'GET', url: '/payments/subscription' });
    expect(res.statusCode).toBe(401);
  });

  // With Stripe "configured", POST /jobs gates by plan BEFORE calling Stripe:
  // Basic/Pro → draft (awaiting one-time payment); Unlimited w/o an active sub
  // → 402. Setting a non-placeholder key flips isStripeConfigured() without any
  // network call (the create path doesn't touch the Stripe API).
  describe('POST /jobs payment gating (stripe configured)', () => {
    const prevKey = process.env.STRIPE_SECRET_KEY;
    beforeAll(() => {
      process.env.STRIPE_SECRET_KEY = 'sk_test_dummy_configured_for_gating';
    });
    afterAll(() => {
      if (prevKey === undefined) delete process.env.STRIPE_SECRET_KEY;
      else process.env.STRIPE_SECRET_KEY = prevKey;
    });

    async function postJob(planTier: 'basic' | 'pro' | 'unlimited') {
      const trade = await prisma.trade.findFirst();
      return app.inject({
        method: 'POST',
        url: '/jobs',
        headers: { authorization: `Bearer ${employer.token}` },
        payload: {
          companyId,
          title: `Gating ${planTier}`,
          tradeId: trade!.id,
          experienceLevel: 'years_3_5',
          payMin: 30,
          payMax: 45,
          jobType: 'full_time',
          workSetting: 'commercial',
          city: 'Chicago',
          state: 'IL',
          zipCode: '60601',
          description: 'Gating test',
          openingsCount: 1,
          planTier,
          status: 'open',
        },
      });
    }

    it('Basic plan → job created as draft (awaiting payment)', async () => {
      const res = await postJob('basic');
      expect(res.statusCode).toBe(201);
      expect(res.json().status).toBe('draft');
    });

    it('Unlimited plan without an active subscription → 402', async () => {
      const res = await postJob('unlimited');
      expect(res.statusCode).toBe(402);
      expect(res.json().reason).toBe('subscription_required');
    });
  });
});
