import { Redis } from 'ioredis';

let redis: Redis | null = null;

/**
 * Singleton Redis connection. Reads REDIS_URL from env; falls back to
 * localhost:6379 for local dev.
 *
 * Railway exposes REDIS_URL automatically when Redis is linked to the
 * API service. The URL includes auth credentials.
 */
export function getRedis(): Redis {
  if (redis) return redis;

  const url = process.env.REDIS_URL || 'redis://localhost:6379';
  redis = new Redis(url, {
    maxRetriesPerRequest: null, // required by BullMQ
    enableReadyCheck: false,
    connectTimeout: 3000, // fail fast if Redis isn't reachable
    retryStrategy: (times: number) => {
      if (times > 3) return null; // stop retrying after 3 attempts
      return Math.min(times * 200, 2000);
    },
    lazyConnect: true,
  });

  redis.on('error', (err: Error) => {
    // Log but don't crash — the app can still serve HTTP without Redis;
    // messaging/queues will degrade gracefully.
    console.error('[Redis] connection error:', err.message);
  });

  return redis;
}

/**
 * Create a new Redis instance for use as a subscriber (Socket.io Redis
 * adapter needs separate pub/sub connections).
 */
export function createRedisClient(): Redis {
  const url = process.env.REDIS_URL || 'redis://localhost:6379';
  return new Redis(url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy: (times: number) => Math.min(times * 200, 5000),
    lazyConnect: true,
  });
}

/**
 * Graceful shutdown — called from app close hook.
 */
export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}
