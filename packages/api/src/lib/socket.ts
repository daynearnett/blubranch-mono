import { Server as HttpServer } from 'node:http';
import { Server, type Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { verifyAccessToken } from '../auth/jwt.js';
import { getRedis, createRedisClient } from './redis.js';
import { registerMessageHandlers } from '../socket/message-handlers.js';
import { registerPresenceHandlers } from '../socket/presence-handlers.js';

export interface AuthenticatedSocket extends Socket {
  userId: string;
  userRole: string;
}

let io: Server | null = null;

/**
 * Attach Socket.io to an existing HTTP server. Called once during app
 * startup (from server.ts) after Fastify is listening.
 *
 * The same HTTP port serves both REST (via Fastify) and WebSocket
 * (via Socket.io) — no second port needed. Socket.io's upgrade
 * handshake intercepts WebSocket requests before Fastify sees them.
 */
export function setupSocketIO(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: (origin, cb) => {
        // Native mobile doesn't send Origin; allow it.
        if (!origin) return cb(null, true);
        // Match the same patterns as Fastify CORS.
        const allowed =
          /^https?:\/\/localhost(:\d+)?$/.test(origin) ||
          /^https?:\/\/127\.0\.0\.1(:\d+)?$/.test(origin) ||
          /^https?:\/\/.*\.blubranch\.com$/.test(origin) ||
          /^https?:\/\/blubranch\.com$/.test(origin);
        cb(null, allowed);
      },
      credentials: true,
    },
    // Start with polling, upgrade to WebSocket — works behind Railway's
    // reverse proxy and handles mobile network switches gracefully.
    transports: ['polling', 'websocket'],
    pingInterval: 25000,
    pingTimeout: 20000,
  });

  // Wire up Redis adapter for horizontal scaling. If Redis isn't
  // reachable the adapter silently falls back to in-process pub/sub
  // (single-instance mode) — fine for staging/dev.
  try {
    const pubClient = getRedis();
    const subClient = createRedisClient();
    io.adapter(createAdapter(pubClient, subClient));
  } catch (err) {
    console.warn('[Socket.io] Redis adapter setup failed, using in-memory adapter:', err);
  }

  // ── JWT authentication middleware ────────────────────────────────
  io.use((socket, next) => {
    const token =
      socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];
    if (!token) {
      return next(new Error('Authentication required'));
    }
    try {
      const payload = verifyAccessToken(token);
      (socket as AuthenticatedSocket).userId = payload.sub;
      (socket as AuthenticatedSocket).userRole = payload.role;
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  // ── Connection handler ───────────────────────────────────────────
  io.on('connection', (rawSocket) => {
    const socket = rawSocket as AuthenticatedSocket;
    const { userId } = socket;

    // Each user joins a private room keyed by their user ID so we can
    // push messages to them by ID regardless of how many tabs/devices
    // they have open.
    socket.join(`user:${userId}`);

    registerPresenceHandlers(io!, socket);
    registerMessageHandlers(io!, socket);

    socket.on('disconnect', () => {
      // Presence cleanup handled inside presence-handlers
    });
  });

  return io;
}

/**
 * Get the Socket.io server instance. Throws if called before setup.
 */
export function getIO(): Server {
  if (!io) throw new Error('Socket.io not initialized — call setupSocketIO first');
  return io;
}

/**
 * Graceful shutdown.
 */
export async function closeSocketIO(): Promise<void> {
  if (io) {
    await new Promise<void>((resolve) => io!.close(() => resolve()));
    io = null;
  }
}
