import {
  jobInputSchema,
  jobSearchQuerySchema,
  jobUpdateSchema,
} from '@blubranch/shared';
import { Prisma } from '@blubranch/db';
import type { FastifyInstance } from 'fastify';
import { requireAuth, requireRole } from '../auth/middleware.js';
import { isPostGisEnabled } from '../lib/postgis.js';
import { getPrisma } from '../lib/prisma.js';
import { parseBody } from '../lib/validate.js';
import { geocodeAddress, setGeographyPoint } from '../services/geocode.js';

const MILES_TO_METERS = 1609.344;

function planTtlDays(plan: 'basic' | 'pro' | 'unlimited'): number {
  return plan === 'basic' ? 30 : 60;
}

export async function jobRoutes(app: FastifyInstance): Promise<void> {
  const prisma = getPrisma();

  // ── POST /jobs ──────────────────────────────────────────────────
  // Mockup screen 7E "Pay & publish". For Phase 3 we skip Stripe and
  // create the job in `open` status immediately.
  app.post(
    '/jobs',
    { preHandler: requireRole('employer', 'admin') },
    async (request, reply) => {
      const data = parseBody(jobInputSchema, request, reply);
      if (!data) return;

      // Verify the company belongs to the current employer.
      const company = await prisma.company.findUnique({ where: { id: data.companyId } });
      if (!company) return reply.code(400).send({ error: 'BadRequest', message: 'Unknown company' });
      if (company.employerId !== request.user!.id && request.user!.role !== 'admin') {
        return reply.code(403).send({ error: 'Forbidden' });
      }
      if (data.payMax < data.payMin) {
        return reply
          .code(400)
          .send({ error: 'BadRequest', message: 'payMax must be ≥ payMin' });
      }

      const expiresAt = new Date(Date.now() + planTtlDays(data.planTier) * 24 * 60 * 60 * 1000);
      // Pro/Unlimited get featured placement automatically; Basic doesn't qualify.
      const isFeatured = data.boostFeaturedPlacement && data.planTier !== 'basic';

      const job = await prisma.job.create({
        data: {
          employerId: request.user!.id,
          companyId: data.companyId,
          title: data.title,
          tradeId: data.tradeId,
          experienceLevel: data.experienceLevel,
          payMin: data.payMin,
          payMax: data.payMax,
          jobType: data.jobType,
          workSetting: data.workSetting,
          city: data.city,
          state: data.state,
          zipCode: data.zipCode,
          description: data.description,
          openingsCount: data.openingsCount,
          status: data.status === 'draft' ? 'draft' : 'open',
          planTier: data.planTier,
          isFeatured,
          isUrgent: data.isUrgent && data.planTier !== 'basic',
          boostPushNotification: data.boostPushNotification && data.planTier !== 'basic',
          boostFeaturedPlacement: isFeatured,
          expiresAt,
          benefits: { create: (data.benefitIds ?? []).map((benefitId) => ({ benefitId })) },
        },
      });

      // Best-effort geocode → write geography point via raw SQL.
      // We never want a geocode hiccup to kill the create — log and move on.
      try {
        const geo = await geocodeAddress({
          city: data.city,
          state: data.state,
          zipCode: data.zipCode,
        });
        if (geo) {
          await setGeographyPoint(prisma, 'jobs', job.id, geo);
        }
      } catch (err) {
        request.log.warn({ err, jobId: job.id }, 'job geocode/setGeographyPoint failed');
      }

      return reply.code(201).send(job);
    },
  );

  // ── GET /jobs ───────────────────────────────────────────────────
  // PostGIS radius search via raw SQL — Prisma can't model geography ops.
  // We compute distance_miles (NULL when no lat/lng provided) and let the
  // caller's `sort` choice drive ordering. Featured jobs always rank above
  // their non-featured peers within the same sort bucket.
  app.get('/jobs', async (request, reply) => {
    const result = jobSearchQuerySchema.safeParse(request.query);
    if (!result.success) {
      return reply.code(400).send({
        error: 'ValidationError',
        issues: result.error.errors.map((e) => ({ path: e.path.join('.'), message: e.message })),
      });
    }
    const q = result.data;
    const offset = (q.page - 1) * q.limit;

    // Build WHERE clauses. Use Prisma.sql for safe parameterization.
    const conditions: Prisma.Sql[] = [Prisma.sql`j."status" = 'open'::"JobStatus"`];

    if (q.trade) {
      conditions.push(Prisma.sql`t."slug" = ${q.trade}`);
    }
    if (q.type) {
      conditions.push(Prisma.sql`j."job_type"::text = ${q.type}`);
    }
    if (q.setting) {
      conditions.push(Prisma.sql`j."work_setting"::text = ${q.setting}`);
    }
    if (q.search) {
      const term = `%${q.search}%`;
      conditions.push(Prisma.sql`(j."title" ILIKE ${term} OR j."description" ILIKE ${term})`);
    }

    // PostGIS-aware lat/lng filtering only fires when (a) the caller
    // supplied a point AND (b) PostGIS is enabled in this environment.
    // On Railway's stock Postgres POSTGIS_ENABLED=false → we skip the
    // radius filter and the distance column entirely. The query still
    // returns results, just without distance sorting.
    const useGeo = isPostGisEnabled() && q.lat !== undefined && q.lng !== undefined;

    let distanceSelect = Prisma.sql`NULL::double precision AS distance_miles`;
    if (useGeo) {
      const meters = q.radius * MILES_TO_METERS;
      const point = Prisma.sql`ST_SetSRID(ST_MakePoint(${q.lng}, ${q.lat}), 4326)::geography`;
      distanceSelect = Prisma.sql`(ST_Distance(j."location", ${point}) / ${MILES_TO_METERS}) AS distance_miles`;
      conditions.push(
        Prisma.sql`j."location" IS NOT NULL AND ST_DWithin(j."location", ${point}, ${meters})`,
      );
    }

    const whereSql = Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`;

    let orderSql: Prisma.Sql;
    if (q.sort === 'newest') {
      orderSql = Prisma.sql`ORDER BY j."is_featured" DESC, j."created_at" DESC`;
    } else if (q.sort === 'pay_highest') {
      orderSql = Prisma.sql`ORDER BY j."is_featured" DESC, j."pay_max" DESC`;
    } else if (useGeo) {
      orderSql = Prisma.sql`ORDER BY j."is_featured" DESC, distance_miles ASC NULLS LAST`;
    } else {
      // 'nearest' fallback when no point given OR PostGIS disabled.
      orderSql = Prisma.sql`ORDER BY j."is_featured" DESC, j."created_at" DESC`;
    }

    const rows = await prisma.$queryRaw<Array<{
      id: string;
      title: string;
      pay_min: string;
      pay_max: string;
      job_type: string;
      work_setting: string;
      city: string;
      state: string;
      zip_code: string;
      experience_level: string;
      openings_count: number;
      plan_tier: string;
      is_featured: boolean;
      is_urgent: boolean;
      created_at: Date;
      expires_at: Date;
      company_id: string;
      company_name: string;
      company_logo_url: string | null;
      trade_id: number;
      trade_name: string;
      trade_slug: string;
      distance_miles: number | null;
    }>>(Prisma.sql`
      SELECT
        j."id", j."title", j."pay_min", j."pay_max", j."job_type", j."work_setting",
        j."city", j."state", j."zip_code", j."experience_level", j."openings_count",
        j."plan_tier", j."is_featured", j."is_urgent", j."created_at", j."expires_at",
        c."id" AS company_id, c."name" AS company_name, c."logo_url" AS company_logo_url,
        t."id" AS trade_id, t."name" AS trade_name, t."slug" AS trade_slug,
        ${distanceSelect}
      FROM "jobs" j
      JOIN "companies" c ON c."id" = j."company_id"
      JOIN "trades" t ON t."id" = j."trade_id"
      ${whereSql}
      ${orderSql}
      LIMIT ${q.limit} OFFSET ${offset}
    `);

    // Total for pagination — same WHERE clause, no joins/order needed.
    const totals = await prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
      SELECT COUNT(*)::bigint AS count
      FROM "jobs" j
      JOIN "trades" t ON t."id" = j."trade_id"
      ${whereSql}
    `);
    const total = Number(totals[0]?.count ?? 0n);

    return reply.send({
      page: q.page,
      limit: q.limit,
      total,
      results: rows.map((r) => ({
        id: r.id,
        title: r.title,
        payMin: Number(r.pay_min),
        payMax: Number(r.pay_max),
        jobType: r.job_type,
        workSetting: r.work_setting,
        city: r.city,
        state: r.state,
        zipCode: r.zip_code,
        experienceLevel: r.experience_level,
        openingsCount: r.openings_count,
        planTier: r.plan_tier,
        isFeatured: r.is_featured,
        isUrgent: r.is_urgent,
        createdAt: r.created_at,
        expiresAt: r.expires_at,
        company: { id: r.company_id, name: r.company_name, logoUrl: r.company_logo_url },
        trade: { id: r.trade_id, name: r.trade_name, slug: r.trade_slug },
        distanceMiles: r.distance_miles,
      })),
    });
  });

  // ── GET /jobs/:id ───────────────────────────────────────────────
  // Full detail (Mockup screen 6B) — employer card, benefits, applicant count.
  app.get<{ Params: { id: string } }>('/jobs/:id', async (request, reply) => {
    const job = await prisma.job.findUnique({
      where: { id: request.params.id },
      include: {
        company: true,
        trade: true,
        benefits: { include: { benefit: true } },
        _count: { select: { applications: true } },
      },
    });
    if (!job) return reply.code(404).send({ error: 'NotFound' });

    // `request.user` may not be set; if it is and they're a worker, surface
    // their existing application status so the UI can swap "Quick Apply"
    // for an applied state.
    let myApplication = null;
    if (request.user) {
      myApplication = await prisma.jobApplication.findUnique({
        where: { jobId_workerId: { jobId: job.id, workerId: request.user.id } },
      });
    }

    return reply.send({
      ...job,
      payMin: Number(job.payMin),
      payMax: Number(job.payMax),
      benefits: job.benefits.map((b) => b.benefit),
      applicantCount: job._count.applications,
      myApplication,
    });
  });

  // ── PUT /jobs/:id ───────────────────────────────────────────────
  app.put<{ Params: { id: string } }>(
    '/jobs/:id',
    { preHandler: requireRole('employer', 'admin') },
    async (request, reply) => {
      const data = parseBody(jobUpdateSchema, request, reply);
      if (!data) return;

      const existing = await prisma.job.findUnique({ where: { id: request.params.id } });
      if (!existing) return reply.code(404).send({ error: 'NotFound' });
      if (existing.employerId !== request.user!.id && request.user!.role !== 'admin') {
        return reply.code(403).send({ error: 'Forbidden' });
      }

      const updated = await prisma.job.update({
        where: { id: existing.id },
        data: {
          ...(data.title !== undefined && { title: data.title }),
          ...(data.tradeId !== undefined && { tradeId: data.tradeId }),
          ...(data.experienceLevel !== undefined && { experienceLevel: data.experienceLevel }),
          ...(data.payMin !== undefined && { payMin: data.payMin }),
          ...(data.payMax !== undefined && { payMax: data.payMax }),
          ...(data.jobType !== undefined && { jobType: data.jobType }),
          ...(data.workSetting !== undefined && { workSetting: data.workSetting }),
          ...(data.city !== undefined && { city: data.city }),
          ...(data.state !== undefined && { state: data.state }),
          ...(data.zipCode !== undefined && { zipCode: data.zipCode }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.openingsCount !== undefined && { openingsCount: data.openingsCount }),
          ...(data.status !== undefined && { status: data.status }),
          ...(data.isUrgent !== undefined && { isUrgent: data.isUrgent }),
        },
      });

      // Re-geocode if any address part changed.
      if (data.city || data.state || data.zipCode) {
        try {
          const geo = await geocodeAddress({
            city: data.city ?? existing.city,
            state: data.state ?? existing.state,
            zipCode: data.zipCode ?? existing.zipCode,
          });
          if (geo) await setGeographyPoint(prisma, 'jobs', updated.id, geo);
        } catch (err) {
          request.log.warn({ err, jobId: updated.id }, 'job re-geocode failed');
        }
      }

      return reply.send(updated);
    },
  );

  // ── DELETE /jobs/:id ────────────────────────────────────────────
  // Soft-delete — flips status to 'closed' so applicants still resolve.
  app.delete<{ Params: { id: string } }>(
    '/jobs/:id',
    { preHandler: requireRole('employer', 'admin') },
    async (request, reply) => {
      const existing = await prisma.job.findUnique({ where: { id: request.params.id } });
      if (!existing) return reply.code(404).send({ error: 'NotFound' });
      if (existing.employerId !== request.user!.id && request.user!.role !== 'admin') {
        return reply.code(403).send({ error: 'Forbidden' });
      }
      await prisma.job.update({
        where: { id: existing.id },
        data: { status: 'closed' },
      });
      return reply.code(204).send();
    },
  );

  // ── GET /users/me/jobs ──────────────────────────────────────────
  // Employer's posted jobs.
  app.get('/users/me/jobs', { preHandler: requireRole('employer', 'admin') }, async (request) => {
    const jobs = await prisma.job.findMany({
      where: { employerId: request.user!.id },
      orderBy: { createdAt: 'desc' },
      include: {
        company: { select: { id: true, name: true } },
        trade: { select: { id: true, name: true, slug: true } },
        _count: { select: { applications: true } },
      },
    });
    return jobs.map((j) => ({
      ...j,
      payMin: Number(j.payMin),
      payMax: Number(j.payMax),
      applicantCount: j._count.applications,
    }));
  });
}
