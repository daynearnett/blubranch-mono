/**
 * Real signed-webhook test. Talks to a LOCALLY RUNNING server (localhost:4000)
 * that has STRIPE_WEBHOOK_SECRET set to the `stripe listen` session secret.
 * Confirms a PaymentIntent with the 4242 card and then waits for the job to be
 * published by the WEBHOOK alone (never calls /confirm).
 */
import Stripe from 'stripe';
import { signAccessToken } from '../src/auth/jwt.js';
import { getPrisma } from '../src/lib/prisma.js';

const API = 'http://localhost:4000';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const prisma = getPrisma();
const stamp = Date.now();

async function api(path: string, opts: { method?: string; token?: string; body?: unknown } = {}) {
  const res = await fetch(API + path, {
    method: opts.method ?? 'GET',
    headers: {
      // Only set content-type when there IS a body (matches the mobile client;
      // Fastify rejects an empty body when content-type is application/json).
      ...(opts.body ? { 'content-type': 'application/json' } : {}),
      ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, data: text ? JSON.parse(text) : null };
}

async function main() {
  const employer = await prisma.user.create({
    data: {
      firstName: 'Wade',
      lastName: 'WebhookTest',
      email: `wade-webhook-${stamp}@test.local`,
      role: 'employer',
      authProvider: 'email',
      passwordHash: 'x',
    },
  });
  const token = signAccessToken(employer.id, 'employer');
  const trade = await prisma.trade.findFirst();

  const company = (
    await api('/companies', {
      method: 'POST',
      token,
      body: { name: 'Webhook Co', sizeRange: 'size_1_10', contactEmail: `wco-${stamp}@test.local` },
    })
  ).data;

  const job = (
    await api('/jobs', {
      method: 'POST',
      token,
      body: {
        companyId: company.id,
        title: 'Webhook test job',
        tradeId: trade!.id,
        experienceLevel: 'years_3_5',
        payMin: 30,
        payMax: 45,
        jobType: 'full_time',
        workSetting: 'commercial',
        city: 'Chicago',
        state: 'IL',
        zipCode: '60601',
        description: 'Webhook publish test',
        openingsCount: 1,
        planTier: 'basic',
      },
    })
  ).data;
  console.log('  job created status:', job.status, '(expect draft)');

  const intentRes = await api(`/payments/jobs/${job.id}/intent`, { method: 'POST', token });
  if (intentRes.status !== 200) {
    console.log('  ✗ intent failed:', intentRes.status, intentRes.data);
    process.exit(1);
  }
  const piId = intentRes.data.paymentIntentClientSecret.split('_secret_')[0];

  // Pay with 4242 — this fires payment_intent.succeeded → stripe listen → /webhooks/stripe.
  const pi = await stripe.paymentIntents.confirm(piId, {
    payment_method: 'pm_card_visa',
    return_url: 'https://example.com/return',
  });
  console.log('  PI confirmed:', pi.status);
  console.log('  waiting for WEBHOOK to publish (NOT calling /confirm)…');

  let published = false;
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const j = (await api(`/jobs/${job.id}`, { token })).data;
    if (j.status === 'open') {
      published = true;
      console.log(`  ✓ webhook published the job after ~${i + 1}s (status open, stripePaymentId=${j.stripePaymentId === piId})`);
      break;
    }
  }
  if (!published) console.log('  ✗ job NOT published by webhook within 20s');

  await prisma.user.delete({ where: { id: employer.id } }).catch(() => {});
  console.log(`\n${published ? '✅ WEBHOOK TEST PASSED' : '❌ WEBHOOK TEST FAILED'}`);
  process.exit(published ? 0 : 1);
}

main().catch((err) => {
  console.error('crashed:', err);
  process.exit(1);
});
