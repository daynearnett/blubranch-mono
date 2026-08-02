import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { buildApp } from './app.js';
import { signAccessToken } from './auth/jwt.js';
import { getPrisma } from './lib/prisma.js';
import type { FastifyInstance } from 'fastify';

// Requires a running Postgres with the BluBranch schema. Covers Toolbox Talk
// (E2): lazy day-assignment + auto-seed, answer flow (correct key hidden until
// answered), single answer per day, and streak counting.

describe('Toolbox Talk — daily question', () => {
  let app: FastifyInstance;
  const prisma = getPrisma();
  const stamp = Date.now();
  let worker: { id: string; token: string };

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    app = await buildApp();
    const u = await prisma.user.create({
      data: {
        firstName: 'Toolbox',
        lastName: 'Tester',
        email: `toolbox-${stamp}@test.local`,
        role: 'worker',
        authProvider: 'email',
        passwordHash: 'not-a-real-hash',
      },
    });
    worker = { id: u.id, token: signAccessToken(u.id, 'worker') };
  });

  afterAll(async () => {
    if (worker) await prisma.user.delete({ where: { id: worker.id } }).catch(() => {});
    await app.close();
  });

  it('serves today’s question without the answer key (auto-seeds the bank)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/toolbox/today',
      headers: { authorization: `Bearer ${worker.token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.question.question.length).toBeGreaterThan(0);
    expect(Array.isArray(body.question.choices)).toBe(true);
    expect(body.question).not.toHaveProperty('correctIndex');
    expect(body.answered).toBeNull();
    expect(body.streak).toBe(0);

    const count = await prisma.toolboxQuestion.count();
    expect(count).toBeGreaterThan(10);
  });

  it('the same question is served for the whole day', async () => {
    const [a, b] = await Promise.all([
      app.inject({ method: 'GET', url: '/toolbox/today', headers: { authorization: `Bearer ${worker.token}` } }),
      app.inject({ method: 'GET', url: '/toolbox/today', headers: { authorization: `Bearer ${worker.token}` } }),
    ]);
    expect(a.json().question.id).toBe(b.json().question.id);
  });

  it('answering returns the verdict + explanation and starts a streak', async () => {
    const today = await app.inject({
      method: 'GET',
      url: '/toolbox/today',
      headers: { authorization: `Bearer ${worker.token}` },
    });
    const qId = today.json().question.id;
    const q = await prisma.toolboxQuestion.findUnique({ where: { id: qId } });

    const res = await app.inject({
      method: 'POST',
      url: '/toolbox/answer',
      headers: { authorization: `Bearer ${worker.token}` },
      payload: { choiceIndex: q!.correctIndex },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().correct).toBe(true);
    expect(res.json().explanation.length).toBeGreaterThan(0);
    expect(res.json().streak).toBe(1);
  });

  it('answering twice in a day conflicts, and today reflects the answered state', async () => {
    const dup = await app.inject({
      method: 'POST',
      url: '/toolbox/answer',
      headers: { authorization: `Bearer ${worker.token}` },
      payload: { choiceIndex: 0 },
    });
    expect(dup.statusCode).toBe(409);

    const today = await app.inject({
      method: 'GET',
      url: '/toolbox/today',
      headers: { authorization: `Bearer ${worker.token}` },
    });
    expect(today.json().answered).not.toBeNull();
    expect(today.json().answered.correct).toBe(true);
  });

  it('streak counts consecutive days (yesterday + today = 2)', async () => {
    // Backdate an answer to yesterday on a different question.
    const other = await prisma.toolboxQuestion.findFirst({ where: { activeOn: null } });
    await prisma.toolboxAnswer.create({
      data: {
        questionId: other!.id,
        userId: worker.id,
        choiceIndex: 0,
        correct: false,
        answeredAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
    });
    const stats = await app.inject({
      method: 'GET',
      url: '/toolbox/stats',
      headers: { authorization: `Bearer ${worker.token}` },
    });
    expect(stats.json().streak).toBe(2);
    expect(stats.json().answered).toBe(2);
    expect(stats.json().correct).toBe(1);
  });
});
