import { feedQuerySchema, postCommentInputSchema, postInputSchema } from '@blubranch/shared';
import { Prisma } from '@blubranch/db';
import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../auth/middleware.js';
import { isPostGisEnabled } from '../lib/postgis.js';
import { canViewPost } from '../lib/post-visibility.js';
import { getPrisma } from '../lib/prisma.js';
import { parseBody } from '../lib/validate.js';
import { notifyMentions, notifyPostComment, notifyPostLike } from '../services/push.js';
import { moderateText } from '../services/content-moderation.js';

// Shared 422 for auto-moderated content.
const CONTENT_BLOCKED = {
  error: 'ContentBlocked',
  message: 'This content may violate our community guidelines and can’t be posted.',
};

export async function postRoutes(app: FastifyInstance): Promise<void> {
  const prisma = getPrisma();

  // ── POST /posts ─────────────────────────────────────────────────
  app.post('/posts', { preHandler: requireAuth }, async (request, reply) => {
    const data = parseBody(postInputSchema, request, reply);
    if (!data) return;
    // Auto-moderate the text (fail-open if unconfigured / API error).
    if ((await moderateText(data.content)).blocked) {
      return reply.code(422).send(CONTENT_BLOCKED);
    }
    const post = await prisma.post.create({
      data: {
        userId: request.user!.id,
        content: data.content,
        audience: data.audience ?? 'anyone',
        locationTag: data.locationTag ?? null,
        tradeTag: data.tradeTag ?? null,
        photos: data.photoUrls
          ? {
              create: data.photoUrls.map((url, i) => ({ photoUrl: url, sortOrder: i })),
            }
          : undefined,
      },
      include: { photos: true },
    });
    notifyMentions(request.user!.id, data.mentionedUserIds, post.id, 'post').catch(() => {});
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
        // Notify the post's author (best-effort, no self-notify).
        prisma.post
          .findUnique({ where: { id: request.params.id }, select: { userId: true } })
          .then((post) =>
            post ? notifyPostLike(request.user!.id, request.params.id, post.userId) : undefined,
          )
          .catch(() => {});
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

  // ── DELETE /posts/:id ───────────────────────────────────────────
  app.delete<{ Params: { id: string } }>(
    '/posts/:id',
    { preHandler: requireAuth },
    async (request, reply) => {
      const post = await prisma.post.findUnique({
        where: { id: request.params.id },
        select: { userId: true },
      });
      if (!post) return reply.code(404).send({ error: 'NotFound', message: 'Post not found' });
      if (post.userId !== request.user!.id) {
        return reply.code(403).send({ error: 'Forbidden', message: 'Not your post' });
      }
      await prisma.post.delete({ where: { id: request.params.id } });
      return reply.send({ deleted: true });
    },
  );

  // ── PUT /posts/:id/archive ──────────────────────────────────────
  // Toggle (or set via body.archived). Archived posts drop out of the feed.
  app.put<{ Params: { id: string }; Body: { archived?: boolean } }>(
    '/posts/:id/archive',
    { preHandler: requireAuth },
    async (request, reply) => {
      const post = await prisma.post.findUnique({
        where: { id: request.params.id },
        select: { userId: true, archived: true },
      });
      if (!post) return reply.code(404).send({ error: 'NotFound', message: 'Post not found' });
      if (post.userId !== request.user!.id) {
        return reply.code(403).send({ error: 'Forbidden', message: 'Not your post' });
      }
      const archived = request.body?.archived ?? !post.archived;
      await prisma.post.update({ where: { id: request.params.id }, data: { archived } });
      return reply.send({ archived });
    },
  );

  // ── GET /posts/:id ──────────────────────────────────────────────
  // Single post in feed shape — used by the comments screen (and the
  // blubranch://post/<id> deep link) to show the post being commented on.
  app.get<{ Params: { id: string } }>(
    '/posts/:id',
    { preHandler: requireAuth },
    async (request, reply) => {
      const userId = request.user!.id;
      const p = await prisma.post.findUnique({
        where: { id: request.params.id },
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
      if (!p) return reply.code(404).send({ error: 'NotFound', message: 'Post not found' });
      // Respect the post's audience: 'connections' posts are only visible to the
      // author + accepted connections; archived posts only to the author. 404
      // (not 403) so we don't confirm the id to someone who may not see it.
      if (!(await canViewPost(prisma, userId, p))) {
        return reply.code(404).send({ error: 'NotFound', message: 'Post not found' });
      }
      return reply.send({
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
      });
    },
  );

  // ── Comments ────────────────────────────────────────────────────
  app.get<{ Params: { id: string } }>(
    '/posts/:id/comments',
    { preHandler: requireAuth },
    async (request, reply) => {
      // Gate comments behind the parent post's visibility so a 'connections'
      // (or archived) post doesn't leak its commenters to non-viewers.
      const post = await prisma.post.findUnique({
        where: { id: request.params.id },
        select: { userId: true, audience: true, archived: true },
      });
      if (!post || !(await canViewPost(prisma, request.user!.id, post))) {
        return reply.code(404).send({ error: 'NotFound', message: 'Post not found' });
      }
      return prisma.postComment.findMany({
        where: { postId: request.params.id },
        orderBy: { createdAt: 'asc' },
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, profilePhotoUrl: true },
          },
        },
      });
    },
  );

  app.post<{ Params: { id: string } }>(
    '/posts/:id/comments',
    { preHandler: requireAuth },
    async (request, reply) => {
      const data = parseBody(postCommentInputSchema, request, reply);
      if (!data) return;
      if ((await moderateText(data.content)).blocked) {
        return reply.code(422).send(CONTENT_BLOCKED);
      }
      const comment = await prisma.postComment.create({
        data: {
          postId: request.params.id,
          userId: request.user!.id,
          content: data.content,
        },
      });
      // Notify the post's author (best-effort, no self-notify).
      prisma.post
        .findUnique({ where: { id: request.params.id }, select: { userId: true } })
        .then((post) =>
          post
            ? notifyPostComment(request.user!.id, request.params.id, post.userId, data.content)
            : undefined,
        )
        .catch(() => {});
      // Notify tagged connections.
      notifyMentions(request.user!.id, data.mentionedUserIds, request.params.id, 'comment').catch(
        () => {},
      );
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
      where: {
        archived: false,
        ...(connectionIds.length > 1 ? { userId: { in: connectionIds } } : {}),
      },
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
        comments: {
          orderBy: { createdAt: 'desc' },
          take: 2,
          include: {
            user: { select: { id: true, firstName: true, lastName: true, profilePhotoUrl: true } },
          },
        },
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

    if (profile?.city && profile?.state && isPostGisEnabled()) {
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
            CASE WHEN wp."geo" IS NOT NULL AND j."geo" IS NOT NULL
              THEN ST_Distance(j."geo", wp."geo") / 1609.344
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
            // Latest 2 comments, shown oldest-first under the post (LinkedIn-style).
            topComments: [...p.comments].reverse().map((c) => ({
              id: c.id,
              content: c.content,
              user: {
                firstName: c.user.firstName,
                lastName: c.user.lastName,
                profilePhotoUrl: c.user.profilePhotoUrl,
              },
            })),
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
