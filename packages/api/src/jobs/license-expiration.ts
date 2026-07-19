// Nightly license expiration — marks licenses with past expiresAt as 'expired'
// and sends renewal reminders at the 30-day and 7-day windows.
// Originally specced in Phase 3.5 chunk 3; implemented as BullMQ job in Phase 4;
// reminders added in the differentiation sprint (Trade Card).

import { getPrisma } from '../lib/prisma.js';
import { sendNotification } from '../services/push.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const REMINDER_WINDOWS_DAYS = [30, 7];
const MAX_REMINDERS_PER_RUN = 500;

export async function processLicenseExpiration(): Promise<void> {
  const prisma = getPrisma();

  const result = await prisma.license.updateMany({
    where: {
      status: 'verified',
      expiresAt: { lte: new Date() },
    },
    data: { status: 'expired' },
  });
  if (result.count > 0) {
    console.log(`[license-expiration] Expired ${result.count} license(s)`);
  }

  await processLicenseExpiryReminders();
}

/**
 * Renewal reminders for verified licenses approaching expiry. Two windows
 * (30 days out, then 7 days out), deduped via `remindedAt`: a license is due
 * a reminder when it's inside a window and the last reminder (if any) was
 * sent before that window opened. sendNotification enforces the
 * notifyLicenseExpiry preference and emails (license_expiry is an EMAIL_TYPE).
 */
export async function processLicenseExpiryReminders(now = new Date()): Promise<void> {
  const prisma = getPrisma();
  let sent = 0;

  for (const windowDays of REMINDER_WINDOWS_DAYS) {
    const windowEnd = new Date(now.getTime() + windowDays * DAY_MS);

    const due = await prisma.license.findMany({
      where: {
        status: 'verified',
        expiresAt: { gt: now, lte: windowEnd },
      },
      select: {
        id: true,
        userId: true,
        type: true,
        expiresAt: true,
        remindedAt: true,
      },
      take: MAX_REMINDERS_PER_RUN,
    });

    for (const license of due) {
      if (!license.expiresAt) continue;
      // Skip if a reminder already went out inside this window.
      const windowOpenedAt = new Date(license.expiresAt.getTime() - windowDays * DAY_MS);
      if (license.remindedAt && license.remindedAt >= windowOpenedAt) continue;

      const daysLeft = Math.max(1, Math.ceil((license.expiresAt.getTime() - now.getTime()) / DAY_MS));
      await sendNotification({
        userId: license.userId,
        type: 'license_expiry',
        title: `Your ${license.type} expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`,
        body: 'Renew it, then update your Trade Card so it stays current.',
        data: { licenseId: license.id },
      });
      await prisma.license.update({
        where: { id: license.id },
        data: { remindedAt: now },
      });
      sent++;
    }
  }

  if (sent > 0) {
    console.log(`[license-expiration] Sent ${sent} expiry reminder(s)`);
  }
}
