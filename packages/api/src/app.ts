import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import sensible from '@fastify/sensible';
import Fastify, { type FastifyError, type FastifyInstance } from 'fastify';
import { Prisma } from '@blubranch/db';
import { extractUser } from './auth/middleware.js';
import { registerSecurity } from './lib/security.js';
import { startWorkers } from './jobs/worker-setup.js';
import { closeQueues } from './lib/queue.js';
import { applicationRoutes } from './routes/applications.js';
import { authRoutes } from './routes/auth.js';
import { companyRoutes } from './routes/companies.js';
import { jobRoutes } from './routes/jobs.js';
import { postRoutes } from './routes/posts.js';
import { toolboxRoutes } from './routes/toolbox.js';
import { shareRoutes } from './routes/share.js';
import { legalRoutes } from './routes/legal.js';
import { uploadRoutes } from './routes/upload.js';
import { connectionRoutes } from './routes/connections.js';
import { vouchRoutes } from './routes/vouches.js';
import { headlineRoutes } from './routes/headlines.js';
import { userRoutes } from './routes/users.js';
import { messageRoutes } from './routes/messages.js';
import { notificationRoutes } from './routes/notifications.js';
import { paymentRoutes, stripeWebhookRoutes } from './routes/payments.js';
import { adminRoutes } from './routes/admin.js';
import { telemetryRoutes } from './routes/telemetry.js';
import { moderationRoutes } from './routes/moderation.js';

// Origins that may call this API. Native iOS / Android apps don't send the
// Origin header so we let those through unconditionally (the `if (!origin)`
// branch). Browsers must come from one of these domains.
const ALLOWED_ORIGIN_PATTERNS: RegExp[] = [
  /^https?:\/\/localhost(:\d+)?$/,
  /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
  /^https?:\/\/.*\.blubranch\.com$/,
  /^https?:\/\/blubranch\.com$/,
];

// CSV in EXTRA_ALLOWED_ORIGINS lets ops add origins without a deploy
// (e.g. a Vercel preview URL during admin-panel development).
function loadExtraOrigins(): string[] {
  const raw = process.env.EXTRA_ALLOWED_ORIGINS;
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function isOriginAllowed(origin: string): boolean {
  if (ALLOWED_ORIGIN_PATTERNS.some((re) => re.test(origin))) return true;
  return loadExtraOrigins().includes(origin);
}

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { level: process.env.LOG_LEVEL ?? 'info' },
  });

  // Tolerate an empty body on application/json requests. Fastify's default JSON
  // parser throws FST_ERR_CTP_EMPTY_JSON_BODY (400) when a request carries a
  // Content-Type: application/json header but no body — which breaks no-payload
  // mutations like PUT /connections/:id/accept, POST /payments/jobs/:id/intent,
  // and POST /posts/:id/like when a client (e.g. the mobile app) sets the header
  // without sending {}. Treat an empty body as {}; still 400 on malformed JSON.
  // The Stripe webhook plugin registers its own buffer parser in its own scope,
  // so it is unaffected.
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'string' },
    (_req, body, done) => {
      const raw = body as string;
      if (raw === '' || raw == null) {
        done(null, {});
        return;
      }
      try {
        done(null, JSON.parse(raw));
      } catch (err) {
        (err as { statusCode?: number }).statusCode = 400;
        done(err as Error, undefined);
      }
    },
  );

  await app.register(cors, {
    credentials: true,
    origin: (origin, cb) => {
      // Native mobile fetch never sends Origin → always allow.
      if (!origin) return cb(null, true);
      if (isOriginAllowed(origin)) return cb(null, true);
      cb(null, false);
    },
  });
  await app.register(sensible);
  await registerSecurity(app);
  await app.register(multipart, {
    limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  });

  // Run extractUser on every request — populates request.user when a valid
  // bearer token is present, no-op otherwise.
  app.addHook('preHandler', extractUser);

  // Any raw `:id`-param route that passes a caller-supplied string straight into
  // a Prisma `where` on a uuid column (e.g. GET /jobs/:id with a non-UUID id)
  // throws PrismaClientKnownRequestError P2023 from Postgres's own "invalid
  // input syntax for type uuid" — left uncaught, that surfaced as a raw 500
  // with no JSON body. Map known Prisma error codes to clean client errors and
  // never leak internals for anything else.
  app.setErrorHandler((error: FastifyError, request, reply) => {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2023') {
        return reply.code(400).send({ error: 'BadRequest', message: 'Invalid id' });
      }
      if (error.code === 'P2025') {
        return reply.code(404).send({ error: 'NotFound' });
      }
    }
    const statusCode = typeof error.statusCode === 'number' && error.statusCode < 500 ? error.statusCode : 500;
    if (statusCode === 500) {
      request.log.error(error);
      return reply.code(500).send({ error: 'InternalServerError', message: 'Something went wrong' });
    }
    return reply.code(statusCode).send({ error: error.name ?? 'Error', message: error.message });
  });

  app.get('/health', async () => ({ status: 'ok' }));

  await app.register(authRoutes);
  await app.register(userRoutes);
  await app.register(companyRoutes);
  await app.register(jobRoutes);
  await app.register(applicationRoutes);
  await app.register(connectionRoutes);
  await app.register(vouchRoutes);
  await app.register(headlineRoutes);
  await app.register(postRoutes);
  await app.register(toolboxRoutes);
  await app.register(shareRoutes);
  await app.register(legalRoutes);
  await app.register(messageRoutes);
  await app.register(notificationRoutes);
  await app.register(paymentRoutes);
  // Stripe webhook is registered as its own encapsulated plugin so it can parse
  // the raw request body (signature verification) without affecting JSON routes.
  await app.register(stripeWebhookRoutes);
  await app.register(adminRoutes);
  await app.register(telemetryRoutes);
  await app.register(moderationRoutes);
  await app.register(uploadRoutes);

  // BullMQ workers + repeatable job schedules (expire-jobs hourly,
  // license-expiration nightly). Skip in test env to avoid Redis dependency.
  if (process.env.NODE_ENV !== 'test') {
    await startWorkers();
    app.addHook('onClose', async () => closeQueues());
  }

  return app;
}
