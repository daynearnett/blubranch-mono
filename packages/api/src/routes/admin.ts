// Phase 6 — admin panel API. Backs apps/admin (Vite/React). Every route except
// login/logout is gated by requireRole('admin'). The admin app stores only the
// access token (no refresh), so re-login is expected after the 1h TTL.
import { loginInputSchema } from '@blubranch/shared';
import { Prisma } from '@blubranch/db';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { signTokenPair } from '../auth/jwt.js';
import { requireRole } from '../auth/middleware.js';
import { verifyPassword } from '../auth/password.js';
import { getPrisma } from '../lib/prisma.js';
import { parseBody } from '../lib/validate.js';
import { authRateLimit } from '../lib/security.js';

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  q: z.string().max(200).optional(),
  status: z.string().max(50).optional(),
});
type ListQuery = z.infer<typeof listQuerySchema>;

const verifyActionSchema = z.object({ status: z.enum(['verified', 'rejected']) });

function fullName(u: { firstName: string; lastName: string }): string {
  return `${u.firstName} ${u.lastName}`.trim();
}

export async function adminRoutes(app: FastifyInstance): Promise<void> {
  const prisma = getPrisma();
  const admin = { preHandler: requireRole('admin') };

  // Parse pagination/filter query; sends 400 + returns null on bad input.
  function parseList(request: FastifyRequest, reply: FastifyReply): ListQuery | null {
    const r = listQuerySchema.safeParse(request.query);
    if (!r.success) {
      reply.code(400).send({ error: 'ValidationError' });
      return null;
    }
    return r.data;
  }

  // ── Auth ────────────────────────────────────────────────────────
  // POST /admin/login — admin-role only. Returns the shape apps/admin expects:
  // { token, user: { id, email, name } }.
  app.post('/admin/login', authRateLimit(), async (request, reply) => {
    const data = parseBody(loginInputSchema, request, reply);
    if (!data) return;

    const user = await prisma.user.findUnique({ where: { email: data.email.toLowerCase() } });
    if (!user || !user.passwordHash || !(await verifyPassword(data.password, user.passwordHash))) {
      return reply.code(401).send({ error: 'Unauthorized', message: 'Invalid credentials' });
    }
    if (user.role !== 'admin') {
      return reply.code(403).send({ error: 'Forbidden', message: 'Admin access only' });
    }

    const { accessToken } = signTokenPair(user.id, 'admin');
    return reply.send({
      token: accessToken,
      user: { id: user.id, email: user.email, name: fullName(user) },
    });
  });

  // GET /admin/me — token validation on app mount.
  app.get('/admin/me', admin, async (request, reply) => {
    const user = await prisma.user.findUnique({ where: { id: request.user!.id } });
    if (!user) return reply.code(404).send({ error: 'NotFound' });
    return reply.send({ id: user.id, email: user.email, name: fullName(user) });
  });

  // POST /admin/logout — stateless JWT; the client drops its token. Always 200.
  app.post('/admin/logout', async () => ({ ok: true }));

  // ── Dashboard ───────────────────────────────────────────────────
  app.get('/admin/dashboard', admin, async () => {
    const [workers, employers, jobs, applications, pendingLicenses, pendingWorkplaces] =
      await Promise.all([
        prisma.user.count({ where: { role: 'worker' } }),
        prisma.user.count({ where: { role: 'employer' } }),
        prisma.job.count(),
        prisma.jobApplication.count(),
        prisma.license.count({ where: { status: 'pending' } }),
        prisma.workPlace.count({ where: { status: 'pending' } }),
      ]);
    return {
      total_workers: workers,
      total_employers: employers,
      total_jobs: jobs,
      total_applications: applications,
      pending_verifications: pendingLicenses + pendingWorkplaces,
    };
  });

  // ── Workers ─────────────────────────────────────────────────────
  app.get('/admin/workers', admin, async (request, reply) => {
    const q = parseList(request, reply);
    if (!q) return;
    const where: Prisma.UserWhereInput = { role: 'worker' };
    if (q.q) {
      where.OR = [
        { firstName: { contains: q.q, mode: 'insensitive' } },
        { lastName: { contains: q.q, mode: 'insensitive' } },
        { email: { contains: q.q, mode: 'insensitive' } },
      ];
    }
    const [items, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          isVerified: true,
          emailVerified: true,
          phoneVerified: true,
          profilePhotoUrl: true,
          createdAt: true,
          workerProfile: {
            select: { headline: true, city: true, state: true, experienceLevel: true, profileCompleteness: true },
          },
          _count: { select: { applications: true, posts: true } },
        },
      }),
      prisma.user.count({ where }),
    ]);
    return reply.send({ items, total, page: q.page, limit: q.limit });
  });

  // ── Employers ───────────────────────────────────────────────────
  app.get('/admin/employers', admin, async (request, reply) => {
    const q = parseList(request, reply);
    if (!q) return;
    const where: Prisma.UserWhereInput = { role: 'employer' };
    if (q.q) {
      where.OR = [
        { firstName: { contains: q.q, mode: 'insensitive' } },
        { lastName: { contains: q.q, mode: 'insensitive' } },
        { email: { contains: q.q, mode: 'insensitive' } },
      ];
    }
    const [items, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          isVerified: true,
          createdAt: true,
          companies: { select: { id: true, name: true, sizeRange: true, website: true } },
          subscription: { select: { plan: true, status: true, currentPeriodEnd: true } },
          _count: { select: { jobsPosted: true } },
        },
      }),
      prisma.user.count({ where }),
    ]);
    return reply.send({ items, total, page: q.page, limit: q.limit });
  });

  // ── Jobs ────────────────────────────────────────────────────────
  app.get('/admin/jobs', admin, async (request, reply) => {
    const q = parseList(request, reply);
    if (!q) return;
    const where: Prisma.JobWhereInput = {};
    if (q.status) where.status = q.status as Prisma.JobWhereInput['status'];
    if (q.q) where.title = { contains: q.q, mode: 'insensitive' };
    const [rows, total] = await Promise.all([
      prisma.job.findMany({
        where,
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          company: { select: { id: true, name: true } },
          trade: { select: { id: true, name: true } },
          _count: { select: { applications: true } },
        },
      }),
      prisma.job.count({ where }),
    ]);
    const items = rows.map((j) => ({
      ...j,
      payMin: Number(j.payMin),
      payMax: Number(j.payMax),
      applicantCount: j._count.applications,
    }));
    return reply.send({ items, total, page: q.page, limit: q.limit });
  });

  // ── Applications ────────────────────────────────────────────────
  app.get('/admin/applications', admin, async (request, reply) => {
    const q = parseList(request, reply);
    if (!q) return;
    const where: Prisma.JobApplicationWhereInput = {};
    if (q.status) where.status = q.status as Prisma.JobApplicationWhereInput['status'];
    const [items, total] = await Promise.all([
      prisma.jobApplication.findMany({
        where,
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        orderBy: { appliedAt: 'desc' },
        select: {
          id: true,
          status: true,
          appliedAt: true,
          job: { select: { id: true, title: true } },
          worker: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      }),
      prisma.jobApplication.count({ where }),
    ]);
    return reply.send({ items, total, page: q.page, limit: q.limit });
  });

  // ── Licenses (verification queue) ───────────────────────────────
  app.get('/admin/licenses', admin, async (request, reply) => {
    const q = parseList(request, reply);
    if (!q) return;
    const where: Prisma.LicenseWhereInput = {};
    if (q.status) where.status = q.status as Prisma.LicenseWhereInput['status'];
    const [items, total] = await Promise.all([
      prisma.license.findMany({
        where,
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        // Pending first, then newest — so the queue surfaces work to do.
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
      }),
      prisma.license.count({ where }),
    ]);
    return reply.send({ items, total, page: q.page, limit: q.limit });
  });

  // PUT /admin/licenses/:id — approve/reject a license.
  app.put<{ Params: { id: string } }>('/admin/licenses/:id', admin, async (request, reply) => {
    const data = parseBody(verifyActionSchema, request, reply);
    if (!data) return;
    const existing = await prisma.license.findUnique({ where: { id: request.params.id } });
    if (!existing) return reply.code(404).send({ error: 'NotFound' });
    const updated = await prisma.license.update({
      where: { id: existing.id },
      data: {
        status: data.status,
        verificationMethod: 'manual',
        verifiedAt: data.status === 'verified' ? new Date() : null,
        verifiedBy: request.user!.id,
      },
    });
    return reply.send(updated);
  });

  // ── Workplaces (verification queue) ─────────────────────────────
  app.get('/admin/work-places', admin, async (request, reply) => {
    const q = parseList(request, reply);
    if (!q) return;
    const where: Prisma.WorkPlaceWhereInput = {};
    if (q.status) where.status = q.status as Prisma.WorkPlaceWhereInput['status'];
    const [items, total] = await Promise.all([
      prisma.workPlace.findMany({
        where,
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
      }),
      prisma.workPlace.count({ where }),
    ]);
    return reply.send({ items, total, page: q.page, limit: q.limit });
  });

  // PUT /admin/work-places/:id — approve/reject a workplace.
  app.put<{ Params: { id: string } }>('/admin/work-places/:id', admin, async (request, reply) => {
    const data = parseBody(verifyActionSchema, request, reply);
    if (!data) return;
    const existing = await prisma.workPlace.findUnique({ where: { id: request.params.id } });
    if (!existing) return reply.code(404).send({ error: 'NotFound' });
    const updated = await prisma.workPlace.update({
      where: { id: existing.id },
      data: {
        status: data.status,
        verificationMethod: 'manual',
        verifiedAt: data.status === 'verified' ? new Date() : null,
      },
    });
    return reply.send(updated);
  });

  // ── Posts (moderation-adjacent: view + archive) ─────────────────
  app.get('/admin/posts', admin, async (request, reply) => {
    const q = parseList(request, reply);
    if (!q) return;
    const where: Prisma.PostWhereInput = {};
    if (q.status === 'archived') where.archived = true;
    else if (q.status === 'active') where.archived = false;
    if (q.q) where.content = { contains: q.q, mode: 'insensitive' };
    const [items, total] = await Promise.all([
      prisma.post.findMany({
        where,
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          content: true,
          archived: true,
          createdAt: true,
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
          photos: { select: { photoUrl: true } },
          _count: { select: { likes: true, comments: true } },
        },
      }),
      prisma.post.count({ where }),
    ]);
    return reply.send({ items, total, page: q.page, limit: q.limit });
  });

  // PUT /admin/posts/:id/archive — admin takedown / restore.
  app.put<{ Params: { id: string }; Body: { archived?: boolean } }>(
    '/admin/posts/:id/archive',
    admin,
    async (request, reply) => {
      const archived = request.body?.archived ?? true;
      const existing = await prisma.post.findUnique({ where: { id: request.params.id } });
      if (!existing) return reply.code(404).send({ error: 'NotFound' });
      const updated = await prisma.post.update({
        where: { id: existing.id },
        data: { archived },
        select: { id: true, archived: true },
      });
      return reply.send(updated);
    },
  );

  // ── Taxonomy ────────────────────────────────────────────────────
  app.get('/admin/trades', admin, async () => {
    const trades = await prisma.trade.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        isPopular: true,
        _count: { select: { jobs: true, userTrades: true, skills: true } },
      },
    });
    return { items: trades, total: trades.length };
  });

  app.get('/admin/skills', admin, async (request, reply) => {
    const q = parseList(request, reply);
    if (!q) return;
    const where: Prisma.SkillWhereInput = {};
    if (q.q) where.name = { contains: q.q, mode: 'insensitive' };
    const [items, total] = await Promise.all([
      prisma.skill.findMany({
        where,
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        orderBy: { name: 'asc' },
        include: { trade: { select: { id: true, name: true } } },
      }),
      prisma.skill.count({ where }),
    ]);
    return reply.send({ items, total, page: q.page, limit: q.limit });
  });
}
