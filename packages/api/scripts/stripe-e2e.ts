/**
 * Phase 5 live test-mode E2E. Drives the real route handlers in-process
 * (app.inject) against REAL Stripe test-mode APIs, confirming PaymentIntents
 * with the 4242 card (pm_card_visa). Run with NODE_ENV=test so BullMQ/Redis
 * workers are skipped; Stripe is still "configured" via STRIPE_SECRET_KEY.
 */
import Stripe from 'stripe';
import { buildApp } from '../src/app.js';
import { signAccessToken } from '../src/auth/jwt.js';
import { getPrisma } from '../src/lib/prisma.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const prisma = getPrisma();
const stamp = Date.now();

let pass = 0;
let fail = 0;
function check(label: string, cond: boolean, extra?: unknown) {
  if (cond) {
    console.log(`  ✓ ${label}`);
    pass++;
  } else {
    console.log(`  ✗ ${label}`, extra ?? '');
    fail++;
  }
}

function piIdFromSecret(secret: string): string {
  return secret.split('_secret_')[0]!;
}

async function main() {
  const app = await buildApp();

  // Test employer (direct insert + signed token — same pattern as the suite).
  const employer = await prisma.user.create({
    data: {
      firstName: 'Emma',
      lastName: 'StripeE2E',
      email: `emma-stripe-e2e-${stamp}@test.local`,
      role: 'employer',
      authProvider: 'email',
      passwordHash: 'x',
    },
  });
  const token = signAccessToken(employer.id, 'employer');
  const auth = { authorization: `Bearer ${token}` };
  const trade = await prisma.trade.findFirst();

  const company = await app
    .inject({
      method: 'POST',
      url: '/companies',
      headers: auth,
      payload: {
        name: 'StripeE2E Co',
        sizeRange: 'size_1_10',
        contactEmail: `co-${stamp}@test.local`,
      },
    })
    .then((r) => r.json());

  const jobPayload = (planTier: string) => ({
    companyId: company.id,
    title: `E2E ${planTier} job`,
    tradeId: trade!.id,
    experienceLevel: 'years_3_5',
    payMin: 30,
    payMax: 45,
    jobType: 'full_time',
    workSetting: 'commercial',
    city: 'Chicago',
    state: 'IL',
    zipCode: '60601',
    description: 'E2E test job',
    openingsCount: 1,
    planTier,
  });

  // ── 1. One-time Pro ($129) ──────────────────────────────────────
  console.log('\n[1] One-time Pro ($129) post');
  const proJob = await app
    .inject({ method: 'POST', url: '/jobs', headers: auth, payload: jobPayload('pro') })
    .then((r) => r.json());
  check('job created as draft', proJob.status === 'draft', proJob.status);

  const intent = await app
    .inject({ method: 'POST', url: `/payments/jobs/${proJob.id}/intent`, headers: auth })
    .then((r) => r.json());
  check('intent returns client secret', !!intent.paymentIntentClientSecret);
  check('intent amount = 12900', intent.amount === 12900, intent.amount);
  check('intent returns ephemeral key + customer', !!intent.ephemeralKeySecret && !!intent.customerId);

  // Confirm the PaymentIntent with the 4242 test card (what the Payment Sheet does).
  const piId = piIdFromSecret(intent.paymentIntentClientSecret);
  const confirmedPi = await stripe.paymentIntents.confirm(piId, {
    payment_method: 'pm_card_visa',
    return_url: 'https://example.com/return',
  });
  check('Stripe PI succeeded (4242)', confirmedPi.status === 'succeeded', confirmedPi.status);

  const confirm = await app.inject({
    method: 'POST',
    url: `/payments/jobs/${proJob.id}/confirm`,
    headers: auth,
  });
  check('confirm endpoint 200 + published', confirm.statusCode === 200 && confirm.json().published === true, confirm.statusCode);

  const proAfter = await app.inject({ method: 'GET', url: `/jobs/${proJob.id}`, headers: auth }).then((r) => r.json());
  check('job now open', proAfter.status === 'open', proAfter.status);
  check('stripePaymentId persisted', proAfter.stripePaymentId === piId, proAfter.stripePaymentId);
  const payRow = await prisma.payment.findUnique({ where: { stripePaymentIntentId: piId } });
  check('payment row succeeded', payRow?.status === 'succeeded', payRow?.status);

  // Idempotency — confirm again must be a no-op, still open.
  const confirm2 = await app.inject({ method: 'POST', url: `/payments/jobs/${proJob.id}/confirm`, headers: auth });
  check('re-confirm idempotent (200, still open)', confirm2.statusCode === 200, confirm2.statusCode);

  // ── 2. Unlimited ($299/mo) subscription ─────────────────────────
  console.log('\n[2] Unlimited ($299/mo) subscription');
  // Posting unlimited BEFORE subscribing must 402.
  const blocked = await app.inject({ method: 'POST', url: '/jobs', headers: auth, payload: jobPayload('unlimited') });
  check('unlimited post blocked w/o sub (402)', blocked.statusCode === 402, blocked.statusCode);

  const subIntent = await app
    .inject({ method: 'POST', url: '/payments/subscription/intent', headers: auth })
    .then((r) => r.json());
  check('sub intent returns client secret + subId', !!subIntent.paymentIntentClientSecret && !!subIntent.subscriptionId);

  const subPiId = piIdFromSecret(subIntent.paymentIntentClientSecret);
  const subPi = await stripe.paymentIntents.confirm(subPiId, {
    payment_method: 'pm_card_visa',
    return_url: 'https://example.com/return',
  });
  check('subscription first invoice paid (4242)', subPi.status === 'succeeded', subPi.status);

  const subConfirm = await app
    .inject({ method: 'POST', url: '/payments/subscription/confirm', headers: auth })
    .then((r) => r.json());
  check('subscription active after confirm', subConfirm.active === true, subConfirm.status);

  const subStatus = await app.inject({ method: 'GET', url: '/payments/subscription', headers: auth }).then((r) => r.json());
  check('GET subscription → active', subStatus.active === true, subStatus.status);

  // Now an unlimited post should be free and go straight to open.
  const freeJob = await app
    .inject({ method: 'POST', url: '/jobs', headers: auth, payload: jobPayload('unlimited') })
    .then((r) => r.json());
  check('unlimited post now open (free)', freeJob.status === 'open', freeJob.status);

  // ── 3. Cancel ───────────────────────────────────────────────────
  console.log('\n[3] Cancel subscription');
  const cancel = await app.inject({ method: 'POST', url: '/payments/subscription/cancel', headers: auth });
  check('cancel 200', cancel.statusCode === 200, cancel.statusCode);

  // ── Cleanup ─────────────────────────────────────────────────────
  // Cancel the Stripe subscription immediately + delete the test customer/user.
  try {
    const localSub = await prisma.subscription.findUnique({ where: { userId: employer.id } });
    if (localSub) await stripe.subscriptions.cancel(localSub.stripeSubscriptionId).catch(() => {});
    if (employer.stripeCustomerId) await stripe.customers.del(employer.stripeCustomerId).catch(() => {});
    const fresh = await prisma.user.findUnique({ where: { id: employer.id } });
    if (fresh?.stripeCustomerId) await stripe.customers.del(fresh.stripeCustomerId).catch(() => {});
  } catch {
    /* best-effort */
  }
  await prisma.user.delete({ where: { id: employer.id } }).catch(() => {});
  await app.close();

  console.log(`\n${fail === 0 ? '✅' : '❌'} ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('E2E crashed:', err);
  process.exit(1);
});
