// Weekly profile-completion nudge — reminds workers with incomplete profiles
// to fill them out (better visibility to employers). Respects the
// notifyProfileNudges preference and a 7-day per-user cooldown.

import { getPrisma } from '../lib/prisma.js';
import { sendNotification } from '../services/push.js';

const COMPLETENESS_THRESHOLD = 70; // nudge worker profiles below this %
const NUDGE_COOLDOWN_DAYS = 7;
const MAX_PER_RUN = 1000;

export async function processProfileNudge(): Promise<void> {
  const prisma = getPrisma();
  const cooldownSince = new Date(Date.now() - NUDGE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000);

  const candidates = await prisma.user.findMany({
    where: {
      role: 'worker',
      workerProfile: { is: { profileCompleteness: { lt: COMPLETENESS_THRESHOLD } } },
      // Not nudged within the cooldown window.
      notifications: {
        none: { type: 'profile_nudge', createdAt: { gte: cooldownSince } },
      },
    },
    select: { id: true, workerProfile: { select: { profileCompleteness: true } } },
    take: MAX_PER_RUN,
  });

  for (const c of candidates) {
    // sendNotification enforces the notifyProfileNudges preference itself.
    await sendNotification({
      userId: c.id,
      type: 'profile_nudge',
      title: 'Complete your BluBranch profile',
      body: 'Add your skills, photos, and experience so employers near you can find you.',
      data: { completeness: String(c.workerProfile?.profileCompleteness ?? 0) },
    });
  }

  if (candidates.length > 0) {
    console.log(`[profile-nudge] nudged ${candidates.length} worker(s) with incomplete profiles`);
  }
}
