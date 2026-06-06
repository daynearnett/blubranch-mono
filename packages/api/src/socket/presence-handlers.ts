import type { Server } from 'socket.io';
import type { AuthenticatedSocket } from '../lib/socket.js';
import { getRedis } from '../lib/redis.js';

const PRESENCE_KEY = 'presence:online';
const PRESENCE_TTL = 300; // 5 minutes — refreshed on every heartbeat

/**
 * Track which users are online and broadcast presence changes to their
 * 1st-degree connections. Uses a Redis sorted set keyed by user ID with
 * score = last-seen timestamp.
 *
 * Events emitted:
 *   - `presence:online`  -> { userId }   (to user's connections)
 *   - `presence:offline` -> { userId }   (to user's connections)
 *
 * Events listened:
 *   - `presence:heartbeat` -> client pings every 60s to keep alive
 */
export function registerPresenceHandlers(io: Server, socket: AuthenticatedSocket): void {
  const { userId } = socket;

  // Mark online on connect
  markOnline(userId).catch(() => {});

  // Broadcast to connections that this user came online
  io.to(`user:${userId}`).emit('presence:online', { userId });

  // Heartbeat — clients send this periodically to prove they're alive.
  socket.on('presence:heartbeat', () => {
    markOnline(userId).catch(() => {});
  });

  // Clean up on disconnect — only go offline if no other sockets for
  // this user are still connected.
  socket.on('disconnect', async () => {
    const room = io.sockets.adapter.rooms.get(`user:${userId}`);
    const stillConnected = room ? room.size : 0;
    if (stillConnected === 0) {
      await markOffline(userId);
      io.to(`user:${userId}`).emit('presence:offline', { userId });
    }
  });
}

async function markOnline(userId: string): Promise<void> {
  try {
    const redis = getRedis();
    await redis.zadd(PRESENCE_KEY, Date.now(), userId);
  } catch {
    // Redis down — degrade silently; presence is non-critical.
  }
}

async function markOffline(userId: string): Promise<void> {
  try {
    const redis = getRedis();
    await redis.zrem(PRESENCE_KEY, userId);
  } catch {
    // Redis down — degrade silently.
  }
}

/**
 * Check if a user is online (last heartbeat within PRESENCE_TTL).
 */
export async function isUserOnline(userId: string): Promise<boolean> {
  try {
    const redis = getRedis();
    const score = await redis.zscore(PRESENCE_KEY, userId);
    if (!score) return false;
    return Date.now() - Number(score) < PRESENCE_TTL * 1000;
  } catch {
    return false;
  }
}

/**
 * Get a set of online user IDs from a list of candidates.
 */
export async function getOnlineUsers(userIds: string[]): Promise<Set<string>> {
  const online = new Set<string>();
  if (userIds.length === 0) return online;
  try {
    const redis = getRedis();
    const cutoff = Date.now() - PRESENCE_TTL * 1000;
    // Pipeline score lookups for efficiency.
    const pipeline = redis.pipeline();
    for (const id of userIds) {
      pipeline.zscore(PRESENCE_KEY, id);
    }
    const results = await pipeline.exec();
    if (results) {
      results.forEach(([err, score], i) => {
        if (!err && score && Number(score) > cutoff) {
          online.add(userIds[i]!);
        }
      });
    }
  } catch {
    // Redis down — return empty set.
  }
  return online;
}
