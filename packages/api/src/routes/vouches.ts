// "Worked together" vouches — peer credibility gated by shared job history.
// A vouch is a claim + one-tap confirmation (mutual attestation): workplace
// date-overlap only PRE-FILLS the shared context, it never gates the vouch,
// because WorkPlace.companyName is free text and real pairs would be missed.
// Only confirmed vouches are ever displayed; there is no decline path — an
// unconfirmed vouch just silently never shows.
import { vouchInputSchema } from '@blubranch/shared';
import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../auth/middleware.js';
import { getPrisma } from '../lib/prisma.js';
import { parseBody } from '../lib/validate.js';
import { sendNotification } from '../services/push.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_OVERLAP_DAYS = 30;
const PENDING_SHELF_LIFE_DAYS = 30;

/** Normalize a free-text company name for matching ("Turner  Const." ≈ "turner const"). */
export function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[.,']/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

interface WorkRange {
  companyName: string;
  start: Date | null;
  end: Date | null;
  current: boolean;
}

/** Shared-workplace suggestions: same normalized company + ≥30-day date overlap. */
export function findSharedWorkplaces(
  mine: WorkRange[],
  theirs: WorkRange[],
  now = new Date(),
): Array<{ companyName: string; startYear: string; endYear: string }> {
  const results: Array<{ companyName: string; startYear: string; endYear: string }> = [];
  const seen = new Set<string>();
  for (const a of mine) {
    if (!a.start) continue;
    const aEnd = a.current || !a.end ? now : a.end;
    for (const b of theirs) {
      if (!b.start) continue;
      if (normalizeCompanyName(a.companyName) !== normalizeCompanyName(b.companyName)) continue;
      const bEnd = b.current || !b.end ? now : b.end;
      const overlapStart = a.start > b.start ? a.start : b.start;
      const overlapEnd = aEnd < bEnd ? aEnd : bEnd;
      if (overlapEnd.getTime() - overlapStart.getTime() < MIN_OVERLAP_DAYS * DAY_MS) continue;
      const key = normalizeCompanyName(a.companyName);
      if (seen.has(key)) continue;
      seen.add(key);
      results.push({
        companyName: a.companyName,
        startYear: String(overlapStart.getUTCFullYear()),
        endYear: String(overlapEnd.getUTCFullYear()),
      });
    }
  }
  return results;
}

export async function vouchRoutes(app: FastifyInstance): Promise<void> {
  const prisma = getPrisma();

  // ── GET /users/:id/vouch-context ────────────────────────────────
  // What the vouch sheet needs: any existing vouch between the pair (either
  // direction) and suggested shared workplaces to pre-fill the claim.
  app.get<{ Params: { id: string } }>(
    '/users/:id/vouch-context',
    { preHandler: requireAuth },
    async (request, reply) => {
      const me = request.user!.id;
      const them = request.params.id;
      if (me === them) return reply.send({ existing: null, suggestions: [] });

      const [existing, myPlaces, theirPlaces] = await Promise.all([
        prisma.vouch.findMany({
          where: {
            OR: [
              { voucherId: me, voucheeId: them },
              { voucherId: them, voucheeId: me },
            ],
          },
          select: { id: true, voucherId: true, status: true, companyName: true },
        }),
        prisma.workPlace.findMany({
          where: { userId: me },
          select: { companyName: true, startDate: true, endDate: true, current: true },
        }),
        prisma.workPlace.findMany({
          where: { userId: them },
          select: { companyName: true, startDate: true, endDate: true, current: true },
        }),
      ]);

      const toRange = (w: {
        companyName: string;
        startDate: Date | null;
        endDate: Date | null;
        current: boolean;
      }): WorkRange => ({
        companyName: w.companyName,
        start: w.startDate,
        end: w.endDate,
        current: w.current,
      });

      return reply.send({
        given: existing.find((v) => v.voucherId === me) ?? null,
        received: existing.find((v) => v.voucherId === them) ?? null,
        suggestions: findSharedWorkplaces(myPlaces.map(toRange), theirPlaces.map(toRange)),
      });
    },
  );

  // ── POST /users/:id/vouch ───────────────────────────────────────
  app.post<{ Params: { id: string } }>(
    '/users/:id/vouch',
    { preHandler: requireAuth },
    async (request, reply) => {
      const data = parseBody(vouchInputSchema, request, reply);
      if (!data) return;
      const me = request.user!.id;
      const them = request.params.id;

      if (them === me) {
        return reply.code(400).send({ error: 'BadRequest', message: 'You cannot vouch for yourself' });
      }
      const vouchee = await prisma.user.findUnique({ where: { id: them }, select: { id: true } });
      if (!vouchee) return reply.code(404).send({ error: 'NotFound' });

      const existing = await prisma.vouch.findUnique({
        where: { voucherId_voucheeId: { voucherId: me, voucheeId: them } },
      });
      if (existing) {
        return reply.code(409).send({ error: 'Conflict', message: 'You already vouched for them' });
      }

      // Rate limit: max 10 vouches per day (mirrors connection requests).
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayCount = await prisma.vouch.count({
        where: { voucherId: me, createdAt: { gte: today } },
      });
      if (todayCount >= 10) {
        return reply.code(429).send({ error: 'TooManyRequests', message: 'Max 10 vouches per day' });
      }

      const vouch = await prisma.vouch.create({
        data: {
          voucherId: me,
          voucheeId: them,
          companyName: data.companyName ?? null,
          startYear: data.startYear ?? null,
          endYear: data.endYear ?? null,
        },
      });

      const voucher = await prisma.user.findUnique({
        where: { id: me },
        select: { firstName: true, lastName: true },
      });
      const at = vouch.companyName ? ` at ${vouch.companyName}` : '';
      sendNotification({
        userId: them,
        type: 'vouch_received',
        title: `${voucher?.firstName ?? 'Someone'} ${voucher?.lastName ?? ''} vouched for you`.trim(),
        body: `"Worked together${at}. Would again." Confirm it to show it on your profile.`,
        data: { vouchId: vouch.id, voucherId: me },
      }).catch(() => {});

      return reply.code(201).send(vouch);
    },
  );

  // ── PUT /vouches/:id/confirm ────────────────────────────────────
  app.put<{ Params: { id: string } }>(
    '/vouches/:id/confirm',
    { preHandler: requireAuth },
    async (request, reply) => {
      const me = request.user!.id;
      const vouch = await prisma.vouch.findUnique({ where: { id: request.params.id } });

      if (!vouch || vouch.voucheeId !== me) {
        return reply.code(404).send({ error: 'NotFound' });
      }
      if (vouch.status !== 'pending') {
        return reply.code(400).send({ error: 'BadRequest', message: 'Already confirmed' });
      }

      const updated = await prisma.vouch.update({
        where: { id: vouch.id },
        data: { status: 'confirmed', confirmedAt: new Date() },
      });

      const vouchee = await prisma.user.findUnique({
        where: { id: me },
        select: { firstName: true, lastName: true },
      });
      sendNotification({
        userId: vouch.voucherId,
        type: 'vouch_confirmed',
        title: `${vouchee?.firstName ?? 'Someone'} ${vouchee?.lastName ?? ''} confirmed your vouch`.trim(),
        body: "It's live on their profile now.",
        data: { vouchId: vouch.id },
      }).catch(() => {});

      return reply.send(updated);
    },
  );

  // ── GET /vouches/pending ────────────────────────────────────────
  // Vouches waiting on MY confirmation. Old unconfirmed claims quietly age
  // out of this list (they never display anywhere regardless).
  app.get('/vouches/pending', { preHandler: requireAuth }, async (request, reply) => {
    const shelfSince = new Date(Date.now() - PENDING_SHELF_LIFE_DAYS * DAY_MS);
    const pending = await prisma.vouch.findMany({
      where: {
        voucheeId: request.user!.id,
        status: 'pending',
        createdAt: { gte: shelfSince },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        voucher: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profilePhotoUrl: true,
            workerProfile: { select: { headline: true } },
          },
        },
      },
    });
    return reply.send(
      pending.map((v) => ({
        id: v.id,
        companyName: v.companyName,
        startYear: v.startYear,
        endYear: v.endYear,
        createdAt: v.createdAt,
        voucher: {
          id: v.voucher.id,
          firstName: v.voucher.firstName,
          lastName: v.voucher.lastName,
          profilePhotoUrl: v.voucher.profilePhotoUrl,
          headline: v.voucher.workerProfile?.headline ?? null,
        },
      })),
    );
  });
}
