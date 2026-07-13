import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { buildApp } from './app.js';
import { getPrisma } from './lib/prisma.js';
import type { FastifyInstance } from 'fastify';

// End-to-end walk of the critical marketplace path through the real HTTP routes:
//   signup (worker + employer) → employer posts a job → worker applies →
//   employer sees the applicant → the two message each other.
//
// Payment with the 4242 card is exercised separately against REAL Stripe
// test-mode by scripts/stripe-e2e.ts (wired into CI, gated on STRIPE_SECRET_KEY),
// because it needs the live Stripe API. Here Stripe is unconfigured, so a posted
// job goes live immediately — keeping this flow deterministic and offline.
describe('E2E — signup → post job → apply → message', () => {
  let app: FastifyInstance;
  const prisma = getPrisma();
  const stamp = Date.now();

  let workerToken = '';
  let workerId = '';
  let employerToken = '';
  let employerId = '';
  let jobId = '';
  let conversationId = '';

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    // Ensure Stripe is treated as unconfigured for the deterministic job path.
    delete process.env.STRIPE_SECRET_KEY;
    app = await buildApp();
  });

  afterAll(async () => {
    for (const id of [workerId, employerId]) {
      if (id) await prisma.user.delete({ where: { id } }).catch(() => {});
    }
    await app.close();
  });

  it('1. a worker signs up', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        firstName: 'Wanda',
        lastName: 'Welder',
        email: `wanda-e2e-${stamp}@test.local`,
        password: 'Str0ng-e2e-pass!',
        role: 'worker',
        termsAccepted: true,
      },
    });
    expect(res.statusCode).toBe(201);
    workerToken = res.json().accessToken;
    workerId = res.json().user.id;
    expect(workerToken).toBeTruthy();
  });

  it('2. an employer signs up', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        firstName: 'Erik',
        lastName: 'Employer',
        email: `erik-e2e-${stamp}@test.local`,
        password: 'Str0ng-e2e-pass!',
        role: 'employer',
        termsAccepted: true,
      },
    });
    expect(res.statusCode).toBe(201);
    employerToken = res.json().accessToken;
    employerId = res.json().user.id;
  });

  it('3. the employer creates a company and posts a job (goes live)', async () => {
    const company = await app.inject({
      method: 'POST',
      url: '/companies',
      headers: { authorization: `Bearer ${employerToken}` },
      payload: {
        name: 'E2E Electric Co',
        sizeRange: 'size_1_10',
        contactEmail: `co-e2e-${stamp}@test.local`,
      },
    });
    expect(company.statusCode).toBe(201);
    const companyId = company.json().id;

    const trade = await prisma.trade.findFirst();
    expect(trade).not.toBeNull();

    const job = await app.inject({
      method: 'POST',
      url: '/jobs',
      headers: { authorization: `Bearer ${employerToken}` },
      payload: {
        companyId,
        title: 'Journeyman Electrician',
        tradeId: trade!.id,
        experienceLevel: 'years_3_5',
        payMin: 32,
        payMax: 48,
        jobType: 'full_time',
        city: 'Chicago',
        state: 'IL',
        zipCode: '60601',
        description: 'Commercial electrical work, immediate start.',
        openingsCount: 2,
        planTier: 'basic',
        status: 'open',
      },
    });
    expect(job.statusCode).toBe(201);
    expect(job.json().status).toBe('open'); // no Stripe configured → live immediately
    jobId = job.json().id;
  });

  it('4. the worker verifies their phone and applies', async () => {
    // Applying is gated behind SMS phone verification. The verify flow itself is
    // covered elsewhere; here we mark the worker verified to exercise the apply.
    await prisma.user.update({ where: { id: workerId }, data: { phoneVerified: true } });

    const res = await app.inject({
      method: 'POST',
      url: `/jobs/${jobId}/apply`,
      headers: { authorization: `Bearer ${workerToken}` },
      payload: { coverNote: 'Licensed journeyman, 5 years commercial.' },
    });
    expect(res.statusCode).toBe(201);
  });

  it('5. the employer sees the applicant', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/jobs/${jobId}/applications`,
      headers: { authorization: `Bearer ${employerToken}` },
    });
    expect(res.statusCode).toBe(200);
    const apps = res.json();
    const list = Array.isArray(apps) ? apps : (apps.applications ?? apps.items ?? []);
    expect(list.some((a: { workerId?: string; worker?: { id?: string } }) =>
      a.workerId === workerId || a.worker?.id === workerId,
    )).toBe(true);
  });

  it('6. the worker messages the employer and the employer reads it', async () => {
    const send = await app.inject({
      method: 'POST',
      url: '/messages',
      headers: { authorization: `Bearer ${workerToken}` },
      payload: { recipientId: employerId, content: 'Hi — I just applied to your electrician role.' },
    });
    expect([200, 201]).toContain(send.statusCode);

    const convos = await app.inject({
      method: 'GET',
      url: '/conversations',
      headers: { authorization: `Bearer ${employerToken}` },
    });
    expect(convos.statusCode).toBe(200);
    const list = convos.json();
    const arr = Array.isArray(list) ? list : (list.conversations ?? list.items ?? []);
    expect(arr.length).toBeGreaterThan(0);
    conversationId = arr[0].id;

    const thread = await app.inject({
      method: 'GET',
      url: `/conversations/${conversationId}/messages`,
      headers: { authorization: `Bearer ${employerToken}` },
    });
    expect(thread.statusCode).toBe(200);
    const messages = thread.json();
    const marr = Array.isArray(messages) ? messages : (messages.messages ?? messages.items ?? []);
    expect(marr.some((m: { content?: string }) => (m.content ?? '').includes('I just applied'))).toBe(true);
  });
});
