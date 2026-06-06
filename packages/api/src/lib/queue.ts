import { Queue, Worker, type JobsOptions } from 'bullmq';

// ── Queue names ─────────────────────────────────────────────────────
export const QUEUE_NAMES = {
  JOBS: 'jobs-maintenance',
  NOTIFICATIONS: 'notifications',
  SCHEDULED: 'scheduled-tasks',
} as const;

/**
 * Parse REDIS_URL into a plain config object for BullMQ. BullMQ creates
 * its own ioredis instances internally — passing our singleton would
 * cause version-mismatch type errors and lifecycle conflicts.
 */
function getRedisConfig(): { host: string; port: number; password?: string; username?: string } {
  const url = process.env.REDIS_URL || 'redis://localhost:6379';
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: Number(parsed.port) || 6379,
    ...(parsed.password ? { password: decodeURIComponent(parsed.password) } : {}),
    ...(parsed.username ? { username: decodeURIComponent(parsed.username) } : {}),
  };
}

// ── Queue registry ──────────────────────────────────────────────────
const queues = new Map<string, Queue>();
const workers: Worker[] = [];

/**
 * Get or create a named queue.
 */
export function getQueue(name: string): Queue {
  let q = queues.get(name);
  if (q) return q;
  q = new Queue(name, { connection: getRedisConfig() });
  queues.set(name, q);
  return q;
}

/**
 * Register a worker for a named queue. Workers are tracked for graceful
 * shutdown via `closeQueues()`.
 */
export function createWorker(
  queueName: string,
  processor: (job: { name: string; data: Record<string, unknown> }) => Promise<void>,
  opts?: { concurrency?: number },
): Worker {
  const worker = new Worker(queueName, processor, {
    connection: getRedisConfig(),
    concurrency: opts?.concurrency ?? 1,
  });

  worker.on('failed', (job, err) => {
    console.error(`[Queue:${queueName}] Job ${job?.name} failed:`, err.message);
  });

  workers.push(worker);
  return worker;
}

// ── Repeatable job helpers ──────────────────────────────────────────

export interface RepeatableJobDef {
  queue: string;
  name: string;
  data?: Record<string, unknown>;
  opts: JobsOptions;
}

/**
 * Upsert repeatable jobs. BullMQ de-duplicates by (name + repeat pattern),
 * so calling this on every boot is safe and idempotent.
 */
export async function registerRepeatableJobs(defs: RepeatableJobDef[]): Promise<void> {
  for (const def of defs) {
    const q = getQueue(def.queue);
    await q.add(def.name, def.data ?? {}, def.opts);
  }
}

// ── Graceful shutdown ───────────────────────────────────────────────

export async function closeQueues(): Promise<void> {
  // Close workers first (stop processing), then queues.
  await Promise.all(workers.map((w) => w.close()));
  await Promise.all([...queues.values()].map((q) => q.close()));
  queues.clear();
  workers.length = 0;
}
