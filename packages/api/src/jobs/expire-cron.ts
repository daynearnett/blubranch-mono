// Hourly tick to flip jobs whose expires_at has passed → status='expired'.
// Phase 4 will move scheduled work onto BullMQ; for Phase 3 a setInterval
// inside the API process is sufficient and avoids a queue dependency.

import type { FastifyInstance } from 'fastify';
import { getPrisma } from '../lib/prisma.js';

const HOUR_MS = 60 * 60 * 1000;

export function startExpireCron(app: FastifyInstance): () => void {
  const tick = async () => {
    try {
      const result = await getPrisma().job.updateMany({
        where: { status: 'open', expiresAt: { lte: new Date() } },
        data: { status: 'expired' },
      });
      if (result.count > 0) {
        app.log.info({ expired: result.count }, 'expire-cron: closed stale listings');
      }
    } catch (err) {
      app.log.error({ err }, 'expire-cron failed');
    }
  };

  // Fire once on boot so a fresh API container catches up immediately.
  tick();
  const handle = setInterval(tick, HOUR_MS);

  return () => clearInterval(handle);
}
