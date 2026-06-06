import { connectionListQuerySchema, connectionRequestSchema } from '@blubranch/shared';
import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../auth/middleware.js';
import { getPrisma } from '../lib/prisma.js';
import { parseBody } from '../lib/validate.js';
import { sendNotification } from '../services/push.js';

export async function connectionRoutes(app: FastifyInstance): Promise<void> {
  const prisma = getPrisma();

  // ── GET /connections ────────────────────────────────────────────
  app.get<{ Querystring: Record<string, string> }>(
    '/connections',
    { preHandler: requireAuth },
    async (request, reply) => {
      const parsed = connectionListQuerySchema.safeParse(request.query);
      if (!parsed.success) return reply.code(400).send({ error: 'BadRequest' });
      const { search, sort, page, limit } = parsed.data;
      const userId = request.user!.id;

      const where = {
        status: 'accepted' as const,
        OR: [{ requesterId: userId }, { receiverId: userId }],
      };

      const orderBy = sort === 'first_name'
        ? { createdAt: 'desc' as const }
        : sort === 'last_name'
          ? { createdAt: 'desc' as const }
          : { createdAt: 'desc' as const };

      const [connections, total] = await Promise.all([
        prisma.connection.findMany({
          where,
          orderBy,
          skip: (page - 1) * limit,
          take: limit,
          include: {
            requester: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                profilePhotoUrl: true,
                isVerified: true,
                workerProfile: { select: { headline: true, city: true, state: true } },
                trades: { include: { trade: true }, take: 1 },
              },
            },
            receiver: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                profilePhotoUrl: true,
                isVerified: true,
                workerProfile: { select: { headline: true, city: true, state: true } },
                trades: { include: { trade: true }, take: 1 },
              },
            },
          },
        }),
        prisma.connection.count({ where }),
      ]);

      const items = connections.map((c) => {
        const other = c.requesterId === userId ? c.receiver : c.requester;
        return {
          connectionId: c.id,
          connectedAt: c.createdAt,
          user: {
            id: other.id,
            firstName: other.firstName,
            lastName: other.lastName,
            profilePhotoUrl: other.profilePhotoUrl,
            isVerified: other.isVerified,
            headline: other.workerProfile?.headline ?? null,
            city: other.workerProfile?.city ?? null,
            state: other.workerProfile?.state ?? null,
            trade: other.trades[0]?.trade?.name ?? null,
          },
        };
      });

      if (search) {
        const q = search.toLowerCase();
        const filtered = items.filter(
          (i) =>
            i.user.firstName.toLowerCase().includes(q) ||
            i.user.lastName.toLowerCase().includes(q) ||
            (i.user.trade && i.user.trade.toLowerCase().includes(q)),
        );
        return reply.send({ items: filtered, total: filtered.length, page, limit });
      }

      return reply.send({ items, total, page, limit });
    },
  );

  // ── GET /connections/pending ────────────────────────────────────
  app.get('/connections/pending', { preHandler: requireAuth }, async (request, reply) => {
    const userId = request.user!.id;
    const pending = await prisma.connection.findMany({
      where: { receiverId: userId, status: 'pending' },
      orderBy: { createdAt: 'desc' },
      include: {
        requester: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profilePhotoUrl: true,
            isVerified: true,
            workerProfile: { select: { headline: true, city: true, state: true } },
            trades: { include: { trade: true }, take: 1 },
          },
        },
      },
    });

    return reply.send(
      pending.map((c) => ({
        connectionId: c.id,
        createdAt: c.createdAt,
        user: {
          id: c.requester.id,
          firstName: c.requester.firstName,
          lastName: c.requester.lastName,
          profilePhotoUrl: c.requester.profilePhotoUrl,
          isVerified: c.requester.isVerified,
          headline: c.requester.workerProfile?.headline ?? null,
          city: c.requester.workerProfile?.city ?? null,
          state: c.requester.workerProfile?.state ?? null,
          trade: c.requester.trades[0]?.trade?.name ?? null,
        },
      })),
    );
  });

  // ── POST /connections/request ───────────────────────────────────
  app.post('/connections/request', { preHandler: requireAuth }, async (request, reply) => {
    const data = parseBody(connectionRequestSchema, request, reply);
    if (!data) return;
    const userId = request.user!.id;

    if (data.receiverId === userId) {
      return reply.code(400).send({ error: 'BadRequest', message: 'Cannot connect with yourself' });
    }

    const receiver = await prisma.user.findUnique({ where: { id: data.receiverId } });
    if (!receiver) return reply.code(404).send({ error: 'NotFound' });

    const existing = await prisma.connection.findFirst({
      where: {
        OR: [
          { requesterId: userId, receiverId: data.receiverId },
          { requesterId: data.receiverId, receiverId: userId },
        ],
      },
    });

    if (existing) {
      if (existing.status === 'accepted') {
        return reply.code(409).send({ error: 'Conflict', message: 'Already connected' });
      }
      if (existing.status === 'pending') {
        return reply.code(409).send({ error: 'Conflict', message: 'Request already pending' });
      }
    }

    // Rate limit: max 10 requests per day
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayCount = await prisma.connection.count({
      where: { requesterId: userId, createdAt: { gte: today } },
    });
    if (todayCount >= 10) {
      return reply.code(429).send({ error: 'TooManyRequests', message: 'Max 10 connection requests per day' });
    }

    const connection = await prisma.connection.create({
      data: { requesterId: userId, receiverId: data.receiverId, status: 'pending' },
    });

    // Push notification to receiver (non-blocking).
    const requester = await prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true },
    });
    sendNotification({
      userId: data.receiverId,
      type: 'connection_request',
      title: 'New connection request',
      body: `${requester?.firstName ?? 'Someone'} ${requester?.lastName ?? ''} wants to connect`.trim(),
      data: { connectionId: connection.id, requesterId: userId },
    }).catch(() => {});

    return reply.code(201).send(connection);
  });

  // ── PUT /connections/:id/accept ─────────────────────────────────
  app.put<{ Params: { id: string } }>(
    '/connections/:id/accept',
    { preHandler: requireAuth },
    async (request, reply) => {
      const userId = request.user!.id;
      const connection = await prisma.connection.findUnique({
        where: { id: request.params.id },
      });

      if (!connection || connection.receiverId !== userId) {
        return reply.code(404).send({ error: 'NotFound' });
      }
      if (connection.status !== 'pending') {
        return reply.code(400).send({ error: 'BadRequest', message: 'Not a pending request' });
      }

      const updated = await prisma.connection.update({
        where: { id: connection.id },
        data: { status: 'accepted' },
      });

      // Push notification to requester that their request was accepted.
      const accepter = await prisma.user.findUnique({
        where: { id: userId },
        select: { firstName: true, lastName: true },
      });
      sendNotification({
        userId: connection.requesterId,
        type: 'connection_accepted',
        title: 'Connection accepted',
        body: `${accepter?.firstName ?? 'Someone'} ${accepter?.lastName ?? ''} accepted your connection request`.trim(),
        data: { connectionId: connection.id },
      }).catch(() => {});

      return reply.send(updated);
    },
  );

  // ── DELETE /connections/:id ─────────────────────────────────────
  app.delete<{ Params: { id: string } }>(
    '/connections/:id',
    { preHandler: requireAuth },
    async (request, reply) => {
      const userId = request.user!.id;
      const connection = await prisma.connection.findUnique({
        where: { id: request.params.id },
      });

      if (!connection) return reply.code(404).send({ error: 'NotFound' });
      if (connection.requesterId !== userId && connection.receiverId !== userId) {
        return reply.code(404).send({ error: 'NotFound' });
      }

      await prisma.connection.delete({ where: { id: connection.id } });
      return reply.code(204).send();
    },
  );

  // ── GET /network/suggestions ────────────────────────────────────
  app.get('/network/suggestions', { preHandler: requireAuth }, async (request, reply) => {
    const userId = request.user!.id;

    // Get user's connections to exclude
    const myConnections = await prisma.connection.findMany({
      where: {
        OR: [{ requesterId: userId }, { receiverId: userId }],
      },
      select: { requesterId: true, receiverId: true },
    });
    const connectedIds = new Set(
      myConnections.flatMap((c) => [c.requesterId, c.receiverId]),
    );
    connectedIds.add(userId);

    // Get user's trade and location for scoring
    const me = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        workerProfile: true,
        trades: { select: { tradeId: true } },
      },
    });

    const myTradeIds = me?.trades.map((t) => t.tradeId) ?? [];
    const myCity = me?.workerProfile?.city ?? '';
    const myState = me?.workerProfile?.state ?? '';

    // Fetch candidate users (not already connected, limit pool)
    const candidates = await prisma.user.findMany({
      where: {
        id: { notIn: [...connectedIds] },
        role: 'worker',
      },
      take: 50,
      include: {
        workerProfile: { select: { city: true, state: true, headline: true, unionName: true } },
        trades: { include: { trade: true }, take: 1 },
      },
    });

    // Score and sort
    const scored = candidates.map((c) => {
      let score = 0;
      const cTradeIds = c.trades.map((t) => t.tradeId);
      if (cTradeIds.some((id) => myTradeIds.includes(id))) score += 2;
      if (c.workerProfile?.state === myState) score += 1;
      if (c.workerProfile?.city === myCity && myCity) score += 2;
      return {
        id: c.id,
        firstName: c.firstName,
        lastName: c.lastName,
        profilePhotoUrl: c.profilePhotoUrl,
        isVerified: c.isVerified,
        headline: c.workerProfile?.headline ?? null,
        city: c.workerProfile?.city ?? null,
        state: c.workerProfile?.state ?? null,
        trade: c.trades[0]?.trade?.name ?? null,
        score,
      };
    });

    scored.sort((a, b) => b.score - a.score);

    return reply.send(scored.slice(0, 20));
  });
}
