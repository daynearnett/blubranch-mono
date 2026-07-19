import { Prisma } from '@blubranch/db';
import {
  applicationStatusUpdateSchema,
  jobApplyInputSchema,
} from '@blubranch/shared';
import type { FastifyInstance } from 'fastify';
import { requireAuth, requireRole } from '../auth/middleware.js';
import { getPrisma } from '../lib/prisma.js';
import { parseBody } from '../lib/validate.js';
import { sendNotification } from '../services/push.js';

export async function applicationRoutes(app: FastifyInstance): Promise<void> {
  const prisma = getPrisma();

  // ── POST /jobs/:id/apply ────────────────────────────────────────
  // Quick Apply — workers only, one application per worker per job.
  app.post<{ Params: { id: string } }>(
    '/jobs/:id/apply',
    { preHandler: requireRole('worker', 'admin') },
    async (request, reply) => {
      const data = parseBody(jobApplyInputSchema, request, reply);
      if (!data) return;

      // Phone-verification gate: workers must verify their phone number
      // before they can apply to jobs. This prevents spam applications and
      // ensures employers can reach applicants.
      const applicant = await prisma.user.findUnique({
        where: { id: request.user!.id },
        select: { phoneVerified: true, phone: true },
      });
      if (!applicant?.phoneVerified) {
        return reply.code(403).send({
          error: 'PhoneVerificationRequired',
          message: 'Please verify your phone number before applying to jobs',
          hasPhone: !!applicant?.phone,
        });
      }

      const job = await prisma.job.findUnique({ where: { id: request.params.id } });
      if (!job) return reply.code(404).send({ error: 'NotFound' });
      if (job.status !== 'open') {
        return reply
          .code(400)
          .send({ error: 'BadRequest', message: 'Job is no longer accepting applications' });
      }

      try {
        const application = await prisma.jobApplication.create({
          data: {
            jobId: job.id,
            workerId: request.user!.id,
            status: 'applied',
            message: data.message ?? null,
          },
        });
        return reply.code(201).send(application);
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          return reply
            .code(409)
            .send({ error: 'Conflict', message: 'You have already applied to this job' });
        }
        throw err;
      }
    },
  );

  // ── GET /jobs/:id/applications ──────────────────────────────────
  // Whoever owns the job (any role — workers can post jobs too), or an admin.
  // Gated by ownership below, not by role.
  app.get<{ Params: { id: string } }>(
    '/jobs/:id/applications',
    { preHandler: requireAuth },
    async (request, reply) => {
      const job = await prisma.job.findUnique({ where: { id: request.params.id } });
      if (!job) return reply.code(404).send({ error: 'NotFound' });
      if (job.employerId !== request.user!.id && request.user!.role !== 'admin') {
        return reply.code(403).send({ error: 'Forbidden' });
      }
      const apps = await prisma.jobApplication.findMany({
        where: { jobId: job.id },
        orderBy: { appliedAt: 'desc' },
        include: {
          worker: {
            include: {
              workerProfile: true,
              trades: { include: { trade: true } },
            },
          },
        },
      });
      return apps.map((a) => ({
        id: a.id,
        status: a.status,
        message: a.message,
        appliedAt: a.appliedAt,
        worker: {
          id: a.worker.id,
          firstName: a.worker.firstName,
          lastName: a.worker.lastName,
          profilePhotoUrl: a.worker.profilePhotoUrl,
          isVerified: a.worker.isVerified,
          headline: a.worker.workerProfile?.headline ?? null,
          city: a.worker.workerProfile?.city ?? null,
          state: a.worker.workerProfile?.state ?? null,
          experienceLevel: a.worker.workerProfile?.experienceLevel ?? null,
          trades: a.worker.trades.map((t) => t.trade),
        },
      }));
    },
  );

  // ── GET /jobs/:id/stats ─────────────────────────────────────────
  // Time-series for the employer analytics dashboard: cumulative views and
  // applicants per day over the posting's lifetime. Owner (any role) or admin.
  app.get<{ Params: { id: string } }>(
    '/jobs/:id/stats',
    { preHandler: requireAuth },
    async (request, reply) => {
      const job = await prisma.job.findUnique({
        where: { id: request.params.id },
        select: { id: true, employerId: true, createdAt: true, viewCount: true },
      });
      if (!job) return reply.code(404).send({ error: 'NotFound' });
      if (job.employerId !== request.user!.id && request.user!.role !== 'admin') {
        return reply.code(403).send({ error: 'Forbidden' });
      }

      const [views, applications] = await Promise.all([
        prisma.jobView.findMany({
          where: { jobId: job.id },
          select: { createdAt: true },
          orderBy: { createdAt: 'asc' },
        }),
        prisma.jobApplication.findMany({
          where: { jobId: job.id },
          select: { appliedAt: true },
          orderBy: { appliedAt: 'asc' },
        }),
      ]);

      // Bucket by UTC day from posting date → today. Cap the span so a very old
      // posting doesn't produce a giant array.
      const dayKey = (d: Date) => d.toISOString().slice(0, 10);
      const MS_DAY = 86_400_000;
      const MAX_DAYS = 120;
      const start = new Date(job.createdAt);
      const today = new Date();
      let startMs = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
      const endMs = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
      if ((endMs - startMs) / MS_DAY > MAX_DAYS) startMs = endMs - MAX_DAYS * MS_DAY;

      const days: string[] = [];
      for (let ms = startMs; ms <= endMs; ms += MS_DAY) days.push(dayKey(new Date(ms)));

      const perDay = new Map(days.map((d) => [d, { views: 0, applicants: 0 }]));
      for (const v of views) {
        const b = perDay.get(dayKey(v.createdAt));
        if (b) b.views += 1;
      }
      for (const a of applications) {
        const b = perDay.get(dayKey(a.appliedAt));
        if (b) b.applicants += 1;
      }

      let cumViews = 0;
      let cumApplicants = 0;
      const series = days.map((date) => {
        const b = perDay.get(date)!;
        cumViews += b.views;
        cumApplicants += b.applicants;
        return { date, views: cumViews, applicants: cumApplicants };
      });

      return reply.send({
        series,
        // `viewCount` includes views recorded before per-view tracking existed,
        // so it can exceed the series total — surface both.
        totalViews: job.viewCount,
        totalApplicants: applications.length,
      });
    },
  );

  // ── PUT /jobs/:id/applications/:applicationId ───────────────────
  // The job owner (any role) or an admin updates application status. Gated by
  // ownership below, not by role.
  app.put<{ Params: { id: string; applicationId: string } }>(
    '/jobs/:id/applications/:applicationId',
    { preHandler: requireAuth },
    async (request, reply) => {
      const data = parseBody(applicationStatusUpdateSchema, request, reply);
      if (!data) return;

      const application = await prisma.jobApplication.findUnique({
        where: { id: request.params.applicationId },
        include: { job: true },
      });
      if (!application || application.jobId !== request.params.id) {
        return reply.code(404).send({ error: 'NotFound' });
      }
      if (
        application.job.employerId !== request.user!.id &&
        request.user!.role !== 'admin'
      ) {
        return reply.code(403).send({ error: 'Forbidden' });
      }
      const updated = await prisma.jobApplication.update({
        where: { id: application.id },
        data: { status: data.status },
      });

      // Push notification to the worker about their application status change.
      const statusBodies: Record<string, string> = {
        reviewed: 'Your application is being reviewed',
        shortlisted: 'Your application has been shortlisted',
        hired: "You're hired. Nice work.",
        rejected: "This one went another way. The next one's out there.",
      };
      sendNotification({
        userId: application.workerId,
        type: 'application_status',
        title: `Application update: ${application.job.title}`,
        body: statusBodies[data.status] ?? 'Your application has been updated',
        data: {
          jobId: application.jobId,
          applicationId: application.id,
          newStatus: data.status,
        },
      }).catch(() => {});

      return updated;
    },
  );

  // ── GET /users/me/applications ──────────────────────────────────
  // Worker's own application history.
  app.get('/users/me/applications', { preHandler: requireAuth }, async (request) => {
    const apps = await prisma.jobApplication.findMany({
      where: { workerId: request.user!.id },
      orderBy: { appliedAt: 'desc' },
      include: {
        job: {
          include: {
            company: { select: { id: true, name: true, logoUrl: true } },
            trade: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    });
    return apps.map((a) => ({
      id: a.id,
      status: a.status,
      message: a.message,
      appliedAt: a.appliedAt,
      job: {
        id: a.job.id,
        title: a.job.title,
        city: a.job.city,
        state: a.job.state,
        payMin: Number(a.job.payMin),
        payMax: Number(a.job.payMax),
        status: a.job.status,
        company: a.job.company,
        trade: a.job.trade,
      },
    }));
  });
}
