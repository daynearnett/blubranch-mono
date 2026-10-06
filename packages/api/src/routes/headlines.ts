// Today's Headlines — the feed card's data source.
import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../auth/middleware.js';
import { getTodayHeadline } from '../services/headlines.js';

export async function headlineRoutes(app: FastifyInstance): Promise<void> {
  app.get('/headlines/today', { preHandler: requireAuth }, async (_request, reply) => {
    const h = await getTodayHeadline();
    return reply.send({
      headline: h
        ? {
            id: h.id,
            title: h.title,
            url: h.url,
            source: h.source,
            summary: h.summary,
            imageUrl: h.imageUrl,
            publishedAt: h.publishedAt,
          }
        : null,
    });
  });
}
