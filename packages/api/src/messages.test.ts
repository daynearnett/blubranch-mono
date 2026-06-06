import { describe, expect, it, beforeAll, afterAll, vi } from 'vitest';
import { buildApp } from './app.js';
import { signAccessToken } from './auth/jwt.js';
import { getPrisma } from './lib/prisma.js';
import type { FastifyInstance } from 'fastify';

// These tests require a running Postgres with the BluBranch schema.
// Skip in CI if DATABASE_URL is not configured.

describe('Messaging routes', () => {
  let app: FastifyInstance;
  let workerA: { id: string; token: string };
  let workerB: { id: string; token: string };
  const prisma = getPrisma();

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    app = await buildApp();

    // Create two test users directly in the DB.
    const userA = await prisma.user.create({
      data: {
        firstName: 'Alice',
        lastName: 'TestMsg',
        email: `alice-msg-${Date.now()}@test.local`,
        role: 'worker',
        authProvider: 'email',
        passwordHash: 'not-a-real-hash',
      },
    });
    const userB = await prisma.user.create({
      data: {
        firstName: 'Bob',
        lastName: 'TestMsg',
        email: `bob-msg-${Date.now()}@test.local`,
        role: 'worker',
        authProvider: 'email',
        passwordHash: 'not-a-real-hash',
      },
    });

    workerA = { id: userA.id, token: signAccessToken(userA.id, 'worker') };
    workerB = { id: userB.id, token: signAccessToken(userB.id, 'worker') };
  });

  afterAll(async () => {
    // Clean up test data.
    if (workerA) await prisma.user.delete({ where: { id: workerA.id } }).catch(() => {});
    if (workerB) await prisma.user.delete({ where: { id: workerB.id } }).catch(() => {});
    await app.close();
  });

  it('POST /messages — creates a conversation and sends first message', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/messages',
      headers: { authorization: `Bearer ${workerA.token}` },
      payload: { recipientId: workerB.id, content: 'Hey Bob, nice to meet you!' },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.conversation.id).toBeDefined();
    expect(body.message.content).toBe('Hey Bob, nice to meet you!');
    expect(body.message.senderId).toBe(workerA.id);
  });

  it('GET /conversations — lists conversations for the sender', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/conversations',
      headers: { authorization: `Bearer ${workerA.token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.conversations.length).toBeGreaterThanOrEqual(1);

    const convo = body.conversations.find(
      (c: { otherUser: { id: string } }) => c.otherUser.id === workerB.id,
    );
    expect(convo).toBeDefined();
    expect(convo.lastMessage.content).toBe('Hey Bob, nice to meet you!');
    expect(convo.unreadCount).toBe(0); // sender sees 0 unread
  });

  it('GET /conversations — recipient sees unread message', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/conversations',
      headers: { authorization: `Bearer ${workerB.token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    const convo = body.conversations.find(
      (c: { otherUser: { id: string } }) => c.otherUser.id === workerA.id,
    );
    expect(convo).toBeDefined();
    expect(convo.unreadCount).toBe(1);
  });

  it('POST /conversations/:id/messages — sends in existing conversation', async () => {
    // Get the conversation ID first.
    const listRes = await app.inject({
      method: 'GET',
      url: '/conversations',
      headers: { authorization: `Bearer ${workerB.token}` },
    });
    const convoId = listRes.json().conversations[0].id;

    const res = await app.inject({
      method: 'POST',
      url: `/conversations/${convoId}/messages`,
      headers: { authorization: `Bearer ${workerB.token}` },
      payload: { content: 'Hey Alice! Good to connect.' },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().message.senderId).toBe(workerB.id);
  });

  it('PUT /conversations/:id/read — marks messages as read', async () => {
    const listRes = await app.inject({
      method: 'GET',
      url: '/conversations',
      headers: { authorization: `Bearer ${workerA.token}` },
    });
    const convoId = listRes.json().conversations[0].id;

    const res = await app.inject({
      method: 'PUT',
      url: `/conversations/${convoId}/read`,
      headers: { authorization: `Bearer ${workerA.token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().readCount).toBe(1); // Bob's reply was unread
  });

  it('GET /messages/unread-count — returns 0 after marking read', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/messages/unread-count',
      headers: { authorization: `Bearer ${workerA.token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().unreadCount).toBe(0);
  });

  it('GET /conversations/:id/messages — returns paginated thread', async () => {
    const listRes = await app.inject({
      method: 'GET',
      url: '/conversations',
      headers: { authorization: `Bearer ${workerA.token}` },
    });
    const convoId = listRes.json().conversations[0].id;

    const res = await app.inject({
      method: 'GET',
      url: `/conversations/${convoId}/messages?limit=10`,
      headers: { authorization: `Bearer ${workerA.token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.messages.length).toBe(2); // two messages sent in this test
    // Most recent first.
    expect(body.messages[0].content).toBe('Hey Alice! Good to connect.');
    expect(body.messages[1].content).toBe('Hey Bob, nice to meet you!');
  });

  it('POST /messages — rejects self-messaging', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/messages',
      headers: { authorization: `Bearer ${workerA.token}` },
      payload: { recipientId: workerA.id, content: 'Talking to myself' },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 401 without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/conversations' });
    expect(res.statusCode).toBe(401);
  });
});
