import { toolboxAnswerSchema } from '@blubranch/shared';
import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../auth/middleware.js';
import { getPrisma } from '../lib/prisma.js';
import { parseBody } from '../lib/validate.js';
import { TOOLBOX_STARTER_BANK } from '../data/toolbox-questions.js';

// Toolbox Talk (E2) — one code/safety question a day, with per-user streaks.
// The day's question is assigned lazily on first request (unique activeOn
// absorbs races); the bank auto-seeds when empty and recycles oldest-first.

const DAY_MS = 24 * 60 * 60 * 1000;

function utcToday(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export async function toolboxRoutes(app: FastifyInstance): Promise<void> {
  const prisma = getPrisma();

  async function ensureTodayQuestion() {
    const today = utcToday();
    const existing = await prisma.toolboxQuestion.findUnique({ where: { activeOn: today } });
    if (existing) return existing;

    if ((await prisma.toolboxQuestion.count()) === 0) {
      await prisma.toolboxQuestion.createMany({
        data: TOOLBOX_STARTER_BANK.map((q) => ({
          question: q.question,
          choices: q.choices,
          correctIndex: q.correctIndex,
          explanation: q.explanation,
        })),
      });
    }

    // Fresh (never-run) questions first; recycle the longest-ago one after that.
    const candidate =
      (await prisma.toolboxQuestion.findFirst({
        where: { activeOn: null },
        orderBy: { createdAt: 'asc' },
      })) ??
      (await prisma.toolboxQuestion.findFirst({
        where: { activeOn: { not: today } },
        orderBy: { activeOn: 'asc' },
      }));
    if (!candidate) return null;

    try {
      return await prisma.toolboxQuestion.update({
        where: { id: candidate.id },
        data: { activeOn: today },
      });
    } catch {
      // Concurrent request won the unique(activeOn) race — use its pick.
      return prisma.toolboxQuestion.findUnique({ where: { activeOn: today } });
    }
  }

  /** Consecutive days answered, counting back from today (or yesterday, so a
   *  streak isn't "broken" before the user has had a chance to play today). */
  async function computeStreak(userId: string): Promise<number> {
    const answers = await prisma.toolboxAnswer.findMany({
      where: { userId },
      orderBy: { answeredAt: 'desc' },
      take: 400,
      select: { answeredAt: true },
    });
    const days = [...new Set(answers.map((a) => utcToday(a.answeredAt).getTime()))].sort(
      (a, b) => b - a,
    );
    if (days.length === 0) return 0;

    const today = utcToday().getTime();
    let expected = today;
    if (days[0] !== today) {
      if (days[0] !== today - DAY_MS) return 0;
      expected = today - DAY_MS;
    }
    let streak = 0;
    for (const day of days) {
      if (day !== expected) break;
      streak++;
      expected -= DAY_MS;
    }
    return streak;
  }

  // ── GET /toolbox/today ──────────────────────────────────────────
  app.get('/toolbox/today', { preHandler: requireAuth }, async (request, reply) => {
    const q = await ensureTodayQuestion();
    if (!q) return reply.code(404).send({ error: 'NotFound', message: 'No question today' });
    const userId = request.user!.id;
    const answer = await prisma.toolboxAnswer.findUnique({
      where: { questionId_userId: { questionId: q.id, userId } },
    });
    const streak = await computeStreak(userId);
    return reply.send({
      question: { id: q.id, question: q.question, choices: q.choices },
      // The answer key is only revealed once the user has answered.
      answered: answer
        ? {
            choiceIndex: answer.choiceIndex,
            correct: answer.correct,
            correctIndex: q.correctIndex,
            explanation: q.explanation,
          }
        : null,
      streak,
    });
  });

  // ── POST /toolbox/answer ────────────────────────────────────────
  app.post('/toolbox/answer', { preHandler: requireAuth }, async (request, reply) => {
    const data = parseBody(toolboxAnswerSchema, request, reply);
    if (!data) return;
    const q = await ensureTodayQuestion();
    if (!q) return reply.code(404).send({ error: 'NotFound', message: 'No question today' });
    const choices = q.choices as string[];
    if (data.choiceIndex >= choices.length) {
      return reply.code(400).send({ error: 'BadRequest', message: 'Invalid choice' });
    }
    const userId = request.user!.id;
    const correct = data.choiceIndex === q.correctIndex;
    try {
      await prisma.toolboxAnswer.create({
        data: { questionId: q.id, userId, choiceIndex: data.choiceIndex, correct },
      });
    } catch {
      return reply.code(409).send({ error: 'Conflict', message: 'Already answered today' });
    }
    const streak = await computeStreak(userId);
    return reply.send({
      correct,
      correctIndex: q.correctIndex,
      explanation: q.explanation,
      streak,
    });
  });

  // ── GET /toolbox/stats ──────────────────────────────────────────
  app.get('/toolbox/stats', { preHandler: requireAuth }, async (request, reply) => {
    const userId = request.user!.id;
    const [answered, correct, streak] = await Promise.all([
      prisma.toolboxAnswer.count({ where: { userId } }),
      prisma.toolboxAnswer.count({ where: { userId, correct: true } }),
      computeStreak(userId),
    ]);
    return reply.send({ answered, correct, streak });
  });
}
