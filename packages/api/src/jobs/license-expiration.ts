// Nightly license expiration — marks licenses with past expiresAt as 'expired'.
// Originally specced in Phase 3.5 chunk 3; implemented as BullMQ job in Phase 4.

import { getPrisma } from '../lib/prisma.js';

export async function processLicenseExpiration(): Promise<void> {
  const result = await getPrisma().license.updateMany({
    where: {
      status: 'verified',
      expiresAt: { lte: new Date() },
    },
    data: { status: 'expired' },
  });
  if (result.count > 0) {
    console.log(`[license-expiration] Expired ${result.count} license(s)`);
  }
}
