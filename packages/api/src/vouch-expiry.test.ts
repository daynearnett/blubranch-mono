import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { getPrisma } from './lib/prisma.js';
import { expireStalePendingVouches } from './jobs/vouch-expiry.js';
import { PENDING_SHELF_LIFE_DAYS } from './routes/vouches.js';

// Regression: a pending vouch older than PENDING_SHELF_LIFE_DAYS used to vanish
// from GET /vouches/pending while its "confirm your vouch" notification lingered
// — a dead end. The nightly vouch-expiry job now deletes the stale row AND its
// orphaned notification, while a fresh pending vouch is left untouched.

const DAY_MS = 24 * 60 * 60 * 1000;

describe('vouch expiry cleanup', () => {
  const prisma = getPrisma();
  const stamp = Date.now();
  const userIds: string[] = [];
  let voucher: string;
  let vouchee: string;
  let staleVouchId: string;
  let freshVouchId: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    const mk = async (tag: string) => {
      const u = await prisma.user.create({
        data: {
          firstName: tag,
          lastName: 'Vouch',
          email: `vouch-exp-${tag}-${stamp}@test.local`,
          role: 'worker',
          authProvider: 'email',
          passwordHash: 'not-a-real-hash',
        },
      });
      userIds.push(u.id);
      return u.id;
    };
    voucher = await mk('voucher');
    vouchee = await mk('vouchee');

    // Stale pending vouch — created well past the shelf-life window.
    const stale = await prisma.vouch.create({
      data: {
        voucherId: voucher,
        voucheeId: vouchee,
        companyName: 'Old Crew',
        status: 'pending',
        createdAt: new Date(Date.now() - (PENDING_SHELF_LIFE_DAYS + 10) * DAY_MS),
      },
    });
    staleVouchId = stale.id;
    await prisma.notification.create({
      data: {
        userId: vouchee,
        type: 'vouch_received',
        title: 'Voucher Vouch vouched for you',
        body: 'Confirm it to show it on your profile.',
        data: { vouchId: stale.id, voucherId: voucher },
      },
    });

    // Fresh pending vouch (other direction) — inside the window, must survive.
    const fresh = await prisma.vouch.create({
      data: {
        voucherId: vouchee,
        voucheeId: voucher,
        companyName: 'New Crew',
        status: 'pending',
      },
    });
    freshVouchId = fresh.id;
    await prisma.notification.create({
      data: {
        userId: voucher,
        type: 'vouch_received',
        title: 'Vouchee Vouch vouched for you',
        body: 'Confirm it to show it on your profile.',
        data: { vouchId: fresh.id, voucherId: vouchee },
      },
    });
  });

  afterAll(async () => {
    await prisma.vouch.deleteMany({ where: { id: { in: [staleVouchId, freshVouchId] } } }).catch(() => {});
    await prisma.notification.deleteMany({ where: { userId: { in: userIds } } }).catch(() => {});
    for (const id of userIds) await prisma.user.delete({ where: { id } }).catch(() => {});
  });

  it('deletes stale pending vouches and their orphaned notifications; keeps fresh ones', async () => {
    const result = await expireStalePendingVouches();
    expect(result.vouches).toBeGreaterThanOrEqual(1);
    expect(result.notifications).toBeGreaterThanOrEqual(1);

    // Stale vouch + its notification are gone.
    expect(await prisma.vouch.findUnique({ where: { id: staleVouchId } })).toBeNull();
    const staleNotifs = await prisma.notification.findMany({
      where: { userId: vouchee, type: 'vouch_received' },
    });
    expect(staleNotifs.length).toBe(0);

    // Fresh vouch + its notification survive.
    expect(await prisma.vouch.findUnique({ where: { id: freshVouchId } })).not.toBeNull();
    const freshNotifs = await prisma.notification.findMany({
      where: { userId: voucher, type: 'vouch_received' },
    });
    expect(freshNotifs.length).toBe(1);
  });
});
