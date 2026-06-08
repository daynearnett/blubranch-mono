// BullMQ worker bootstrap — registers all processors and repeatable job
// schedules. Called once on API startup from app.ts.

import { createWorker, registerRepeatableJobs, QUEUE_NAMES } from '../lib/queue.js';
import { processExpireJobs } from './expire-cron.js';
import { processLicenseExpiration } from './license-expiration.js';
import { processJobMatchScan } from './job-match.js';
import { processProfileNudge } from './profile-nudge.js';

/**
 * Register workers and schedule repeatable jobs. Idempotent — safe to call on
 * every boot (BullMQ de-dupes repeatables by name + pattern).
 */
export async function startWorkers(): Promise<void> {
  // Single worker handles all scheduled maintenance + engagement scans.
  createWorker(QUEUE_NAMES.JOBS, async (job) => {
    switch (job.name) {
      case 'expire-jobs':
        await processExpireJobs();
        break;
      case 'license-expiration':
        await processLicenseExpiration();
        break;
      case 'job-match-scan':
        await processJobMatchScan();
        break;
      case 'profile-nudge':
        await processProfileNudge();
        break;
      default:
        console.warn(`[jobs-maintenance] Unknown job: ${job.name}`);
    }
  });

  await registerRepeatableJobs([
    {
      queue: QUEUE_NAMES.JOBS,
      name: 'expire-jobs',
      opts: {
        repeat: { pattern: '0 * * * *' }, // every hour, on the hour
        removeOnComplete: { count: 24 },
        removeOnFail: { count: 10 },
      },
    },
    {
      queue: QUEUE_NAMES.JOBS,
      name: 'license-expiration',
      opts: {
        repeat: { pattern: '0 3 * * *' }, // daily at 3 AM UTC
        removeOnComplete: { count: 7 },
        removeOnFail: { count: 10 },
      },
    },
    {
      queue: QUEUE_NAMES.JOBS,
      name: 'job-match-scan',
      opts: {
        repeat: { pattern: '*/30 * * * *' }, // every 30 minutes
        removeOnComplete: { count: 48 },
        removeOnFail: { count: 10 },
      },
    },
    {
      queue: QUEUE_NAMES.JOBS,
      name: 'profile-nudge',
      opts: {
        repeat: { pattern: '0 9 * * 1' }, // weekly, Mondays at 9 AM UTC
        removeOnComplete: { count: 8 },
        removeOnFail: { count: 10 },
      },
    },
  ]);

  console.log('[Workers] All queues and repeatable jobs registered');
}
