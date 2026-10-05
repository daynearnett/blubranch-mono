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
