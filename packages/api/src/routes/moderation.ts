// Phase 6 — user-facing moderation: content reports + in-app bug reports.
// Admin review of these lives in routes/admin.ts (/admin/reports, /admin/issues).
import { issueInputSchema, reportInputSchema } from '@blubranch/shared';
import { Prisma } from '@blubranch/db';
import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../auth/middleware.js';
import { getPrisma } from '../lib/prisma.js';
import { parseBody } from '../lib/validate.js';

export async function moderationRoutes(app: FastifyInstance): Promise<void> {
  const prisma = getPrisma();

  // POST /reports — report a post / comment / user / message.
  app.post('/reports', { preHandler: requireAuth }, async (request, reply) => {
    const data = parseBody(reportInputSchema, request, reply);
    if (!data) return;
    const reporterId = request.user!.id;

    // Can't report yourself.
    if (data.targetType === 'user' && data.targetId === reporterId) {
      return reply.code(400).send({ error: 'BadRequest', message: "You can't report yourself." });
    }

    // Validate the target exists for the types we own (best-effort; messages
    // aren't existence-checked to keep this cheap).
    if (data.targetType === 'post') {
      const exists = await prisma.post.findUnique({ where: { id: data.targetId }, select: { id: true } });
      if (!exists) return reply.code(404).send({ error: 'NotFound', message: 'Post not found' });
    } else if (data.targetType === 'comment') {
      const exists = await prisma.postComment.findUnique({ where: { id: data.targetId }, select: { id: true } });
      if (!exists) return reply.code(404).send({ error: 'NotFound', message: 'Comment not found' });
    } else if (data.targetType === 'user') {
      const exists = await prisma.user.findUnique({ where: { id: data.targetId }, select: { id: true } });
      if (!exists) return reply.code(404).send({ error: 'NotFound', message: 'User not found' });
    }

    // One report per reporter+target; re-reporting updates the reason/details
    // and re-opens it if it had been resolved.
    try {
      await prisma.report.upsert({
        where: {
          reporterId_targetType_targetId: {
            reporterId,
            targetType: data.targetType,
            targetId: data.targetId,
          },
        },
        create: {
          reporterId,
          targetType: data.targetType,
          targetId: data.targetId,
          reason: data.reason,
          details: data.details ?? null,
        },
        update: {
          reason: data.reason,
          details: data.details ?? null,
          status: 'pending',
          resolvedAt: null,
          resolvedById: null,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        return reply.code(400).send({ error: 'BadRequest' });
      }
      throw err;
    }

    return reply.code(201).send({ reported: true });
  });

  // POST /issues — in-app bug report.
  app.post('/issues', { preHandler: requireAuth }, async (request, reply) => {
    const data = parseBody(issueInputSchema, request, reply);
    if (!data) return;
    const issue = await prisma.issue.create({
      data: {
        userId: request.user!.id,
        title: data.title,
        description: data.description,
        screenshotUrl: data.screenshotUrl ?? null,
        appVersion: data.appVersion ?? null,
        platform: data.platform ?? null,
        deviceInfo: data.deviceInfo ?? null,
      },
      select: { id: true },
    });
    return reply.code(201).send({ id: issue.id, submitted: true });
  });
}
