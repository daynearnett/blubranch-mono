import {
  certificationInputSchema,
  licenseInputSchema,
  portfolioPhotoInputSchema,
  setSkillsInputSchema,
  setTradesInputSchema,
  userSettingsInputSchema,
  workHistoryInputSchema,
  workerProfileInputSchema,
  workplaceVerifyInputSchema,
} from '@blubranch/shared';
import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../auth/middleware.js';
import { getPrisma } from '../lib/prisma.js';
import { serializeUser } from '../lib/serialize.js';
import { parseBody } from '../lib/validate.js';
import { geocodeAddress, setGeographyPoint } from '../services/geocode.js';
import { notifyProfileView } from '../services/push.js';
import { recomputeProfileCompleteness } from '../services/profile-completeness.js';

// Confirmed vouch → the shape public profiles display ("Vouched by" section).
function serializeVouch(v: {
  id: string;
  companyName: string | null;
  startYear: string | null;
  endYear: string | null;
  confirmedAt: Date | null;
  voucher: {
    id: string;
    firstName: string;
    lastName: string;
    profilePhotoUrl: string | null;
    workerProfile: { headline: string | null } | null;
  };
}) {
  return {
    id: v.id,
    companyName: v.companyName,
    startYear: v.startYear,
    endYear: v.endYear,
    confirmedAt: v.confirmedAt,
    voucher: {
      id: v.voucher.id,
      firstName: v.voucher.firstName,
      lastName: v.voucher.lastName,
      profilePhotoUrl: v.voucher.profilePhotoUrl,
      headline: v.voucher.workerProfile?.headline ?? null,
    },
  };
}

export async function userRoutes(app: FastifyInstance): Promise<void> {
  const prisma = getPrisma();

  // ── GET /users/me ───────────────────────────────────────────────
  app.get('/users/me', { preHandler: requireAuth }, async (request, reply) => {
    const user = await prisma.user.findUnique({
      where: { id: request.user!.id },
      include: {
        workerProfile: true,
        settings: true,
        trades: { include: { trade: true } },
        skills: { include: { skill: true } },
        certifications: true,
        portfolioPhotos: { orderBy: { sortOrder: 'asc' } },
        workHistory: { orderBy: { startDate: 'desc' } },
        licenses: { orderBy: { createdAt: 'desc' } },
        workPlaces: { orderBy: { startDate: 'desc' } },
      },
    });
    if (!user) return reply.code(404).send({ error: 'NotFound' });
    return reply.send({
      ...serializeUser(user),
      workerProfile: user.workerProfile,
      settings: user.settings,
      trades: user.trades.map((t) => t.trade),
      skills: user.skills.map((s) => s.skill),
      certifications: user.certifications,
      portfolioPhotos: user.portfolioPhotos,
      workHistory: user.workHistory,
      licenses: user.licenses,
      workPlaces: user.workPlaces,
    });
  });

  // ── GET /users/:id (public) ─────────────────────────────────────
  // Used by mockup screens 5A / 5B / 5C.
  app.get<{ Params: { id: string } }>('/users/:id', async (request, reply) => {
    const user = await prisma.user.findUnique({
      where: { id: request.params.id },
      include: {
        workerProfile: true,
        trades: { include: { trade: true } },
        skills: { include: { skill: true } },
        certifications: true,
        portfolioPhotos: { orderBy: { sortOrder: 'asc' } },
        workHistory: { orderBy: { startDate: 'desc' } },
        endorsementsReceived: { orderBy: { createdAt: 'desc' }, take: 20 },
        vouchesReceived: {
          where: { status: 'confirmed' },
          orderBy: { confirmedAt: 'desc' },
          take: 20,
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
        },
        settings: true,
      },
    });
    if (!user) return reply.code(404).send({ error: 'NotFound' });

    // Profile-view notification (throttled, non-blocking). Fires only when an
    // authenticated viewer looks at someone else's profile.
    if (request.user?.id) notifyProfileView(request.user.id, user.id).catch(() => {});

    // Honor privacy toggles
    const showRate = user.settings?.showHourlyRate ?? false;
    const showUnion = user.settings?.showUnion ?? true;

    const stats = await Promise.all([
      prisma.connection.count({
        where: {
          status: 'accepted',
          OR: [{ requesterId: user.id }, { receiverId: user.id }],
        },
      }),
      prisma.post.count({ where: { userId: user.id } }),
      prisma.endorsement.count({ where: { endorsedId: user.id } }),
      prisma.vouch.count({ where: { voucheeId: user.id, status: 'confirmed' } }),
    ]);

    return reply.send({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      profilePhotoUrl: user.profilePhotoUrl,
      role: user.role,
      isVerified: user.isVerified,
      workerProfile: user.workerProfile
        ? {
            ...user.workerProfile,
            hourlyRate: showRate ? user.workerProfile.hourlyRate : null,
            unionName: showUnion ? user.workerProfile.unionName : null,
          }
        : null,
      trades: user.trades.map((t) => t.trade),
      skills: user.skills.map((s) => s.skill),
      certifications: user.certifications,
      portfolioPhotos: user.portfolioPhotos,
      workHistory: user.workHistory,
      endorsements: user.endorsementsReceived,
      vouches: user.vouchesReceived.map(serializeVouch),
      stats: {
        connections: stats[0],
        posts: stats[1],
        endorsements: stats[2],
        vouches: stats[3],
        rating: 0, // Computed once reviews ship; placeholder for screen 5A.
      },
    });
  });

  // ── PUT /users/me/worker-profile ────────────────────────────────
  app.put('/users/me/worker-profile', { preHandler: requireAuth }, async (request, reply) => {
    const data = parseBody(workerProfileInputSchema, request, reply);
    if (!data) return;

    const profile = await prisma.workerProfile.upsert({
      where: { userId: request.user!.id },
      create: {
        userId: request.user!.id,
        experienceLevel: data.experienceLevel ?? 'years_0_2',
        city: data.city ?? '',
        state: data.state ?? '',
        zipCode: data.zipCode ?? '',
        travelRadiusMiles: data.travelRadiusMiles ?? 25,
        jobAvailability: data.jobAvailability ?? 'open',
        headline: data.headline ?? null,
        bio: data.bio ?? null,
        hourlyRate: data.hourlyRate ?? null,
        unionName: data.unionName ?? null,
        licenseNumber: data.licenseNumber ?? null,
        currentCompany: data.currentCompany ?? null,
        currentTitle: data.currentTitle ?? null,
        currentStartDate: data.currentStartDate ?? null,
        currentEndDate: data.currentEndDate ?? null,
      },
      update: {
        ...(data.experienceLevel !== undefined && { experienceLevel: data.experienceLevel }),
        ...(data.city !== undefined && { city: data.city }),
        ...(data.state !== undefined && { state: data.state }),
        ...(data.zipCode !== undefined && { zipCode: data.zipCode }),
        ...(data.travelRadiusMiles !== undefined && { travelRadiusMiles: data.travelRadiusMiles }),
        ...(data.jobAvailability !== undefined && { jobAvailability: data.jobAvailability }),
        ...(data.headline !== undefined && { headline: data.headline }),
        ...(data.bio !== undefined && { bio: data.bio }),
        ...(data.hourlyRate !== undefined && { hourlyRate: data.hourlyRate }),
        ...(data.unionName !== undefined && { unionName: data.unionName }),
        ...(data.licenseNumber !== undefined && { licenseNumber: data.licenseNumber }),
        ...(data.currentCompany !== undefined && { currentCompany: data.currentCompany }),
        ...(data.currentTitle !== undefined && { currentTitle: data.currentTitle }),
        ...(data.currentStartDate !== undefined && { currentStartDate: data.currentStartDate }),
        ...(data.currentEndDate !== undefined && { currentEndDate: data.currentEndDate }),
      },
    });

    // Best-effort geocode of the worker's stored address. Only re-run if
    // an address part changed (or there's no point yet on first save).
    if (data.city !== undefined || data.state !== undefined || data.zipCode !== undefined) {
      try {
        const geo = await geocodeAddress({
          city: profile.city,
          state: profile.state,
          zipCode: profile.zipCode,
        });
        if (geo) {
          await setGeographyPoint(prisma, 'worker_profiles', profile.userId, geo, 'user_id');
        }
      } catch (err) {
        request.log.warn({ err, userId: profile.userId }, 'worker geocode failed');
      }
    }

    const completeness = await recomputeProfileCompleteness(profile.userId);
    return reply.send({
      ...profile,
      profileCompleteness: completeness ?? profile.profileCompleteness,
    });
  });

  // ── PUT /users/me/photo ─────────────────────────────────────────
  // Set the user's profile photo (URL from /upload/image).
  app.put<{ Body: { profilePhotoUrl?: string } }>(
    '/users/me/photo',
    { preHandler: requireAuth },
    async (request, reply) => {
      const url = request.body?.profilePhotoUrl;
      if (typeof url !== 'string' || !/^https?:\/\//.test(url) || url.length > 500) {
        return reply.code(400).send({ error: 'BadRequest', message: 'Valid photo URL required' });
      }
      const user = await prisma.user.update({
        where: { id: request.user!.id },
        data: { profilePhotoUrl: url },
        select: { profilePhotoUrl: true },
      });
      await recomputeProfileCompleteness(request.user!.id);
      return reply.send({ profilePhotoUrl: user.profilePhotoUrl });
    },
  );

  // ── POST /users/me/trades ───────────────────────────────────────
  app.post('/users/me/trades', { preHandler: requireAuth }, async (request, reply) => {
    const data = parseBody(setTradesInputSchema, request, reply);
    if (!data) return;
    const userId = request.user!.id;
    await prisma.$transaction([
      prisma.userTrade.deleteMany({ where: { userId } }),
      prisma.userTrade.createMany({
        data: data.tradeIds.map((tradeId) => ({ userId, tradeId })),
        skipDuplicates: true,
      }),
    ]);
    const trades = await prisma.userTrade.findMany({
      where: { userId },
      include: { trade: true },
    });
    await recomputeProfileCompleteness(userId);
    return reply.send(trades.map((t) => t.trade));
  });

  // ── POST /users/me/skills ───────────────────────────────────────
  app.post('/users/me/skills', { preHandler: requireAuth }, async (request, reply) => {
    const data = parseBody(setSkillsInputSchema, request, reply);
    if (!data) return;
    const userId = request.user!.id;
    await prisma.$transaction([
      prisma.userSkill.deleteMany({ where: { userId } }),
      prisma.userSkill.createMany({
        data: data.skillIds.map((skillId) => ({ userId, skillId })),
        skipDuplicates: true,
      }),
    ]);
    const skills = await prisma.userSkill.findMany({
      where: { userId },
      include: { skill: true },
    });
    await recomputeProfileCompleteness(userId);
    return reply.send(skills.map((s) => s.skill));
  });

  // ── POST /users/me/certifications ───────────────────────────────
  app.post('/users/me/certifications', { preHandler: requireAuth }, async (request, reply) => {
    const data = parseBody(certificationInputSchema, request, reply);
    if (!data) return;
    const cert = await prisma.certification.create({
      data: {
        userId: request.user!.id,
        name: data.name,
        certificationNumber: data.certificationNumber ?? null,
      },
    });
    return reply.code(201).send(cert);
  });

  // ── POST /users/me/portfolio-photos ─────────────────────────────
  app.post('/users/me/portfolio-photos', { preHandler: requireAuth }, async (request, reply) => {
    const data = parseBody(portfolioPhotoInputSchema, request, reply);
    if (!data) return;
    const userId = request.user!.id;
    const count = await prisma.portfolioPhoto.count({ where: { userId } });
    if (count >= 12) {
      return reply.code(400).send({ error: 'BadRequest', message: 'Max 12 portfolio photos' });
    }
    const photo = await prisma.portfolioPhoto.create({
      data: {
        userId,
        photoUrl: data.photoUrl,
        caption: data.caption ?? null,
        sortOrder: data.sortOrder ?? count,
      },
    });
    await recomputeProfileCompleteness(userId);
    return reply.code(201).send(photo);
  });

  // ── POST /users/me/work-history ─────────────────────────────────
  app.post('/users/me/work-history', { preHandler: requireAuth }, async (request, reply) => {
    const data = parseBody(workHistoryInputSchema, request, reply);
    if (!data) return;
    const entry = await prisma.workHistory.create({
      data: {
        userId: request.user!.id,
        companyName: data.companyName,
        title: data.title,
        startDate: data.startDate,
        endDate: data.endDate ?? null,
        isCurrent: data.isCurrent,
      },
    });
    await recomputeProfileCompleteness(request.user!.id);
    return reply.code(201).send(entry);
  });

  // ── PUT /users/me/settings ──────────────────────────────────────
  app.put('/users/me/settings', { preHandler: requireAuth }, async (request, reply) => {
    const data = parseBody(userSettingsInputSchema, request, reply);
    if (!data) return;
    const settings = await prisma.userSettings.upsert({
      where: { userId: request.user!.id },
      create: { userId: request.user!.id, ...data },
      update: data,
    });
    return reply.send(settings);
  });

  // ── POST /users/me/licenses ──────────────────────────────────
  app.post('/users/me/licenses', { preHandler: requireAuth }, async (request, reply) => {
    const data = parseBody(licenseInputSchema, request, reply);
    if (!data) return;
    const license = await prisma.license.create({
      data: {
        userId: request.user!.id,
        type: data.type,
        number: data.number,
        issuingState: data.issuingState.toUpperCase(),
        expiresAt: data.expiresAt ?? null,
        status: 'pending',
      },
    });
    // Pending licenses don't score yet, but recompute keeps the column honest
    // if weights ever change.
    await recomputeProfileCompleteness(request.user!.id);
    return reply.code(201).send(license);
  });

  // ── POST /users/me/workplaces ───────────────────────────────
  app.post('/users/me/workplaces', { preHandler: requireAuth }, async (request, reply) => {
    const data = parseBody(workplaceVerifyInputSchema, request, reply);
    if (!data) return;
    const wp = await prisma.workPlace.create({
      data: {
        userId: request.user!.id,
        companyName: data.companyName,
        role: data.role,
        startDate: data.startDate ?? null,
        endDate: data.endDate ?? null,
        current: data.current,
        location: data.location ?? null,
        verificationEmail: data.verificationEmail ?? null,
        status: data.verificationEmail ? 'pending' : 'pending',
        verificationMethod: data.verificationEmail ? 'email' : null,
      },
    });
    return reply.code(201).send(wp);
  });

  // ── GET /u/:slug (public profile by slug) ───────────────────
  app.get<{ Params: { slug: string } }>('/u/:slug', async (request, reply) => {
    const user = await prisma.user.findFirst({
      where: { slug: request.params.slug },
      include: {
        workerProfile: true,
        trades: { include: { trade: true } },
        skills: { include: { skill: true } },
        certifications: true,
        licenses: { where: { status: 'verified' } },
        portfolioPhotos: { orderBy: { sortOrder: 'asc' } },
        workHistory: { orderBy: { startDate: 'desc' } },
        endorsementsReceived: { orderBy: { createdAt: 'desc' }, take: 20 },
        vouchesReceived: {
          where: { status: 'confirmed' },
          orderBy: { confirmedAt: 'desc' },
          take: 20,
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
        },
        settings: true,
      },
    });
    if (!user) return reply.code(404).send({ error: 'NotFound' });

    // Profile-view notification (throttled, non-blocking).
    if (request.user?.id) notifyProfileView(request.user.id, user.id).catch(() => {});

    const showRate = user.settings?.showHourlyRate ?? false;
    const showUnion = user.settings?.showUnion ?? true;

    const stats = await Promise.all([
      prisma.connection.count({
        where: {
          status: 'accepted',
          OR: [{ requesterId: user.id }, { receiverId: user.id }],
        },
      }),
      prisma.post.count({ where: { userId: user.id } }),
      prisma.endorsement.count({ where: { endorsedId: user.id } }),
      prisma.vouch.count({ where: { voucheeId: user.id, status: 'confirmed' } }),
    ]);

    return reply.send({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      profilePhotoUrl: user.profilePhotoUrl,
      role: user.role,
      isVerified: user.isVerified,
      slug: user.slug,
      workerProfile: user.workerProfile
        ? {
            ...user.workerProfile,
            hourlyRate: showRate ? user.workerProfile.hourlyRate : null,
            unionName: showUnion ? user.workerProfile.unionName : null,
          }
        : null,
      trades: user.trades.map((t) => t.trade),
      skills: user.skills.map((s) => s.skill),
      certifications: user.certifications,
      licenses: user.licenses,
      portfolioPhotos: user.portfolioPhotos,
      workHistory: user.workHistory,
      endorsements: user.endorsementsReceived,
      vouches: user.vouchesReceived.map(serializeVouch),
      stats: {
        connections: stats[0],
        posts: stats[1],
        endorsements: stats[2],
        vouches: stats[3],
        rating: 0,
      },
    });
  });

  // ── GET /users/me/trade-card ────────────────────────────────────
  // The wallet-style verified credential card: identity, primary trade,
  // licenses (all statuses — it's the owner's own card), certs, union,
  // confirmed-vouch count. The public share render is GET /share/card/:slug.
  app.get('/users/me/trade-card', { preHandler: requireAuth }, async (request, reply) => {
    const user = await prisma.user.findUnique({
      where: { id: request.user!.id },
      include: {
        workerProfile: true,
        trades: { include: { trade: true } },
        licenses: { orderBy: { createdAt: 'desc' } },
        certifications: true,
      },
    });
    if (!user) return reply.code(404).send({ error: 'NotFound' });

    const vouchCount = await prisma.vouch.count({
      where: { voucheeId: user.id, status: 'confirmed' },
    });

    return reply.send({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      profilePhotoUrl: user.profilePhotoUrl,
      slug: user.slug,
      isVerified: user.isVerified,
      trade: user.trades[0]?.trade?.name ?? null,
      experienceLevel: user.workerProfile?.experienceLevel ?? null,
      city: user.workerProfile?.city ?? null,
      state: user.workerProfile?.state ?? null,
      unionName: user.workerProfile?.unionName ?? null,
      licenses: user.licenses,
      certifications: user.certifications,
      vouches: vouchCount,
    });
  });

  // ── Reference: trades + skills + benefits ───────────────────────
  app.get('/reference/trades', async () => {
    return prisma.trade.findMany({
      orderBy: [{ isPopular: 'desc' }, { name: 'asc' }],
    });
  });

  app.get<{ Querystring: { tradeId?: string } }>('/reference/skills', async (request) => {
    const tradeId = request.query.tradeId ? Number(request.query.tradeId) : undefined;
    return prisma.skill.findMany({
      where: tradeId ? { tradeId } : undefined,
      orderBy: { name: 'asc' },
    });
  });

  app.get('/reference/benefits', async () => {
    return prisma.benefit.findMany({ orderBy: { name: 'asc' } });
  });
}
