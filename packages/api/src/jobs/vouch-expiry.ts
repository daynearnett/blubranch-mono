// Nightly vouch cleanup.
//
// A "pending" vouch that is never confirmed quietly ages out of the
// GET /vouches/pending list after PENDING_SHELF_LIFE_DAYS. But the list filter
// alone left the vouch row AND its "confirm your vouch" (vouch_received)
// notification in place — so the recipient kept a notification pointing at a
// vouch that no longer appeared anywhere they could act on it (a dead end the
// tester-agent sim hit: a 6-week-old vouch with an unread notification but an
// empty pending list). This job makes the three views agree by deleting stale
// pending vouches and clearing their orphaned notifications.

import { getPrisma } from '../lib/prisma.js';
import { PENDING_SHELF_LIFE_DAYS } from '../routes/vouches.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Delete pending vouches older than the shelf-life window and the
 * `vouch_received` notifications that reference them. Pure and parameterized on
 * `now` so it can be driven directly from a test. Returns what it removed.
 */
export async function expireStalePendingVouches(
  now = new Date(),
): Promise<{ vouches: number; notifications: number }> {
  const prisma = getPrisma();
  const cutoff = new Date(now.getTime() - PENDING_SHELF_LIFE_DAYS * DAY_MS);

  const stale = await prisma.vouch.findMany({
    where: { status: 'pending', createdAt: { lt: cutoff } },
    select: { id: true },
  });
  if (stale.length === 0) return { vouches: 0, notifications: 0 };
  const ids = stale.map((v) => v.id);

  // Clear the orphaned "confirm your vouch" notifications first (they carry the
  // vouch id in their JSONB `data`), then delete the vouches themselves.
  const notif = await prisma.notification.deleteMany({
    where: {
      type: 'vouch_received',
      OR: ids.map((id) => ({ data: { path: ['vouchId'], equals: id } })),
    },
  });
  const del = await prisma.vouch.deleteMany({ where: { id: { in: ids } } });

  if (del.count > 0) {
    console.log(
      `[vouch-expiry] Expired ${del.count} stale pending vouch(es), cleared ${notif.count} notification(s)`,
    );
  }
  return { vouches: del.count, notifications: notif.count };
}

export async function processVouchExpiry(): Promise<void> {
  await expireStalePendingVouches();
}
