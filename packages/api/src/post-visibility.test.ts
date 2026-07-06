import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { buildApp } from './app.js';
import { signAccessToken } from './auth/jwt.js';
import { getPrisma } from './lib/prisma.js';
import type { FastifyInstance } from 'fastify';

// Access control for post reads: a `connections`-audience post must only be
// visible to the author + accepted connections; archived posts only to the
// author; `anyone` posts stay public. Covers GET /posts/:id, its comments,
// and the public /share/post/:id preview.
describe('Post audience visibility', () => {
  let app: FastifyInstance;
  const prisma = getPrisma();
  const stamp = Date.now();
  let author: { id: string; token: string };
  let friend: { id: string; token: string }; // accepted connection of author
  let stranger: { id: string; token: string }; // no connection
  let connPostId: string;
  let publicPostId: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    app = await buildApp();

    const mk = async (first: string) =>
      prisma.user.create({
        data: {
          firstName: first,
          lastName: 'Vis',
          email: `${first.toLowerCase()}-vis-${stamp}@test.local`,
          role: 'worker',
          authProvider: 'email',
          passwordHash: 'x',
        },
      });
    const a = await mk('Author');
    const f = await mk('Friend');
    const s = await mk('Stranger');
    author = { id: a.id, token: signAccessToken(a.id, 'worker') };
    friend = { id: f.id, token: signAccessToken(f.id, 'worker') };
    stranger = { id: s.id, token: signAccessToken(s.id, 'worker') };

    await prisma.connection.create({
      data: { requesterId: a.id, receiverId: f.id, status: 'accepted' },
    });

    const connPost = await prisma.post.create({
      data: { userId: a.id, content: 'Connections-only update', audience: 'connections' },
    });
    connPostId = connPost.id;
    const pubPost = await prisma.post.create({
      data: { userId: a.id, content: 'Public update', audience: 'anyone' },
    });
    publicPostId = pubPost.id;
  });

  afterAll(async () => {
    for (const u of [author, friend, stranger]) {
      if (u) await prisma.user.delete({ where: { id: u.id } }).catch(() => {});
    }
    await app.close();
  });

  const getPost = (id: string, token?: string) =>
    app.inject({
      method: 'GET',
      url: `/posts/${id}`,
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });

  it('author can read their own connections post', async () => {
    expect((await getPost(connPostId, author.token)).statusCode).toBe(200);
  });

  it('an accepted connection can read the connections post', async () => {
    expect((await getPost(connPostId, friend.token)).statusCode).toBe(200);
  });

  it('a non-connection gets 404 on the connections post', async () => {
    expect((await getPost(connPostId, stranger.token)).statusCode).toBe(404);
  });

  it('anyone-audience post is visible to a non-connection', async () => {
    expect((await getPost(publicPostId, stranger.token)).statusCode).toBe(200);
  });

  it('comments on a connections post require auth AND visibility', async () => {
    const anon = await app.inject({ method: 'GET', url: `/posts/${connPostId}/comments` });
    expect(anon.statusCode).toBe(401); // now requires auth

    const strangerRes = await app.inject({
      method: 'GET',
      url: `/posts/${connPostId}/comments`,
      headers: { authorization: `Bearer ${stranger.token}` },
    });
    expect(strangerRes.statusCode).toBe(404); // authed but not a viewer

    const friendRes = await app.inject({
      method: 'GET',
      url: `/posts/${connPostId}/comments`,
      headers: { authorization: `Bearer ${friend.token}` },
    });
    expect(friendRes.statusCode).toBe(200);
  });

  it('share preview reveals content for a public post but not a connections post', async () => {
    const pub = await app.inject({ method: 'GET', url: `/share/post/${publicPostId}` });
    expect(pub.statusCode).toBe(200);
    expect(pub.body).toContain('Public update');

    const conn = await app.inject({ method: 'GET', url: `/share/post/${connPostId}` });
    expect(conn.statusCode).toBe(200); // still serves a page...
    expect(conn.body).not.toContain('Connections-only update'); // ...but no leak
    expect(conn.body).not.toContain('Author Vis');
  });
});
