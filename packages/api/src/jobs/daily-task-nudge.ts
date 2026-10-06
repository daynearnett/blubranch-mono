// Daily task nudge — focus-group engagement prompts (2026-10-05). Every
// worker gets ONE basic social task per day (post, like, comment, connect,
// vouch, toolbox, jobs), pushed at 17:00 UTC (~1 PM ET, lunchtime on the
// jobsite). The task rotates by UTC day and is the SAME for everyone that
// day, so the group's activity clusters (everyone commenting the same day
// beats seven people doing seven different things). In-app + push only — no
// email (a daily email would burn goodwill fast).

import { getPrisma } from '../lib/prisma.js';
import { sendNotification } from '../services/push.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_PER_RUN = 1000;

export interface DailyTask {
  key: string;
  title: string;
  body: string;
}

// Keep these dead simple and in trade voice; rotation order is the ship
// order. Adding a task changes which day lands where — fine for a field test.
export const DAILY_TASKS: DailyTask[] = [
  {
    key: 'post',
    title: 'Show off today’s work',
    body: 'Hop on BluBranch and put a photo from the job on your feed.',
  },
  {
    key: 'comment',
    title: 'Leave a comment',
    body: 'Hop on BluBranch and comment on someone’s post.',
  },
  {
    key: 'connect',
    title: 'Grow your branch',
    body: 'Send a connect request to someone you’ve worked with.',
  },
  {
    key: 'like',
    title: 'Give a post a like',
    body: 'Hop on the feed and like a post that deserves it.',
  },
  {
    key: 'vouch',
    title: 'Vouch for a good hand',
    body: 'Worked with someone solid? Vouch for them on their profile.',
  },
  {
    key: 'message',
    title: 'Check in with your branch',
    body: 'Send a message to someone you’ve worked with.',
  },
  {
    key: 'jobs',
    title: 'Scope out the jobs board',
    body: 'Check the Jobs tab and see what’s paying near you.',
  },
];

/** The day's task — same for everyone, rotating by UTC day. */
export function taskForDay(now: Date): DailyTask {
  const dayIndex = Math.floor(now.getTime() / DAY_MS);
  return DAILY_TASKS[dayIndex % DAILY_TASKS.length]!;
}

export async function processDailyTaskNudge(now = new Date()): Promise<void> {
  const prisma = getPrisma();
  const task = taskForDay(now);
  const utcMidnight = new Date(now.getTime() - (now.getTime() % DAY_MS));

  // Workers who haven't been nudged yet today. sendNotification enforces the
  // notifyDailyTasks preference itself.
  const candidates = await prisma.user.findMany({
    where: {
      role: 'worker',
      notifications: {
        none: { type: 'daily_task', createdAt: { gte: utcMidnight } },
      },
    },
    select: { id: true },
    take: MAX_PER_RUN,
  });

  for (const c of candidates) {
    await sendNotification({
      userId: c.id,
      type: 'daily_task',
      title: task.title,
      body: task.body,
      data: { task: task.key },
    });
  }

  if (candidates.length > 0) {
    console.log(`[daily-task] Sent "${task.key}" nudge to ${candidates.length} worker(s)`);
  }
}
