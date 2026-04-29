import { feedQuerySchema, postCommentInputSchema, postInputSchema } from '@blubranch/shared';
import { Prisma } from '@blubranch/db';
import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../auth/middleware.js';
import { getPrisma } from '../lib/prisma.js';
import { parseBody } from '../lib/validate.js';

export async function postRoutes(app: FastifyInstance): Promise<void> {
  const prisma = getPrisma();

  // ── POST /posts ─────────────────────────────────────────────────
  app.post('/posts', { preHandler: requireAuth }, async (request, reply) => {
    const data = parseBody(postInputSchema, request, reply);
    if (!data) return;
    const post = await prisma.post.create({
      data: {
        userId: request.user!.id,
        content: data.content,
        photos: data.photoUrls
          ? {
              create: data.photoUrls.map((url, i) => ({ photoUrl: url, sortOrder: i })),
            }
          : undefined,
      },
      include: { photos: true },
    });
    return reply.code(201).send(post);
  });

  // ── POST /posts/:id/like ────────────────────────────────────────
  app.post<{ Params: { id: string } }>(
    '/posts/:id/like',
    { preHandler: requireAuth },
    async (request, reply) => {
      try {
        await prisma.postLike.create({
          data: { postId: request.params.id, userId: request.user!.id },
        });
        return reply.code(201).send({ liked: true });
      } catch (err) {
        // Already liked → idempotent success.
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          return reply.send({ liked: true });
        }
        throw err;
      }
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/posts/:id/like',
    { preHandler: requireAuth },
    async (request, reply) => {
      await prisma.postLike.deleteMany({
        where: { postId: request.params.id, userId: request.user!.id },
      });
      return reply.send({ liked: false });
    },
  );

  // ── Comments ────────────────────────────────────────────────────
  app.get<{ Params: { id: string } }>('/posts/:id/comments', async (request) => {
    return prisma.postComment.findMany({
      where: { postId: request.params.id },
      orderBy: { createdAt: 'asc' },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, profilePhotoUrl: true },
        },
      },
    });
  });

  app.post<{ Params: { id: string } }>(
    '/posts/:id/comments',
    { preHandler: requireAuth },
    async (request, reply) => {
      const data = parseBody(postCommentInputSchema, request, reply);
      if (!data) return;
      const comment = await prisma.postComment.create({
        data: {
          postId: request.params.id,
          userId: request.user!.id,
          content: data.content,
        },
      });
      return reply.code(201).send(comment);
    },
  );

  // ── GET /feed ───────────────────────────────────────────────────
  // Mockup screen 4. Returns a mixed timeline of posts (from accepted
  // connections, falling back to global recent posts when the user has
  // few connections) interleaved with nearby jobs every 3rd item.
  app.get('/feed', { preHandler: requireAuth }, async (request, reply) => {
    const result = feedQuerySchema.safeParse(request.query);
    if (!result.success) {
      return reply
        .code(400)
        .send({ error: 'ValidationError', issues: result.error.errors });
    }
    const q = result.data;
    const userId = request.user!.id;

    // Connection ids (accepted, either direction).
    const connections = await prisma.connection.findMany({
      where: {
        status: 'accepted',
        OR: [{ requesterId: userId }, { receiverId: userId }],
      },
      select: { requesterId: true, receiverId: true },
    });
    const connectionIds = connections
      .map((c) => (c.requesterId === userId ? c.receiverId : c.requesterId))
      .concat(userId);

    const postsPromise = prisma.post.findMany({
      where: connectionIds.length > 1 ? { userId: { in: connectionIds } } : undefined,
      orderBy: { createdAt: 'desc' },
      take: q.limit,
      skip: (q.page - 1) * q.limit,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profilePhotoUrl: true,
            workerProfile: { select: { headline: true, unionName: true } },
          },
        },
        photos: { orderBy: { sortOrder: 'asc' } },
        likes: { where: { userId }, select: { userId: true } },
        _count: { select: { likes: true, comments: true } },
      },
    });

    // Jobs near the worker's saved location (or global recent if none).
    const profile = await prisma.workerProfile.findUnique({ where: { userId } });
    const trades = await prisma.userTrade.findMany({
      where: { userId },
      select: { tradeId: true },
    });

    const tradeIds = trades.map((t) => t.tradeId);

    let jobsRows: Array<{
      id: string;
      title: string;
      pay_min: string;
      pay_max: string;
      city: string;
      state: string;
      job_type: string;
      work_setting: string;
      created_at: Date;
      is_featured: boolean;
      is_urgent: boolean;
      company_name: string;
      company_id: string;
      trade_name: string;
      trade_slug: string;
      distance_miles: number | null;
    }> = [];

    if (profile?.city && profile?.state) {
      const conditions: Prisma.Sql[] = [Prisma.sql`j."status" = 'open'::"JobStatus"`];
      if (tradeIds.length > 0) {
        conditions.push(Prisma.sql`j."trade_id" = ANY(${tradeIds}::int[])`);
      }
      // Nearest first; PostGIS distance over the user's stored point.
      jobsRows = await prisma.$queryRaw(Prisma.sql`
        SELECT
          j."id", j."title", j."pay_min", j."pay_max", j."city", j."state",
          j."job_type", j."work_setting", j."created_at", j."is_featured", j."is_urgent",
          c."id" AS company_id, c."name" AS company_name,
          t."name" AS trade_name, t."slug" AS trade_slug,
          (
            CASE WHEN wp."location" IS NOT NULL AND j."location" IS NOT NULL
              THEN ST_Distance(j."location", wp."location") / 1609.344
              ELSE NULL
            END
          ) AS distance_miles
        FROM "jobs" j
        JOIN "companies" c ON c."id" = j."company_id"
        JOIN "trades" t ON t."id" = j."trade_id"
        LEFT JOIN "worker_profiles" wp ON wp."user_id" = ${userId}::uuid
        WHERE ${Prisma.join(conditions, ' AND ')}
        ORDER BY j."is_featured" DESC, distance_miles ASC NULLS LAST, j."created_at" DESC
        LIMIT 6
      `);
    } else {
      // No saved location → just newest open jobs.
      jobsRows = await prisma.$queryRaw(Prisma.sql`
        SELECT
          j."id", j."title", j."pay_min", j."pay_max", j."city", j."state",
          j."job_type", j."work_setting", j."created_at", j."is_featured", j."is_urgent",
          c."id" AS company_id, c."name" AS company_name,
          t."name" AS trade_name, t."slug" AS trade_slug,
          NULL::double precision AS distance_miles
        FROM "jobs" j
        JOIN "companies" c ON c."id" = j."company_id"
        JOIN "trades" t ON t."id" = j."trade_id"
        WHERE j."status" = 'open'::"JobStatus"
        ORDER BY j."is_featured" DESC, j."created_at" DESC
        LIMIT 6
      `);
    }

    const posts = await postsPromise;

    // Interleave: post, post, job, post, post, job…
    const items: Array<{ kind: 'post' | 'job'; data: unknown }> = [];
    let pi = 0;
    let ji = 0;
    while (pi < posts.length || ji < jobsRows.length) {
      for (let k = 0; k < 2 && pi < posts.length; k++) {
        const p = posts[pi++];
        if (!p) break;
        items.push({
          kind: 'post',
          data: {
            id: p.id,
            content: p.content,
            createdAt: p.createdAt,
            photos: p.photos,
            likeCount: p._count.likes,
            commentCount: p._count.comments,
            likedByMe: p.likes.length > 0,
            user: {
              id: p.user.id,
              firstName: p.user.firstName,
              lastName: p.user.lastName,
              profilePhotoUrl: p.user.profilePhotoUrl,
              headline: p.user.workerProfile?.headline ?? null,
              unionName: p.user.workerProfile?.unionName ?? null,
            },
          },
        });
      }
      if (ji < jobsRows.length) {
        const j = jobsRows[ji++];
        if (j) {
          items.push({
            kind: 'job',
            data: {
              id: j.id,
              title: j.title,
              payMin: Number(j.pay_min),
              payMax: Number(j.pay_max),
              city: j.city,
              state: j.state,
              jobType: j.job_type,
              workSetting: j.work_setting,
              isFeatured: j.is_featured,
              isUrgent: j.is_urgent,
              createdAt: j.created_at,
              company: { id: j.company_id, name: j.company_name },
              trade: { name: j.trade_name, slug: j.trade_slug },
              distanceMiles: j.distance_miles,
            },
          });
        }
      }
    }

    return reply.send({ page: q.page, limit: q.limit, items });
  });
}
