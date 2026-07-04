import type Stripe from 'stripe';
import {
  PLAN_PRICE_CENTS,
  isSubscriptionPlan,
  subscriptionCovers,
  subscriptionIntentSchema,
  type PaymentSheetParams,
  type SubscriptionStatus,
} from '@blubranch/shared';
import type { PrismaClient } from '@blubranch/db';
import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../auth/middleware.js';
import { getPrisma } from '../lib/prisma.js';
import { parseBody } from '../lib/validate.js';
import { sendReceiptEmail } from '../services/email.js';
import {
  getOrCreateCustomer,
  getPublishableKey,
  getStripe,
  getSubscriptionPriceId,
  isStripeConfigured,
} from '../services/stripe.js';
import { planTtlDays } from '../lib/plans.js';

type Tier = 'basic' | 'pro' | 'unlimited';
const ACTIVE_SUB_STATUSES = ['active', 'trialing', 'past_due'];

// ── Shared helpers (also imported by jobs.ts + the webhook) ───────────────

/**
 * True when the user has an active subscription that covers posting at
 * `minPlan` (its tier rank ≥ the job's). Pro covers Pro; Unlimited covers Pro
 * and Unlimited.
 */
export async function hasActiveSubscription(
  prisma: PrismaClient,
  userId: string,
  minPlan: Tier = 'pro',
): Promise<boolean> {
  const sub = await prisma.subscription.findUnique({ where: { userId } });
  if (!sub || !['active', 'trialing'].includes(sub.status)) return false;
  return subscriptionCovers(sub.plan as Tier, minPlan);
}

/** The Stripe API version this SDK is pinned to — reused for ephemeral keys. */
function apiVersion(): string {
  return (getStripe() as unknown as { getApiField(f: string): string }).getApiField('version');
}

async function ephemeralKeySecret(customerId: string): Promise<string> {
  const key = await getStripe().ephemeralKeys.create(
    { customer: customerId },
    { apiVersion: apiVersion() } as Stripe.RequestOptions,
  );
  return key.secret!;
}

/**
 * Flip a paid job from `draft` → `open`. Idempotent: a no-op if the job is
 * already open (so the webhook and the /confirm backstop can both fire safely).
 * Resets `expiresAt` so the listing clock starts at publish, not draft creation.
 */
export async function publishJobForPayment(
  prisma: PrismaClient,
  args: { jobId: string; paymentIntentId: string },
): Promise<void> {
  const job = await prisma.job.findUnique({ where: { id: args.jobId } });
  if (!job || job.status !== 'draft') {
    // Already published (or gone) — still ensure the Payment row is settled.
    await prisma.payment
      .updateMany({
        where: { stripePaymentIntentId: args.paymentIntentId },
        data: { status: 'succeeded' },
      })
      .catch(() => {});
    return;
  }

  const expiresAt = new Date(Date.now() + planTtlDays(job.planTier) * 24 * 60 * 60 * 1000);
  await prisma.job.update({
    where: { id: job.id },
    data: { status: 'open', stripePaymentId: args.paymentIntentId, expiresAt },
  });
  await prisma.payment
    .updateMany({
      where: { stripePaymentIntentId: args.paymentIntentId },
      data: { status: 'succeeded', jobId: job.id },
    })
    .catch(() => {});

  // Best-effort receipt.
  try {
    const employer = await prisma.user.findUnique({ where: { id: job.employerId } });
    if (employer) {
      await sendReceiptEmail(employer.email, {
        description: `${job.planTier[0]!.toUpperCase()}${job.planTier.slice(1)} job post — ${job.title}`,
        amountCents: PLAN_PRICE_CENTS[job.planTier],
        recurring: false,
      });
    }
  } catch {
    /* receipts never block */
  }
}

/**
 * Mirror a Stripe Subscription into our `subscriptions` table. Source of truth
 * is Stripe; we cache status + period end for fast gating.
 */
export async function syncSubscription(prisma: PrismaClient, sub: Stripe.Subscription): Promise<void> {
  const userId = sub.metadata?.userId;
  if (!userId) return;

  // In Basil+ API versions `current_period_end` lives on the subscription item;
  // older versions had it on the subscription. Handle both.
  const periodEndUnix =
    (sub as unknown as { current_period_end?: number }).current_period_end ??
    sub.items?.data?.[0]?.current_period_end ??
    null;
  const currentPeriodEnd = periodEndUnix ? new Date(periodEndUnix * 1000) : null;
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;

  // Which tier this subscription is for — carried in metadata at create time
  // (and preserved by Stripe on later subscription events).
  const planMeta = sub.metadata?.plan;
  const plan: Tier | undefined = planMeta === 'pro' || planMeta === 'unlimited' ? planMeta : undefined;

  const justActivated = ACTIVE_SUB_STATUSES.includes(sub.status);

  const existing = await prisma.subscription.findUnique({ where: { userId } });
  await prisma.subscription.upsert({
    where: { userId },
    create: {
      userId,
      stripeSubscriptionId: sub.id,
      stripeCustomerId: customerId,
      status: sub.status,
      currentPeriodEnd,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      ...(plan ? { plan } : {}),
    },
    update: {
      stripeSubscriptionId: sub.id,
      stripeCustomerId: customerId,
      status: sub.status,
      currentPeriodEnd,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      ...(plan ? { plan } : {}),
    },
  });

  // First-time activation → receipt.
  const wasActive = existing && ['active', 'trialing'].includes(existing.status);
  if (justActivated && sub.status !== 'past_due' && !wasActive) {
    try {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (user) {
        const tier = plan ?? 'unlimited';
        await sendReceiptEmail(user.email, {
          description: `BluBranch ${tier[0]!.toUpperCase()}${tier.slice(1)} — monthly`,
          amountCents: PLAN_PRICE_CENTS[tier],
          recurring: true,
        });
      }
    } catch {
      /* receipts never block */
    }
  }
}

// ── JSON routes (Payment Sheet bootstrap + subscription management) ───────

export async function paymentRoutes(app: FastifyInstance): Promise<void> {
  const prisma = getPrisma();

  // Guard: every payment route 503s cleanly when Stripe isn't configured.
  function ensureConfigured(reply: import('fastify').FastifyReply): boolean {
    if (!isStripeConfigured()) {
      reply.code(503).send({ error: 'StripeNotConfigured', message: 'Payments are not available.' });
      return false;
    }
    return true;
  }

  // GET /payments/config — publishable key for StripeProvider bootstrap.
  app.get('/payments/config', async () => ({ publishableKey: getPublishableKey() }));

  // POST /payments/jobs/:id/intent — one-time payment for a Basic/Pro draft job.
  app.post<{ Params: { id: string } }>(
    '/payments/jobs/:id/intent',
    { preHandler: requireAuth },
    async (request, reply) => {
      if (!ensureConfigured(reply)) return;
      const userId = request.user!.id;

      const job = await prisma.job.findUnique({ where: { id: request.params.id } });
      if (!job) return reply.code(404).send({ error: 'NotFound' });
      if (job.employerId !== userId) return reply.code(403).send({ error: 'Forbidden' });
      if (job.status !== 'draft') {
        return reply.code(409).send({ error: 'Conflict', message: 'Job is already published.' });
      }
      if (isSubscriptionPlan(job.planTier)) {
        return reply
          .code(400)
          .send({ error: 'BadRequest', message: 'Unlimited posts use a subscription, not a one-time payment.' });
      }

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) return reply.code(404).send({ error: 'NotFound' });

      const customerId = await getOrCreateCustomer(user);
      const amount = PLAN_PRICE_CENTS[job.planTier];

      const intent = await getStripe().paymentIntents.create({
        amount,
        currency: 'usd',
        customer: customerId,
        description: `BluBranch ${job.planTier} job post: ${job.title}`,
        metadata: { kind: 'job_post', jobId: job.id, userId, plan: job.planTier },
        automatic_payment_methods: { enabled: true },
      });

      // Record (or refresh) the Payment row keyed by PaymentIntent id.
      await prisma.payment.upsert({
        where: { stripePaymentIntentId: intent.id },
        create: {
          userId,
          jobId: job.id,
          stripePaymentIntentId: intent.id,
          amount,
          currency: 'usd',
          plan: job.planTier,
          status: intent.status,
        },
        update: { status: intent.status },
      });

      const body: PaymentSheetParams = {
        paymentIntentClientSecret: intent.client_secret!,
        ephemeralKeySecret: await ephemeralKeySecret(customerId),
        customerId,
        publishableKey: getPublishableKey(),
        amount,
        currency: 'usd',
      };
      return reply.send(body);
    },
  );

  // POST /payments/jobs/:id/confirm — server-side verification backstop. After
  // the Payment Sheet reports success the client calls this; we retrieve the
  // PaymentIntent from Stripe and publish if it actually succeeded. Idempotent
  // with the webhook (handles local dev where webhooks aren't wired).
  app.post<{ Params: { id: string } }>(
    '/payments/jobs/:id/confirm',
    { preHandler: requireAuth },
    async (request, reply) => {
      if (!ensureConfigured(reply)) return;
      const userId = request.user!.id;

      const job = await prisma.job.findUnique({ where: { id: request.params.id } });
      if (!job) return reply.code(404).send({ error: 'NotFound' });
      if (job.employerId !== userId) return reply.code(403).send({ error: 'Forbidden' });
      if (job.status === 'open') return reply.send({ published: true, status: 'open' });

      const payment = await prisma.payment.findFirst({
        where: { jobId: job.id },
        orderBy: { createdAt: 'desc' },
      });
      if (!payment) {
        return reply.code(409).send({ error: 'Conflict', message: 'No payment found for this job.' });
      }

      const intent = await getStripe().paymentIntents.retrieve(payment.stripePaymentIntentId);
      if (intent.status !== 'succeeded') {
        await prisma.payment.update({
          where: { stripePaymentIntentId: intent.id },
          data: { status: intent.status },
        });
        return reply.code(402).send({ error: 'PaymentRequired', status: intent.status });
      }

      await publishJobForPayment(prisma, { jobId: job.id, paymentIntentId: intent.id });
      return reply.send({ published: true, status: 'open' });
    },
  );

  // POST /payments/subscription/intent — start a Pro or Unlimited subscription.
  app.post(
    '/payments/subscription/intent',
    { preHandler: requireAuth },
    async (request, reply) => {
      if (!ensureConfigured(reply)) return;
      const data = parseBody(subscriptionIntentSchema, request, reply);
      if (!data) return;

      const priceId = getSubscriptionPriceId(data.plan);
      if (!priceId) {
        return reply
          .code(503)
          .send({ error: 'StripeNotConfigured', message: `The ${data.plan} plan is not configured.` });
      }
      const userId = request.user!.id;

      // Any active subscription blocks starting another (cross-tier upgrades are
      // handled later via the dashboard / settings, not a second sub).
      const existing = await prisma.subscription.findUnique({ where: { userId } });
      if (existing && ['active', 'trialing'].includes(existing.status)) {
        return reply.code(409).send({ error: 'Conflict', message: 'You already have an active subscription.' });
      }

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) return reply.code(404).send({ error: 'NotFound' });
      const customerId = await getOrCreateCustomer(user);

      const sub = await getStripe().subscriptions.create({
        customer: customerId,
        items: [{ price: priceId }],
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        metadata: { userId, plan: data.plan },
        expand: ['latest_invoice.confirmation_secret'],
      });

      const invoice = sub.latest_invoice as Stripe.Invoice | null;
      const clientSecret =
        (invoice as unknown as { confirmation_secret?: { client_secret?: string } })?.confirmation_secret
          ?.client_secret ?? null;
      if (!clientSecret) {
        request.log.error({ subId: sub.id }, 'subscription created without a confirmation secret');
        return reply.code(500).send({ error: 'StripeError', message: 'Could not initialize payment.' });
      }

      await syncSubscription(prisma, sub);

      const body: PaymentSheetParams = {
        paymentIntentClientSecret: clientSecret,
        ephemeralKeySecret: await ephemeralKeySecret(customerId),
        customerId,
        publishableKey: getPublishableKey(),
        amount: PLAN_PRICE_CENTS[data.plan],
        currency: 'usd',
        subscriptionId: sub.id,
      };
      return reply.send(body);
    },
  );

  // POST /payments/subscription/confirm — backstop mirroring the webhook for
  // local dev: re-pull the subscription from Stripe and sync its status.
  app.post(
    '/payments/subscription/confirm',
    { preHandler: requireAuth },
    async (request, reply) => {
      if (!ensureConfigured(reply)) return;
      const userId = request.user!.id;
      const local = await prisma.subscription.findUnique({ where: { userId } });
      if (!local) return reply.code(404).send({ error: 'NotFound' });

      const sub = await getStripe().subscriptions.retrieve(local.stripeSubscriptionId);
      await syncSubscription(prisma, sub);
      return reply.send({ active: ['active', 'trialing'].includes(sub.status), status: sub.status });
    },
  );

  // GET /payments/subscription — current subscription status (for gating UI).
  app.get('/payments/subscription', { preHandler: requireAuth }, async (request, reply) => {
    const sub = await prisma.subscription.findUnique({ where: { userId: request.user!.id } });
    const body: SubscriptionStatus = {
      active: !!sub && ['active', 'trialing'].includes(sub.status),
      plan: sub?.plan ?? null,
      status: sub?.status ?? null,
      currentPeriodEnd: sub?.currentPeriodEnd ?? null,
      cancelAtPeriodEnd: sub?.cancelAtPeriodEnd ?? false,
    };
    return reply.send(body);
  });

  // POST /payments/subscription/cancel — cancel at period end (keeps access
  // until the paid period runs out, matching "Cancel anytime").
  app.post('/payments/subscription/cancel', { preHandler: requireAuth }, async (request, reply) => {
    if (!ensureConfigured(reply)) return;
    const local = await prisma.subscription.findUnique({ where: { userId: request.user!.id } });
    if (!local) return reply.code(404).send({ error: 'NotFound' });

    const sub = await getStripe().subscriptions.update(local.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });
    await syncSubscription(prisma, sub);
    return reply.send({ canceledAtPeriodEnd: true, currentPeriodEnd: local.currentPeriodEnd });
  });

  // POST /payments/subscription/change — up/downgrade between Blu (pro) and
  // Blu Max (unlimited). Swaps the subscription's price with proration. Only
  // valid when a subscription already exists (first-time uses /intent). This is
  // the ONLY place plan tier changes; the post flow never changes plans.
  app.post('/payments/subscription/change', { preHandler: requireAuth }, async (request, reply) => {
    if (!ensureConfigured(reply)) return;
    const data = parseBody(subscriptionIntentSchema, request, reply);
    if (!data) return;

    const local = await prisma.subscription.findUnique({ where: { userId: request.user!.id } });
    if (!local || !['active', 'trialing', 'past_due'].includes(local.status)) {
      return reply.code(400).send({ error: 'BadRequest', message: 'No active subscription to change.' });
    }
    if (local.plan === data.plan) {
      // Same tier — the only meaningful action is resuming a pending cancel.
      if (local.cancelAtPeriodEnd) {
        const resumed = await getStripe().subscriptions.update(local.stripeSubscriptionId, {
          cancel_at_period_end: false,
        });
        await syncSubscription(prisma, resumed);
        return reply.send({ plan: local.plan, status: resumed.status });
      }
      return reply.send({ plan: local.plan, status: local.status, unchanged: true });
    }
    const priceId = getSubscriptionPriceId(data.plan);
    if (!priceId) {
      return reply.code(503).send({ error: 'StripeNotConfigured', message: `The ${data.plan} plan is not configured.` });
    }

    const current = await getStripe().subscriptions.retrieve(local.stripeSubscriptionId);
    const itemId = current.items.data[0]?.id;
    if (!itemId) return reply.code(500).send({ error: 'StripeError' });

    const updated = await getStripe().subscriptions.update(local.stripeSubscriptionId, {
      items: [{ id: itemId, price: priceId }],
      proration_behavior: 'create_prorations',
      cancel_at_period_end: false, // switching plans un-cancels
      metadata: { userId: request.user!.id, plan: data.plan },
    });
    await syncSubscription(prisma, updated);
    return reply.send({ plan: data.plan, status: updated.status });
  });
}

// ── Stripe webhook (raw body — registered as its own encapsulated plugin) ──

export async function stripeWebhookRoutes(app: FastifyInstance): Promise<void> {
  const prisma = getPrisma();

  // Stripe signature verification needs the exact raw bytes, so within this
  // encapsulated plugin we parse application/json as a Buffer instead of JSON.
  app.addContentTypeParser('application/json', { parseAs: 'buffer' }, (_req, body, done) => {
    done(null, body);
  });

  app.post(
    '/webhooks/stripe',
    { config: { rateLimit: false } },
    async (request, reply) => {
      if (!isStripeConfigured()) return reply.code(503).send({ error: 'StripeNotConfigured' });

      const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
      const sig = request.headers['stripe-signature'];
      if (!secret || secret === 'whsec_replace_me' || !sig) {
        return reply.code(400).send({ error: 'BadRequest', message: 'Missing webhook signature/secret.' });
      }

      let event: Stripe.Event;
      try {
        event = getStripe().webhooks.constructEvent(request.body as Buffer, sig as string, secret);
      } catch (err) {
        request.log.warn({ err }, 'stripe webhook signature verification failed');
        return reply.code(400).send({ error: 'BadRequest', message: 'Invalid signature.' });
      }

      try {
        switch (event.type) {
          case 'payment_intent.succeeded': {
            const pi = event.data.object as Stripe.PaymentIntent;
            if (pi.metadata?.kind === 'job_post' && pi.metadata.jobId) {
              await publishJobForPayment(prisma, { jobId: pi.metadata.jobId, paymentIntentId: pi.id });
            }
            break;
          }
          case 'payment_intent.payment_failed': {
            const pi = event.data.object as Stripe.PaymentIntent;
            await prisma.payment
              .updateMany({ where: { stripePaymentIntentId: pi.id }, data: { status: 'failed' } })
              .catch(() => {});
            break;
          }
          case 'customer.subscription.created':
          case 'customer.subscription.updated':
          case 'customer.subscription.deleted': {
            await syncSubscription(prisma, event.data.object as Stripe.Subscription);
            break;
          }
          case 'invoice.paid':
          case 'invoice.payment_failed': {
            // Re-pull the subscription so status + period end stay correct.
            const invoice = event.data.object as Stripe.Invoice;
            const subId = (invoice as unknown as { subscription?: string | { id: string } }).subscription;
            const id = typeof subId === 'string' ? subId : subId?.id;
            if (id) {
              const sub = await getStripe().subscriptions.retrieve(id);
              await syncSubscription(prisma, sub);
            }
            break;
          }
          default:
            break;
        }
      } catch (err) {
        request.log.error({ err, type: event.type }, 'stripe webhook handler error');
        // 500 → Stripe retries.
        return reply.code(500).send({ error: 'WebhookHandlerError' });
      }

      return reply.send({ received: true });
    },
  );
}
