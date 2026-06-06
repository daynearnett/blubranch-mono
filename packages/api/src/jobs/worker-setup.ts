// BullMQ worker bootstrap — registers all processors and repeatable job
// schedules. Called once on API startup from app.ts.

import { createWorker, registerRepeatableJobs, QUEUE_NAMES } from '../lib/queue.js';
import { processExpireJobs } from './expire-cron.js';
import { processLicenseExpiration } from './license-expiration.js';

/**
 * Register workers and schedule repeatable jobs. Returns a teardown
 * function for graceful shutdown.
 */
export async function startWorkers(): Promise<void> {
  // ── Jobs-maintenance queue ──────────────────────────────────────
  createWorker(QUEUE_NAMES.JOBS, async (job) => {
    switch (job.name) {
      case 'expire-jobs':
        await processExpireJobs();
        break;
      case 'license-expiration':
        await processLicenseExpiration();
        break;
      default:
        console.warn(`[jobs-maintenance] Unknown job: ${job.name}`);
    }
  });

  // ── Notification queue (placeholder — wired in chunk 5) ─────────
  createWorker(QUEUE_NAMES.NOTIFICATIONS, async (job) => {
    switch (job.name) {
      case 'send-push':
        // Will be implemented in chunk 5 (FCM push)
        console.log('[notifications] send-push stub:', job.data);
        break;
      case 'job-alert-digest':
        // Batched job-match emails — chunk 5
        console.log('[notifications] job-alert-digest stub');
        break;
      default:
        console.warn(`[notifications] Unknown job: ${job.name}`);
    }
  });

  // ── Schedule repeatable jobs (idempotent — safe to call on every boot) ──
  await registerRepeatableJobs([
    {
      queue: QUEUE_NAMES.JOBS,
      name: 'expire-jobs',
      opts: {
        repeat: { pattern: '0 * * * *' }, // every hour, on the hour
        removeOnComplete: { count: 24 },   // keep last 24 runs
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
  ]);

  console.log('[Workers] All queues and repeatable jobs registered');
}
