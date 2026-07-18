import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { buildApp } from './app.js';
import { signAccessToken } from './auth/jwt.js';
import { getPrisma } from './lib/prisma.js';
import type { FastifyInstance } from 'fastify';

// Requires a running Postgres with the BluBranch schema (same as messages.test).
// Covers the peer-networking flow: request → guardrails → accept, and confirms
// an accepted connection's posts surface in the requester's feed.

describe('Worker connection flow', () => {
  let app: FastifyInstance;
  const prisma = getPrisma();
  const stamp = Date.now();
  let alice: { id: string; token: string };
  let bob: { id: string; token: string };
  let connectionId: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    app = await buildApp();

    const a = await prisma.user.create({
      data: {
        firstName: 'Alice',
        lastName: 'Conn',
        email: `alice-conn-${stamp}@test.local`,
        role: 'worker',
        authProvider: 'email',
        passwordHash: 'not-a-real-hash',
      },
    });
    const b = await prisma.user.create({
      data: {
        firstName: 'Bob',
        lastName: 'Conn',
        email: `bob-conn-${stamp}@test.local`,
        role: 'worker',
        authProvider: 'email',
        passwordHash: 'not-a-real-hash',
      },
    });
    alice = { id: a.id, token: signAccessToken(a.id, 'worker') };
    bob = { id: b.id, token: signAccessToken(b.id, 'worker') };
  });

  afterAll(async () => {
    if (alice) await prisma.user.delete({ where: { id: alice.id } }).catch(() => {});
    if (bob) await prisma.user.delete({ where: { id: bob.id } }).catch(() => {});
    await app.close();
  });

  it('POST /connections/request — cannot connect with yourself (400)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/connections/request',
      headers: { authorization: `Bearer ${alice.token}` },
      payload: { receiverId: alice.id },
    });
    expect(res.statusCode).toBe(400);
  });

  it('POST /connections/request — Alice requests to connect with Bob', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/connections/request',
      headers: { authorization: `Bearer ${alice.token}` },
      payload: { receiverId: bob.id },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().status).toBe('pending');
    connectionId = res.json().id;
  });

  it('POST /connections/request — a duplicate pending request is rejected 409', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/connections/request',
      headers: { authorization: `Bearer ${alice.token}` },
      payload: { receiverId: bob.id },
    });
    expect(res.statusCode).toBe(409);
  });

  it('GET /connections/pending — Bob sees the incoming request', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/connections/pending',
      headers: { authorization: `Bearer ${bob.token}` },
    });
    expect(res.statusCode).toBe(200);
    const list = res.json() as Array<{ connectionId: string }>;
    const ids = list.map((c) => c.connectionId);
    expect(ids).toContain(connectionId);
  });

  it('PUT /connections/:id/accept — a non-receiver cannot accept (404)', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/connections/${connectionId}/accept`,
      headers: { authorization: `Bearer ${alice.token}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it('PUT /connections/:id/accept — Bob accepts', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/connections/${connectionId}/accept`,
      headers: { authorization: `Bearer ${bob.token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('accepted');
  });

  it("GET /feed — a connection's post surfaces in the requester's feed", async () => {
    // Bob posts; Alice (now connected) should see it in her feed.
    const post = await prisma.post.create({
      data: { userId: bob.id, content: `Bob's networked update ${stamp}`, audience: 'anyone' },
    });
    const res = await app.inject({
      method: 'GET',
      url: '/feed',
      headers: { authorization: `Bearer ${alice.token}` },
    });
    expect(res.statusCode).toBe(200);
    const items = res.json().items as Array<{ kind: string; data: { id: string } }>;
    const postIds = items.filter((i) => i.kind === 'post').map((i) => i.data.id);
    expect(postIds).toContain(post.id);
  });
});
