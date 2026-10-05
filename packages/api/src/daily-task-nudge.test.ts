import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { buildApp } from './app.js';
import { getPrisma } from './lib/prisma.js';
import {
  DAILY_TASKS,
  taskForDay,
  processDailyTaskNudge,
} from './jobs/daily-task-nudge.js';
import type { FastifyInstance } from 'fastify';

// Requires a running Postgres with the BluBranch schema. Covers the daily
// focus-group task nudge: deterministic rotation, one-per-day dedup, and the
// notifyDailyTasks preference gate.

const DAY_MS = 24 * 60 * 60 * 1000;

describe('taskForDay (unit)', () => {
  it('is deterministic within a day and rotates across days', () => {
    const noon = new Date('2026-10-05T12:00:00Z');
    const evening = new Date('2026-10-05T22:00:00Z');
    expect(taskForDay(noon).key).toBe(taskForDay(evening).key);

    const keys = new Set<string>();
    for (let d = 0; d < DAILY_TASKS.length; d++) {
      keys.add(taskForDay(new Date(noon.getTime() + d * DAY_MS)).key);
    }
    expect(keys.size).toBe(DAILY_TASKS.length); // full rotation, no repeats
  });

  it('every task has trade-voice copy fields', () => {
    for (const t of DAILY_TASKS) {
      expect(t.key.length).toBeGreaterThan(0);
      expect(t.title.length).toBeGreaterThan(0);
      expect(t.body.length).toBeGreaterThan(0);
    }
  });
});

describe('processDailyTaskNudge', () => {
  let app: FastifyInstance;
  const prisma = getPrisma();
  const stamp = Date.now();
  let worker: string;
  let optedOut: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    app = await buildApp();
    const w = await prisma.user.create({
      data: {
        firstName: 'Daily',
        lastName: 'Tasker',
        email: `daily-task-${stamp}@test.local`,
        role: 'worker',
        authProvider: 'email',
        passwordHash: 'not-a-real-hash',
      },
    });
    worker = w.id;
    const o = await prisma.user.create({
      data: {
        firstName: 'Opted',
        lastName: 'Out',
        email: `daily-task-out-${stamp}@test.local`,
        role: 'worker',
        authProvider: 'email',
        passwordHash: 'not-a-real-hash',
        settings: { create: { notifyDailyTasks: false } },
      },
    });
    optedOut = o.id;
  });

  afterAll(async () => {
    for (const id of [worker, optedOut]) {
      await prisma.user.delete({ where: { id } }).catch(() => {});
    }
    await app.close();
  });

  it("sends today's task to a worker, once", async () => {
    await processDailyTaskNudge();
    const notifs = await prisma.notification.findMany({
      where: { userId: worker, type: 'daily_task' },
    });
    expect(notifs).toHaveLength(1);
    const expected = taskForDay(new Date());
    expect(notifs[0]!.title).toBe(expected.title);
    expect((notifs[0]!.data as { task?: string } | null)?.task).toBe(expected.key);

    // Second run the same day: dedup, still exactly one.
    await processDailyTaskNudge();
    const after = await prisma.notification.count({
      where: { userId: worker, type: 'daily_task' },
    });
    expect(after).toBe(1);
  });

  it('respects notifyDailyTasks=false', async () => {
    const count = await prisma.notification.count({
      where: { userId: optedOut, type: 'daily_task' },
    });
    expect(count).toBe(0);
  });
});

describe('GET /admin/daily-task-completion', () => {
  let app: FastifyInstance;
  const prisma = getPrisma();
  const stamp = Date.now();
  let workerId: string;
  let adminToken: string;

  // A UTC day whose rotation slot is 'post', so the test knows which action
  // counts as "done".
  const DAY_MS_L = 24 * 60 * 60 * 1000;
  const postDay = (() => {
    const base = new Date('2026-10-01T00:00:00Z');
    for (let d = 0; d < DAILY_TASKS.length; d++) {
      const day = new Date(base.getTime() + d * DAY_MS_L);
      if (taskForDay(day).key === 'post') return day;
    }
    throw new Error('no post day found');
  })();

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    app = await buildApp();
    const { signAccessToken } = await import('./auth/jwt.js');
    const w = await prisma.user.create({
      data: {
        firstName: 'Compl',
        lastName: 'Worker',
        email: `compl-worker-${stamp}@test.local`,
        role: 'worker',
        authProvider: 'email',
        passwordHash: 'not-a-real-hash',
        posts: {
          create: {
            content: 'did my daily task',
            createdAt: new Date(postDay.getTime() + 15 * 60 * 60 * 1000),
          },
        },
      },
    });
    workerId = w.id;
    const a = await prisma.user.create({
      data: {
        firstName: 'Compl',
        lastName: 'Admin',
        email: `compl-admin-${stamp}@test.local`,
        role: 'admin',
        authProvider: 'email',
        passwordHash: 'not-a-real-hash',
      },
    });
    adminToken = signAccessToken(a.id, 'admin');
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { in: [`compl-worker-${stamp}@test.local`, `compl-admin-${stamp}@test.local`] } },
    });
    await app.close();
  });

  it('reports done=true for the worker who did the day task', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/admin/daily-task-completion?date=${postDay.toISOString().slice(0, 10)}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.task.key).toBe('post');
    const row = body.items.find((i: { id: string }) => i.id === workerId);
    expect(row).toBeTruthy();
    expect(row.done).toBe(true);
    expect(row.actions).toBeGreaterThan(0);
    expect(body.totals.done).toBeGreaterThanOrEqual(1);
  });

  it('rejects non-admin callers', async () => {
    const { signAccessToken } = await import('./auth/jwt.js');
    const res = await app.inject({
      method: 'GET',
      url: '/admin/daily-task-completion',
      headers: { authorization: `Bearer ${signAccessToken(workerId, 'worker')}` },
    });
    expect(res.statusCode).toBe(403);
  });
});
