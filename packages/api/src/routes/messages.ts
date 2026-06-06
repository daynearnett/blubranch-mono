import {
  conversationListQuerySchema,
  messageThreadQuerySchema,
  sendMessageSchema,
  startConversationSchema,
} from '@blubranch/shared';
import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../auth/middleware.js';
import { getPrisma } from '../lib/prisma.js';
import { getRedis } from '../lib/redis.js';
import { parseBody } from '../lib/validate.js';
import { sendNotification } from '../services/push.js';

// Non-connections can send max 50 messages per day.
const NON_CONNECTION_DAILY_LIMIT = 50;

export async function messageRoutes(app: FastifyInstance): Promise<void> {
  const prisma = getPrisma();

  // ── Helper: check if two users are connected ────────────────────
  async function areConnected(userA: string, userB: string): Promise<boolean> {
    const conn = await prisma.connection.findFirst({
      where: {
        status: 'accepted',
        OR: [
          { requesterId: userA, receiverId: userB },
          { requesterId: userB, receiverId: userA },
        ],
      },
    });
    return !!conn;
  }

  // ── Helper: enforce 50/day non-connection message limit ─────────
  // Wrapped with a 2s timeout so a stalled Redis connection doesn't
  // block the entire message-send flow.
  async function checkNonConnectionLimit(senderId: string): Promise<boolean> {
    try {
      const result = await Promise.race([
        (async () => {
          const redis = getRedis();
          const key = `msg-limit:${senderId}`;
          const count = await redis.incr(key);
          if (count === 1) {
            await redis.expire(key, 86400);
          }
          return count <= NON_CONNECTION_DAILY_LIMIT;
        })(),
        new Promise<boolean>((resolve) => setTimeout(() => resolve(true), 2000)),
      ]);
      return result;
    } catch {
      // Redis down — allow the message through (fail open).
      return true;
    }
  }

  // ── Helper: find or create a conversation between two users ─────
  async function findOrCreateConversation(userAId: string, userBId: string) {
    // Normalize ordering: smaller UUID is always userA.
    const [a, b] = userAId < userBId ? [userAId, userBId] : [userBId, userAId];

    let convo = await prisma.conversation.findUnique({
      where: { userAId_userBId: { userAId: a, userBId: b } },
    });
    if (!convo) {
      convo = await prisma.conversation.create({
        data: { userAId: a, userBId: b },
      });
    }
    return convo;
  }

  // ── GET /conversations ─────────────────────────────────────────
  // List all conversations for the authenticated user, with last
  // message preview and unread count.
  app.get<{ Querystring: Record<string, string> }>(
    '/conversations',
    { preHandler: requireAuth },
    async (request, reply) => {
      const parsed = conversationListQuerySchema.safeParse(request.query);
      if (!parsed.success) return reply.code(400).send({ error: 'BadRequest' });
      const { page, limit } = parsed.data;
      const userId = request.user!.id;

      const conversations = await prisma.conversation.findMany({
        where: {
          OR: [{ userAId: userId }, { userBId: userId }],
        },
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          userA: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              profilePhotoUrl: true,
            },
          },
          userB: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              profilePhotoUrl: true,
            },
          },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              id: true,
              content: true,
              senderId: true,
              createdAt: true,
              readAt: true,
            },
          },
        },
      });

      // Compute unread counts per conversation.
      const results = await Promise.all(
        conversations.map(async (convo) => {
          const unreadCount = await prisma.message.count({
            where: {
              conversationId: convo.id,
              senderId: { not: userId },
              readAt: null,
            },
          });

          const otherUser = convo.userAId === userId ? convo.userB : convo.userA;
          const lastMessage = convo.messages[0] ?? null;

          return {
            id: convo.id,
            otherUser,
            lastMessage,
            unreadCount,
            updatedAt: convo.updatedAt,
          };
        }),
      );

      return reply.send({ conversations: results });
    },
  );

  // ── GET /conversations/:id/messages ────────────────────────────
  // Fetch messages in a conversation with cursor-based pagination.
  app.get<{ Params: { id: string }; Querystring: Record<string, string> }>(
    '/conversations/:id/messages',
    { preHandler: requireAuth },
    async (request, reply) => {
      const parsed = messageThreadQuerySchema.safeParse(request.query);
      if (!parsed.success) return reply.code(400).send({ error: 'BadRequest' });
      const { cursor, limit } = parsed.data;
      const userId = request.user!.id;
      const conversationId = request.params.id;

      // Verify the user is a participant.
      const convo = await prisma.conversation.findUnique({
        where: { id: conversationId },
      });
      if (!convo || (convo.userAId !== userId && convo.userBId !== userId)) {
        return reply.code(404).send({ error: 'Conversation not found' });
      }

      const messages = await prisma.message.findMany({
        where: {
          conversationId,
          ...(cursor ? { createdAt: { lt: (await prisma.message.findUnique({ where: { id: cursor } }))?.createdAt } } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          id: true,
          content: true,
          senderId: true,
          createdAt: true,
          readAt: true,
        },
      });

      const nextCursor = messages.length === limit ? messages[messages.length - 1]?.id : undefined;

      return reply.send({ messages, nextCursor });
    },
  );

  // ── POST /conversations/:id/messages ───────────────────────────
  // Send a message in an existing conversation.
  app.post<{ Params: { id: string } }>(
    '/conversations/:id/messages',
    { preHandler: requireAuth },
    async (request, reply) => {
      const body = parseBody(sendMessageSchema, request, reply);
      if (!body) return;
      const userId = request.user!.id;
      const conversationId = request.params.id;

      // Verify participant.
      const convo = await prisma.conversation.findUnique({
        where: { id: conversationId },
      });
      if (!convo || (convo.userAId !== userId && convo.userBId !== userId)) {
        return reply.code(404).send({ error: 'Conversation not found' });
      }

      const recipientId = convo.userAId === userId ? convo.userBId : convo.userAId;

      // Rate limit: 50/day to non-connections.
      const connected = await areConnected(userId, recipientId);
      if (!connected) {
        const allowed = await checkNonConnectionLimit(userId);
        if (!allowed) {
          return reply.code(429).send({
            error: 'RateLimited',
            message: 'You can send up to 50 messages per day to non-connections',
          });
        }
      }

      const message = await prisma.message.create({
        data: {
          conversationId,
          senderId: userId,
          content: body.content,
        },
        select: {
          id: true,
          content: true,
          senderId: true,
          createdAt: true,
          readAt: true,
        },
      });

      // Touch the conversation updatedAt so it sorts to the top.
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      });

      // Emit real-time event via Socket.io (import is lazy to avoid
      // circular dependency during startup).
      try {
        const { getIO } = await import('../lib/socket.js');
        const { emitNewMessage } = await import('../socket/message-handlers.js');
        emitNewMessage(getIO(), conversationId, recipientId, {
          id: message.id,
          senderId: message.senderId,
          content: message.content,
          createdAt: message.createdAt,
        });
      } catch {
        // Socket.io not initialized (e.g., in test env) — skip.
      }

      // Push notification to recipient (non-blocking).
      const sender = await prisma.user.findUnique({
        where: { id: userId },
        select: { firstName: true, lastName: true },
      });
      sendNotification({
        userId: recipientId,
        type: 'new_message',
        title: `${sender?.firstName ?? 'Someone'} ${sender?.lastName ?? ''}`.trim(),
        body: body.content.length > 100 ? body.content.slice(0, 97) + '...' : body.content,
        data: { conversationId, messageId: message.id },
      }).catch(() => {});

      return reply.code(201).send({ message });
    },
  );

  // ── POST /messages ─────────────────────────────────────────────
  // Start a new conversation or send to existing one, by recipientId.
  app.post(
    '/messages',
    { preHandler: requireAuth },
    async (request, reply) => {
      const body = parseBody(startConversationSchema, request, reply);
      if (!body) return;
      const userId = request.user!.id;

      if (body.recipientId === userId) {
        return reply.code(400).send({ error: 'Cannot message yourself' });
      }

      // Verify recipient exists.
      const recipient = await prisma.user.findUnique({
        where: { id: body.recipientId },
        select: { id: true },
      });
      if (!recipient) {
        return reply.code(404).send({ error: 'User not found' });
      }

      // Rate limit: 50/day to non-connections.
      const connected = await areConnected(userId, body.recipientId);
      if (!connected) {
        const allowed = await checkNonConnectionLimit(userId);
        if (!allowed) {
          return reply.code(429).send({
            error: 'RateLimited',
            message: 'You can send up to 50 messages per day to non-connections',
          });
        }
      }

      const convo = await findOrCreateConversation(userId, body.recipientId);

      const message = await prisma.message.create({
        data: {
          conversationId: convo.id,
          senderId: userId,
          content: body.content,
        },
        select: {
          id: true,
          content: true,
          senderId: true,
          createdAt: true,
          readAt: true,
        },
      });

      await prisma.conversation.update({
        where: { id: convo.id },
        data: { updatedAt: new Date() },
      });

      // Emit real-time event.
      try {
        const { getIO } = await import('../lib/socket.js');
        const { emitNewMessage } = await import('../socket/message-handlers.js');
        emitNewMessage(getIO(), convo.id, body.recipientId, {
          id: message.id,
          senderId: message.senderId,
          content: message.content,
          createdAt: message.createdAt,
        });
      } catch {
        // Socket.io not available — skip.
      }

      // Push notification (non-blocking).
      const sender = await prisma.user.findUnique({
        where: { id: userId },
        select: { firstName: true, lastName: true },
      });
      sendNotification({
        userId: body.recipientId,
        type: 'new_message',
        title: `${sender?.firstName ?? 'Someone'} ${sender?.lastName ?? ''}`.trim(),
        body: body.content.length > 100 ? body.content.slice(0, 97) + '...' : body.content,
        data: { conversationId: convo.id, messageId: message.id },
      }).catch(() => {});

      return reply.code(201).send({ conversation: { id: convo.id }, message });
    },
  );

  // ── PUT /conversations/:id/read ────────────────────────────────
  // Mark all messages in a conversation as read (for messages not sent
  // by the current user).
  app.put<{ Params: { id: string } }>(
    '/conversations/:id/read',
    { preHandler: requireAuth },
    async (request, reply) => {
      const userId = request.user!.id;
      const conversationId = request.params.id;

      const convo = await prisma.conversation.findUnique({
        where: { id: conversationId },
      });
      if (!convo || (convo.userAId !== userId && convo.userBId !== userId)) {
        return reply.code(404).send({ error: 'Conversation not found' });
      }

      const now = new Date();
      const result = await prisma.message.updateMany({
        where: {
          conversationId,
          senderId: { not: userId },
          readAt: null,
        },
        data: { readAt: now },
      });

      // Emit read receipt via Socket.io.
      if (result.count > 0) {
        try {
          const { getIO } = await import('../lib/socket.js');
          const { emitMessageRead } = await import('../socket/message-handlers.js');
          const senderId = convo.userAId === userId ? convo.userBId : convo.userAId;
          emitMessageRead(getIO(), conversationId, senderId, userId, now);
        } catch {
          // Socket.io not available — skip.
        }
      }

      return reply.send({ readCount: result.count });
    },
  );

  // ── GET /messages/unread-count ─────────────────────────────────
  // Total unread message count across all conversations (for badge).
  app.get(
    '/messages/unread-count',
    { preHandler: requireAuth },
    async (request, reply) => {
      const userId = request.user!.id;

      // Find all conversations the user is in.
      const conversations = await prisma.conversation.findMany({
        where: { OR: [{ userAId: userId }, { userBId: userId }] },
        select: { id: true },
      });
      const convoIds = conversations.map((c) => c.id);

      if (convoIds.length === 0) {
        return reply.send({ unreadCount: 0 });
      }

      const unreadCount = await prisma.message.count({
        where: {
          conversationId: { in: convoIds },
          senderId: { not: userId },
          readAt: null,
        },
      });

      return reply.send({ unreadCount });
    },
  );
}
