import {
  notificationListQuerySchema,
  registerDeviceTokenSchema,
  notificationPreferencesSchema,
} from '@blubranch/shared';
import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../auth/middleware.js';
import { getPrisma } from '../lib/prisma.js';
import { parseBody } from '../lib/validate.js';

export async function notificationRoutes(app: FastifyInstance): Promise<void> {
  const prisma = getPrisma();

  // ── GET /notifications ─────────────────────────────────────────
  app.get<{ Querystring: Record<string, string> }>(
    '/notifications',
    { preHandler: requireAuth },
    async (request, reply) => {
      const parsed = notificationListQuerySchema.safeParse(request.query);
      if (!parsed.success) return reply.code(400).send({ error: 'BadRequest' });
      const { page, limit, unreadOnly } = parsed.data;
      const userId = request.user!.id;

      const where = {
        userId,
        ...(unreadOnly ? { readAt: null } : {}),
      };

      const [notifications, total] = await Promise.all([
        prisma.notification.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.notification.count({ where }),
      ]);

      return reply.send({
        notifications,
        total,
        page,
        totalPages: Math.ceil(total / limit),
      });
    },
  );

  // ── GET /notifications/unread-count ────────────────────────────
  app.get(
    '/notifications/unread-count',
    { preHandler: requireAuth },
    async (request, reply) => {
      const userId = request.user!.id;
      const count = await prisma.notification.count({
        where: { userId, readAt: null },
      });
      return reply.send({ unreadCount: count });
    },
  );

  // ── PUT /notifications/:id/read ────────────────────────────────
  app.put<{ Params: { id: string } }>(
    '/notifications/:id/read',
    { preHandler: requireAuth },
    async (request, reply) => {
      const userId = request.user!.id;
      const notification = await prisma.notification.findUnique({
        where: { id: request.params.id },
      });
      if (!notification || notification.userId !== userId) {
        return reply.code(404).send({ error: 'Notification not found' });
      }
      if (notification.readAt) {
        return reply.send({ notification });
      }
      const updated = await prisma.notification.update({
        where: { id: request.params.id },
        data: { readAt: new Date() },
      });
      return reply.send({ notification: updated });
    },
  );

  // ── PUT /notifications/read-all ────────────────────────────────
  app.put(
    '/notifications/read-all',
    { preHandler: requireAuth },
    async (request, reply) => {
      const userId = request.user!.id;
      const result = await prisma.notification.updateMany({
        where: { userId, readAt: null },
        data: { readAt: new Date() },
      });
      return reply.send({ readCount: result.count });
    },
  );

  // ── POST /devices/register ─────────────────────────────────────
  // Register a push notification device token (FCM).
  app.post(
    '/devices/register',
    { preHandler: requireAuth },
    async (request, reply) => {
      const body = parseBody(registerDeviceTokenSchema, request, reply);
      if (!body) return;
      const userId = request.user!.id;

      // Upsert — if the token already exists, update the user binding
      // (handles device transfers between accounts).
      const device = await prisma.deviceToken.upsert({
        where: { token: body.token },
        create: {
          userId,
          token: body.token,
          platform: body.platform,
        },
        update: {
          userId,
          platform: body.platform,
        },
      });

      return reply.code(201).send({ device });
    },
  );

  // ── DELETE /devices/:token ─────────────────────────────────────
  // Unregister a device token (on sign-out or app uninstall).
  app.delete<{ Params: { token: string } }>(
    '/devices/:token',
    { preHandler: requireAuth },
    async (request, reply) => {
      const userId = request.user!.id;
      const token = decodeURIComponent(request.params.token);
      await prisma.deviceToken.deleteMany({
        where: { token, userId },
      });
      return reply.code(204).send();
    },
  );

  // ── PUT /settings/notifications ────────────────────────────────
  // Update notification preferences.
  app.put(
    '/settings/notifications',
    { preHandler: requireAuth },
    async (request, reply) => {
      const body = parseBody(notificationPreferencesSchema, request, reply);
      if (!body) return;
      const userId = request.user!.id;

      const settings = await prisma.userSettings.upsert({
        where: { userId },
        create: { userId, ...body },
        update: body,
      });

      return reply.send({ settings });
    },
  );
}
