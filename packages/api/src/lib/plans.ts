import type { PlanTier } from '@blubranch/shared';

/** Listing lifetime in days by plan. Basic = 30 days, Pro/Unlimited = 60. */
export function planTtlDays(plan: PlanTier): number {
  return plan === 'basic' ? 30 : 60;
}
