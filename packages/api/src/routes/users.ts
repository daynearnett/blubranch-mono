import {
  certificationInputSchema,
  portfolioPhotoInputSchema,
  setSkillsInputSchema,
  setTradesInputSchema,
  userSettingsInputSchema,
  workHistoryInputSchema,
  workerProfileInputSchema,
} from '@blubranch/shared';
import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../auth/middleware.js';
import { getPrisma } from '../lib/prisma.js';
import { serializeUser } from '../lib/serialize.js';
import { parseBody } from '../lib/validate.js';
import { geocodeAddress, setGeographyPoint } from '../services/geocode.js';

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
        settings: true,
      },
    });
    if (!user) return reply.code(404).send({ error: 'NotFound' });

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
      stats: {
        connections: stats[0],
        posts: stats[1],
        endorsements: stats[2],
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

    return reply.send(profile);
  });

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

  // ── Reference: trades + skills + benefits ───────────────────────
  app.get('/reference/trades', async () => {
    const trades = await prisma.trade.findMany({ orderBy: { name: 'asc' } });
    return trades;
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
