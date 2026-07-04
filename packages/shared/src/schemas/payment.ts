import { z } from 'zod';
import { PlanTier } from '../enums.js';

// ── Plan pricing (single source of truth, shared by API + mobile) ──
//
// Basic is charged once per job post (one-time PaymentIntent). Pro and Unlimited
// are recurring monthly subscriptions that let the employer post unlimited jobs
// at that tier (or below) while active.
//   • Basic     $19 / post (one-time)
//   • Blu       $79 / month (subscription)  [internal tier: pro]
//   • Blu Max   $139 / month (subscription, top tier)  [internal tier: unlimited]
export const PLAN_PRICE_CENTS: Record<z.infer<typeof PlanTier>, number> = {
  basic: 1900,
  pro: 7900,
  unlimited: 13900,
};

// Display labels. Internal tier ids stay basic/pro/unlimited everywhere in the
// data model; these are shown to users.
export const PLAN_LABELS: Record<z.infer<typeof PlanTier>, string> = {
  basic: 'Basic',
  pro: 'Blu',
  unlimited: 'Blu Max',
};

// Which tiers are billed once per post vs. via subscription.
export const ONE_TIME_PLANS = ['basic'] as const;
export const SUBSCRIPTION_PLANS = ['pro', 'unlimited'] as const;

// Tier ranking — a subscription grants posting at its rank and below.
export const PLAN_RANK: Record<z.infer<typeof PlanTier>, number> = {
  basic: 0,
  pro: 1,
  unlimited: 2,
};

export function isSubscriptionPlan(plan: z.infer<typeof PlanTier>): boolean {
  return (SUBSCRIPTION_PLANS as readonly string[]).includes(plan);
}

/** True when an active subscription on `subPlan` covers posting at `jobPlan`. */
export function subscriptionCovers(
  subPlan: z.infer<typeof PlanTier>,
  jobPlan: z.infer<typeof PlanTier>,
): boolean {
  return PLAN_RANK[subPlan] >= PLAN_RANK[jobPlan];
}

export function planPriceLabel(plan: z.infer<typeof PlanTier>): string {
  const dollars = (PLAN_PRICE_CENTS[plan] / 100).toFixed(0);
  return isSubscriptionPlan(plan) ? `$${dollars} / month` : `$${dollars} one-time`;
}

// Which subscription tier to start (POST /payments/subscription/intent).
export const subscriptionPlanSchema = z.enum(['pro', 'unlimited']);
export const subscriptionIntentSchema = z.object({ plan: subscriptionPlanSchema });
export type SubscriptionIntentInput = z.infer<typeof subscriptionIntentSchema>;

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
