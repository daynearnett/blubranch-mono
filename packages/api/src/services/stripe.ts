import Stripe from 'stripe';
import type { User } from '@blubranch/db';
import { getPrisma } from '../lib/prisma.js';

// Lazy singleton — mirrors services/email.ts / firebase.ts. Stripe is only
// touched on the payment routes, so we don't pay init cost on every boot and
// the server still runs locally without Stripe creds (routes guard with
// isStripeConfigured()).
let _stripe: Stripe | null = null;

/**
 * True when a real (non-placeholder) Stripe secret key is configured. Payment
 * routes 503 when this is false so local dev / unconfigured envs degrade
 * cleanly instead of throwing opaque Stripe errors.
 */
export function isStripeConfigured(): boolean {
  const key = process.env.STRIPE_SECRET_KEY;
  return !!key && key !== 'sk_test_replace_me';
}

export function getStripe(): Stripe {
  if (!_stripe) {
    if (!isStripeConfigured()) {
      throw new Error('Stripe is not configured (STRIPE_SECRET_KEY missing)');
    }
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  }
  return _stripe;
}

/** Publishable key handed to the mobile Payment Sheet. */
export function getPublishableKey(): string {
  return process.env.STRIPE_PUBLISHABLE_KEY ?? '';
}

/**
 * Recurring Price id for the Unlimited subscription. Created once in the Stripe
 * dashboard (a $299/mo recurring price) and wired via env. Empty when unset —
 * the subscription route 503s with a clear message.
 */
export function getUnlimitedPriceId(): string {
  return process.env.STRIPE_PRICE_UNLIMITED ?? '';
}

/**
 * Return the user's Stripe customer id, creating (and persisting) one on first
 * use. One customer per BluBranch user, reused across one-time job payments and
 * the Unlimited subscription.
 */
export async function getOrCreateCustomer(user: Pick<User, 'id' | 'email' | 'firstName' | 'lastName' | 'stripeCustomerId'>): Promise<string> {
  if (user.stripeCustomerId) return user.stripeCustomerId;

  const customer = await getStripe().customers.create({
    email: user.email,
    name: `${user.firstName} ${user.lastName}`.trim(),
    metadata: { userId: user.id },
  });

  await getPrisma().user.update({
    where: { id: user.id },
    data: { stripeCustomerId: customer.id },
  });

  return customer.id;
}
