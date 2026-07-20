// Staging-only helper: seed a verified license expiring soon on a given user
// and immediately run the expiry-reminder pass, so the license_expiry
// notification (in-app + push + email) can be tested on-device without
// waiting for the nightly 3 AM UTC job.
//
// Run in the Railway container (staging DB is internal-only):
//   EMAIL=user@example.com DAYS=5 pnpm --filter @blubranch/api exec tsx scripts/seed-license-expiry-test.ts
//
// Safe to re-run: reuses the same test license (type below) per user instead
// of stacking duplicates, and clears remindedAt so the reminder fires again.

import { getPrisma } from '../src/lib/prisma.js';
import { processLicenseExpiryReminders } from '../src/jobs/license-expiration.js';

const TEST_LICENSE_TYPE = 'Journeyman Electrician (reminder test)';

async function main(): Promise<void> {
  const email = process.env.EMAIL;
  const days = Number(process.env.DAYS ?? 5);
  if (!email) {
    console.error('Set EMAIL=<staging account email> (and optionally DAYS=<n>, default 5)');
    process.exit(1);
  }

  const prisma = getPrisma();
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    select: { id: true, firstName: true, lastName: true },
  });
  if (!user) {
    console.error(`No user with email ${email}. Recent workers:`);
    const recent = await prisma.user.findMany({
      where: { role: 'worker' },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { email: true, firstName: true, lastName: true },
    });
    for (const u of recent) console.error(`  ${u.email} (${u.firstName} ${u.lastName})`);
    process.exit(1);
  }

  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  const existing = await prisma.license.findFirst({
    where: { userId: user.id, type: TEST_LICENSE_TYPE },
  });
  const license = existing
    ? await prisma.license.update({
        where: { id: existing.id },
        data: { status: 'verified', expiresAt, remindedAt: null },
      })
    : await prisma.license.create({
        data: {
          userId: user.id,
          type: TEST_LICENSE_TYPE,
          number: 'TEST-EXP-1',
          issuingState: 'OH',
          status: 'verified',
          verificationMethod: 'manual',
          verifiedAt: new Date(),
          expiresAt,
        },
      });
  console.log(
    `License ${existing ? 'reset' : 'created'} for ${user.firstName} ${user.lastName}: expires ${expiresAt.toISOString()} (${days} days)`,
  );

  await processLicenseExpiryReminders();

  const notif = await prisma.notification.findFirst({
    where: { userId: user.id, type: 'license_expiry' },
    orderBy: { createdAt: 'desc' },
  });
  if (notif) {
    console.log(`Reminder sent: "${notif.title}" — "${notif.body}" (${notif.createdAt.toISOString()})`);
  } else {
    console.log('No license_expiry notification found — check notifyLicenseExpiry pref / license state.');
  }
  console.log(`Cleanup later with: DELETE license id ${license.id}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
