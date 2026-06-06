// Job expiration — flips open listings whose expires_at has passed to 'expired'.
// Migrated from setInterval to BullMQ repeatable job in Phase 4.

import { getPrisma } from '../lib/prisma.js';

/**
 * BullMQ processor for the 'expire-jobs' repeatable. Called by the
 * jobs-maintenance worker every hour.
 */
export async function processExpireJobs(): Promise<void> {
  const result = await getPrisma().job.updateMany({
    where: { status: 'open', expiresAt: { lte: new Date() } },
    data: { status: 'expired' },
  });
  if (result.count > 0) {
    console.log(`[expire-jobs] Closed ${result.count} stale listing(s)`);
  }
}
