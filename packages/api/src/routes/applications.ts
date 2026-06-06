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
  // Employer-only, must own the job.
  app.get<{ Params: { id: string } }>(
    '/jobs/:id/applications',
    { preHandler: requireRole('employer', 'admin') },
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

  // ── PUT /jobs/:id/applications/:applicationId ───────────────────
  // Employer updates application status (reviewed, shortlisted, hired, rejected).
  app.put<{ Params: { id: string; applicationId: string } }>(
    '/jobs/:id/applications/:applicationId',
    { preHandler: requireRole('employer', 'admin') },
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
      const statusLabels: Record<string, string> = {
        reviewed: 'is being reviewed',
        shortlisted: 'has been shortlisted',
        hired: 'resulted in a hire! Congratulations',
        rejected: 'was not selected',
      };
      sendNotification({
        userId: application.workerId,
        type: 'application_status',
        title: `Application update: ${application.job.title}`,
        body: `Your application ${statusLabels[data.status] ?? 'has been updated'}`,
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
