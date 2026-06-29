import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { buildApp } from './app.js';
import { signAccessToken } from './auth/jwt.js';
import { getPrisma } from './lib/prisma.js';
import type { FastifyInstance } from 'fastify';

// Requires a running Postgres with the BluBranch schema (same as messages.test).

describe('Moderation', () => {
  let app: FastifyInstance;
  let reporterId: string;
  let reporterToken: string;
  let authorId: string;
  let adminId: string;
  let adminToken: string;
  let postId: string;
  const prisma = getPrisma();
  const stamp = Date.now();

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    app = await buildApp();

    const reporter = await prisma.user.create({
      data: { firstName: 'Rita', lastName: 'Reporter', email: `rita-${stamp}@test.local`, role: 'worker', authProvider: 'email', passwordHash: 'x' },
    });
    reporterId = reporter.id;
    reporterToken = signAccessToken(reporter.id, 'worker');

    const author = await prisma.user.create({
      data: { firstName: 'Paul', lastName: 'Poster', email: `paul-${stamp}@test.local`, role: 'worker', authProvider: 'email', passwordHash: 'x' },
    });
    authorId = author.id;

    const adminUser = await prisma.user.create({
      data: { firstName: 'Mod', lastName: 'Admin', email: `mod-${stamp}@test.local`, role: 'admin', authProvider: 'email', passwordHash: 'x' },
    });
    adminId = adminUser.id;
    adminToken = signAccessToken(adminUser.id, 'admin');

    const post = await prisma.post.create({ data: { userId: authorId, content: 'A reportable post' } });
    postId = post.id;
  });

  afterAll(async () => {
    await prisma.report.deleteMany({ where: { reporterId } }).catch(() => {});
    await prisma.issue.deleteMany({ where: { userId: reporterId } }).catch(() => {});
    for (const id of [reporterId, authorId, adminId]) {
      await prisma.user.delete({ where: { id } }).catch(() => {});
    }
    await app.close();
  });

  it('POST /reports — creates a report', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/reports',
      headers: { authorization: `Bearer ${reporterToken}` },
      payload: { targetType: 'post', targetId: postId, reason: 'spam', details: 'looks spammy' },
    });
    expect(res.statusCode).toBe(201);
    const count = await prisma.report.count({ where: { reporterId, targetType: 'post', targetId: postId } });
    expect(count).toBe(1);
  });

  it('POST /reports — re-report is idempotent (no duplicate)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/reports',
      headers: { authorization: `Bearer ${reporterToken}` },
      payload: { targetType: 'post', targetId: postId, reason: 'explicit' },
    });
    expect(res.statusCode).toBe(201);
    const count = await prisma.report.count({ where: { reporterId, targetType: 'post', targetId: postId } });
    expect(count).toBe(1);
    const row = await prisma.report.findFirst({ where: { reporterId, targetId: postId } });
    expect(row!.reason).toBe('explicit'); // updated
  });

  it('POST /reports — cannot report yourself', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/reports',
      headers: { authorization: `Bearer ${reporterToken}` },
      payload: { targetType: 'user', targetId: reporterId, reason: 'spam' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('POST /reports — 404 for missing post', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/reports',
      headers: { authorization: `Bearer ${reporterToken}` },
      payload: { targetType: 'post', targetId: '00000000-0000-0000-0000-000000000000', reason: 'spam' },
    });
    expect(res.statusCode).toBe(404);
  });

  it('POST /issues — creates a bug report', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/issues',
      headers: { authorization: `Bearer ${reporterToken}` },
      payload: { title: 'Crash on feed', description: 'App crashes scrolling', appVersion: '0.1.5', platform: 'ios' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().id).toBeDefined();
  });

  it('GET /admin/reports — admin sees the report with a target preview', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/reports',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    const r = body.items.find((x: { targetId: string }) => x.targetId === postId);
    expect(r).toBeDefined();
    expect(r.target.summary).toContain('reportable post');
  });

  it('GET /admin/reports — non-admin gets 403', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/reports',
      headers: { authorization: `Bearer ${reporterToken}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('PUT /admin/reports/:id — resolve + archive the post', async () => {
    const report = await prisma.report.findFirst({ where: { targetId: postId } });
    const res = await app.inject({
      method: 'PUT',
      url: `/admin/reports/${report!.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { status: 'resolved', resolutionNote: 'removed', archiveTarget: true },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('resolved');
    const post = await prisma.post.findUnique({ where: { id: postId } });
    expect(post!.archived).toBe(true);
  });

  it('GET + PUT /admin/issues — list and update status', async () => {
    const list = await app.inject({
      method: 'GET',
      url: '/admin/issues',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(list.statusCode).toBe(200);
    const issue = list.json().items[0];
    expect(issue).toBeDefined();

    const upd = await app.inject({
      method: 'PUT',
      url: `/admin/issues/${issue.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { status: 'resolved' },
    });
    expect(upd.statusCode).toBe(200);
    expect(upd.json().status).toBe('resolved');
  });
});
