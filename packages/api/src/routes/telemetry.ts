// App usage telemetry. The mobile client posts one row per foreground
// stretch; the admin panel aggregates them under "App usage". Deliberately
// narrow: in-app foreground time only, never device screen time (no mobile
// OS exposes that to a regular app, and we don't want it).
import { appSessionInputSchema } from '@blubranch/shared';
import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../auth/middleware.js';
import { getPrisma } from '../lib/prisma.js';
import { parseBody } from '../lib/validate.js';

// A single stretch longer than this is a stuck timer (app left foregrounded
// on a charger overnight), not real use. Clamp rather than discard so the
// session count stays honest.
const MAX_SESSION_MS = 12 * 60 * 60 * 1000;

export async function telemetryRoutes(app: FastifyInstance): Promise<void> {
  const prisma = getPrisma();

  // POST /app-sessions — fire-and-forget from the client, so stay cheap.
  app.post('/app-sessions', { preHandler: requireAuth }, async (request, reply) => {
    const data = parseBody(appSessionInputSchema, request, reply);
    if (!data) return;

    const startedAt = new Date(data.startedAt);
    const endedAt = new Date(data.endedAt);
    if (endedAt.getTime() <= startedAt.getTime()) {
      return reply
        .code(400)
        .send({ error: 'ValidationError', message: 'endedAt must be after startedAt' });
    }

    await prisma.appSession.create({
      data: {
        userId: request.user!.id,
        startedAt,
        endedAt,
        durationMs: Math.min(endedAt.getTime() - startedAt.getTime(), MAX_SESSION_MS),
        platform: data.platform ?? null,
        appVersion: data.appVersion ?? null,
      },
      select: { id: true },
    });
    return reply.code(201).send({ recorded: true });
  });
}
