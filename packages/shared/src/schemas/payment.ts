import { z } from 'zod';
import { PlanTier } from '../enums.js';

// ── Plan pricing (single source of truth, shared by API + mobile) ──
//
// Basic and Pro are charged once per job post (one-time PaymentIntent).
// Unlimited is a recurring monthly subscription ($299/mo) that lets the
// employer post unlimited jobs while the subscription is active.
export const PLAN_PRICE_CENTS: Record<z.infer<typeof PlanTier>, number> = {
  basic: 4900,
  pro: 12900,
  unlimited: 29900,
};

// Which tiers are billed once per post vs. via subscription.
export const ONE_TIME_PLANS = ['basic', 'pro'] as const;
export const SUBSCRIPTION_PLANS = ['unlimited'] as const;

export function isSubscriptionPlan(plan: z.infer<typeof PlanTier>): boolean {
  return (SUBSCRIPTION_PLANS as readonly string[]).includes(plan);
}

export function planPriceLabel(plan: z.infer<typeof PlanTier>): string {
  const dollars = (PLAN_PRICE_CENTS[plan] / 100).toFixed(0);
  return isSubscriptionPlan(plan) ? `$${dollars} / month` : `$${dollars} one-time`;
}

// ── Payment Sheet bootstrap (API → mobile) ────────────────────────
// Everything @stripe/stripe-react-native needs to present the native sheet.
export const paymentSheetParamsSchema = z.object({
  paymentIntentClientSecret: z.string(),
  ephemeralKeySecret: z.string(),
  customerId: z.string(),
  publishableKey: z.string(),
  amount: z.number().int().nonnegative(),
  currency: z.string(),
  // For a subscription, the first invoice's PaymentIntent client secret is
  // returned here too; `subscriptionId` is set so the client can confirm.
  subscriptionId: z.string().optional(),
});
export type PaymentSheetParams = z.infer<typeof paymentSheetParamsSchema>;

// ── Subscription status (API → mobile) ────────────────────────────
export const subscriptionStatusSchema = z.object({
  active: z.boolean(),
  plan: PlanTier.nullable(),
  status: z.string().nullable(),
  currentPeriodEnd: z.coerce.date().nullable(),
  cancelAtPeriodEnd: z.boolean(),
});
export type SubscriptionStatus = z.infer<typeof subscriptionStatusSchema>;
