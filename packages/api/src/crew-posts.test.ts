import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { buildApp } from './app.js';
import { signAccessToken } from './auth/jwt.js';
import { getPrisma } from './lib/prisma.js';
import type { FastifyInstance } from 'fastify';

// Requires a running Postgres with the BluBranch schema. Covers crew posts
// (E1): invite on create (connections only), accept/decline, and that only
// accepted co-authors appear in feed/post payloads.

describe('Crew posts — co-author invite/accept', () => {
  let app: FastifyInstance;
  const prisma = getPrisma();
  const stamp = Date.now();
  let author: { id: string; token: string };
  let buddy: { id: string; token: string };
  let stranger: { id: string; token: string };
  let postId: string;

  const mkUser = async (first: string) => {
    const u = await prisma.user.create({
      data: {
        firstName: first,
        lastName: 'Crew',
        email: `${first.toLowerCase()}-crew-${stamp}@test.local`,
        role: 'worker',
        authProvider: 'email',
        passwordHash: 'not-a-real-hash',
      },
    });
    return { id: u.id, token: signAccessToken(u.id, 'worker') };
  };

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    app = await buildApp();
    author = await mkUser('Alice');
    buddy = await mkUser('Bob');
    stranger = await mkUser('Sam');
    await prisma.connection.create({
      data: { requesterId: author.id, receiverId: buddy.id, status: 'accepted' },
    });
  });

  afterAll(async () => {
    for (const u of [author, buddy, stranger]) {
      if (u) await prisma.user.delete({ where: { id: u.id } }).catch(() => {});
    }
    await app.close();
  });

  it('creates a post with co-author invites; non-connections silently dropped', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/posts',
      headers: { authorization: `Bearer ${author.token}` },
      payload: {
        content: 'Topped out the tower today. Proud of this crew.',
        coauthorIds: [buddy.id, stranger.id],
      },
    });
    expect(res.statusCode).toBe(201);
    postId = res.json().id;

    const rows = await prisma.postCoauthor.findMany({ where: { postId } });
    expect(rows).toHaveLength(1); // stranger (not connected) dropped
    expect(rows[0]!.userId).toBe(buddy.id);
    expect(rows[0]!.status).toBe('pending');

    const notif = await prisma.notification.findFirst({
      where: { userId: buddy.id, type: 'coauthor_invite' },
    });
    expect(notif).not.toBeNull();
    expect(notif!.title).toContain('put you on a post');
  });

  it('pending invites do NOT appear as co-authors, but the invitee sees their status', async () => {
    const asBuddy = await app.inject({
      method: 'GET',
      url: `/posts/${postId}`,
      headers: { authorization: `Bearer ${buddy.token}` },
    });
    expect(asBuddy.statusCode).toBe(200);
    expect(asBuddy.json().coauthors).toHaveLength(0);
    expect(asBuddy.json().viewerCoauthorStatus).toBe('pending');
  });

  it('a stranger cannot respond to an invite that is not theirs', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/posts/${postId}/coauthor`,
      headers: { authorization: `Bearer ${stranger.token}` },
      payload: { action: 'accept' },
    });
    expect(res.statusCode).toBe(404);
  });

  it('accepting surfaces the co-author on the post and in the feed', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/posts/${postId}/coauthor`,
      headers: { authorization: `Bearer ${buddy.token}` },
      payload: { action: 'accept' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('accepted');

    const detail = await app.inject({
      method: 'GET',
      url: `/posts/${postId}`,
      headers: { authorization: `Bearer ${author.token}` },
    });
    expect(detail.json().coauthors).toHaveLength(1);
    expect(detail.json().coauthors[0].id).toBe(buddy.id);

    const feed = await app.inject({
      method: 'GET',
      url: '/feed',
      headers: { authorization: `Bearer ${buddy.token}` },
    });
    const item = feed
      .json()
      .items.find(
        (i: { kind: string; data: { id: string } }) => i.kind === 'post' && i.data.id === postId,
      );
    expect(item).toBeDefined();
    expect(item.data.coauthors).toHaveLength(1);
    expect(item.data.coauthors[0].firstName).toBe('Bob');
  });

  it('responding twice conflicts', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/posts/${postId}/coauthor`,
      headers: { authorization: `Bearer ${buddy.token}` },
      payload: { action: 'decline' },
    });
    expect(res.statusCode).toBe(409);
  });
});
