import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { buildApp } from './app.js';
import { signAccessToken } from './auth/jwt.js';
import { getPrisma } from './lib/prisma.js';
import type { FastifyInstance } from 'fastify';

// Requires a running Postgres with the BluBranch schema (same as messages.test).
// Covers the social flow: a worker posts, and a second worker likes, comments,
// and re-shares (native OS share is backed server-side by GET /share/post/:id).

describe('Post + like + comment + share flow', () => {
  let app: FastifyInstance;
  const prisma = getPrisma();
  const stamp = Date.now();
  let author: { id: string; token: string };
  let reader: { id: string; token: string };
  let postId: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    app = await buildApp();

    const a = await prisma.user.create({
      data: {
        firstName: 'Paula',
        lastName: 'Poster',
        email: `paula-post-${stamp}@test.local`,
        role: 'worker',
        authProvider: 'email',
        passwordHash: 'not-a-real-hash',
      },
    });
    const b = await prisma.user.create({
      data: {
        firstName: 'Rita',
        lastName: 'Reader',
        email: `rita-post-${stamp}@test.local`,
        role: 'worker',
        authProvider: 'email',
        passwordHash: 'not-a-real-hash',
      },
    });
    author = { id: a.id, token: signAccessToken(a.id, 'worker') };
    reader = { id: b.id, token: signAccessToken(b.id, 'worker') };
  });

  afterAll(async () => {
    if (author) await prisma.user.delete({ where: { id: author.id } }).catch(() => {});
    if (reader) await prisma.user.delete({ where: { id: reader.id } }).catch(() => {});
    await app.close();
  });

  it('POST /posts — worker creates a post', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/posts',
      headers: { authorization: `Bearer ${author.token}` },
      payload: { content: 'Wrapped up a big commercial panel today. #proud' },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.id).toBeDefined();
    expect(body.content).toContain('commercial panel');
    postId = body.id;
  });

  it('POST /posts — empty content is rejected 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/posts',
      headers: { authorization: `Bearer ${author.token}` },
      payload: { content: '' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('POST /posts requires auth', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/posts',
      payload: { content: 'anon' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('POST /posts/:id/like — a second worker likes the post', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/posts/${postId}/like`,
      headers: { authorization: `Bearer ${reader.token}` },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().liked).toBe(true);

    const count = await prisma.postLike.count({ where: { postId } });
    expect(count).toBe(1);
  });

  it('POST /posts/:id/like — liking again is idempotent (no double-count)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/posts/${postId}/like`,
      headers: { authorization: `Bearer ${reader.token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().liked).toBe(true);
    const count = await prisma.postLike.count({ where: { postId } });
    expect(count).toBe(1);
  });

  it('DELETE /posts/:id/like — unlikes the post', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/posts/${postId}/like`,
      headers: { authorization: `Bearer ${reader.token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().liked).toBe(false);
    const count = await prisma.postLike.count({ where: { postId } });
    expect(count).toBe(0);
  });

  it('POST /posts/:id/comments — a second worker comments', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/posts/${postId}/comments`,
      headers: { authorization: `Bearer ${reader.token}` },
      payload: { content: 'Clean work!' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().content).toBe('Clean work!');
  });

  it('GET /posts/:id/comments — lists the comment', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/posts/${postId}/comments`,
      headers: { authorization: `Bearer ${reader.token}` },
    });
    expect(res.statusCode).toBe(200);
    const comments = res.json();
    expect(Array.isArray(comments)).toBe(true);
    expect(comments.some((c: { content: string }) => c.content === 'Clean work!')).toBe(true);
  });

  it('GET /posts/:id — returns the post in feed shape with counts', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/posts/${postId}`,
      headers: { authorization: `Bearer ${reader.token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.id).toBe(postId);
    expect(body.commentCount).toBe(1);
    expect(body.user.id).toBe(author.id);
  });

  it('GET /share/post/:id — reshare target serves OpenGraph HTML for the post', async () => {
    // "Reshare" in the app is a native OS share of this public URL — there is
    // no repost row; the server backs it with OG HTML deep-linking into the app.
    const res = await app.inject({ method: 'GET', url: `/share/post/${postId}` });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.body).toContain('og:');
  });

  it('DELETE /posts/:id — a non-owner cannot delete', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/posts/${postId}`,
      headers: { authorization: `Bearer ${reader.token}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('PUT /posts/:id/archive — owner archives the post', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/posts/${postId}/archive`,
      headers: { authorization: `Bearer ${author.token}` },
      payload: { archived: true },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().archived).toBe(true);
  });

  it('DELETE /posts/:id — owner deletes the post', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/posts/${postId}`,
      headers: { authorization: `Bearer ${author.token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().deleted).toBe(true);
    const gone = await prisma.post.findUnique({ where: { id: postId } });
    expect(gone).toBeNull();
  });
});
