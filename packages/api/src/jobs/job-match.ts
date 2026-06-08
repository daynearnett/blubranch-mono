// Job-match notifications — scans recently-posted open jobs and notifies
// workers whose trade + location match, who are open to work, who opted in,
// and who haven't already been told about that job.
//
// Matching is city+state based (works on stock Postgres without PostGIS,
// which is the staging reality). Distance/radius matching via PostGIS can be
// layered on later where the `geo` columns exist.

import { getPrisma } from '../lib/prisma.js';
import { sendNotification } from '../services/push.js';

// Window slightly larger than the 30-min schedule so jobs near a boundary
// aren't missed; the per-(worker,job) dedup check makes overlap harmless.
const SCAN_WINDOW_MS = 35 * 60 * 1000;
const MAX_CANDIDATES_PER_JOB = 200; // cap fan-out per job

export async function processJobMatchScan(): Promise<void> {
  const prisma = getPrisma();
  const since = new Date(Date.now() - SCAN_WINDOW_MS);

  const newJobs = await prisma.job.findMany({
    where: { status: 'open', createdAt: { gte: since } },
    select: {
      id: true,
      title: true,
      tradeId: true,
      city: true,
      state: true,
      employerId: true,
      trade: { select: { name: true } },
    },
  });

  let notified = 0;
  for (const job of newJobs) {
    const candidates = await prisma.user.findMany({
      where: {
        role: 'worker',
        id: { not: job.employerId },
        trades: { some: { tradeId: job.tradeId } },
        workerProfile: {
          is: { city: job.city, state: job.state, jobAvailability: { not: 'not_looking' } },
        },
        // Skip workers already notified about this specific job.
        notifications: {
          none: { type: 'job_match', data: { path: ['jobId'], equals: job.id } },
        },
      },
      select: { id: true },
      take: MAX_CANDIDATES_PER_JOB,
    });

    for (const c of candidates) {
      // sendNotification enforces the notifyJobMatch preference itself.
      await sendNotification({
        userId: c.id,
        type: 'job_match',
        title: `New ${job.trade.name} job near you`,
        body: job.title,
        data: { jobId: job.id },
      });
      notified++;
    }
  }

  if (newJobs.length > 0) {
    console.log(`[job-match] scanned ${newJobs.length} new job(s), sent ${notified} match notification(s)`);
  }
}
